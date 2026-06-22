import { Controller, Req } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import { runOrpcHandler } from "@/common/orpc/http-exception-to-orpc"
import { SlidingWindowRateLimitService } from "@/common/rate-limit/sliding-window-rate-limit.service"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { v1 } from "@/config/api-versions.config"
import { env } from "@/config/env.config"
import { AuditEvent } from "@/shared/decorators/audit-event.decorator"

import { applyCommonScenario, applyDelay, getMockScenario } from "../mock-data/mock-scenario.util"
import { RegistryService } from "./registry.service"

/**
 * Registry is ENP-only data. Prefer session role, but fall back to `enp_profiles` when `qlegal`
 * is missing/stale — mirrors {@link AuthProfileService.getProfile} so `/profile/me` role "enp"
 * matches registry access (avoids 403 when OpenAPI context omits `request` → `qlegal: null`).
 */
async function resolveRegistryEnpUserId(
	session: UserSession,
	context: unknown,
	registry: RegistryService
): Promise<string> {
	const userId = session.user?.id
	if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

	const qlegal = (context as { qlegal: QlegalSessionContext | null }).qlegal

	if (
		qlegal?.role === "admin" ||
		qlegal?.role === "super_admin" ||
		qlegal?.role === "sub_org_admin"
	) {
		throw new ORPCError("FORBIDDEN", { message: "Notary (ENP) access required" })
	}
	if (qlegal?.role === "client") {
		throw new ORPCError("FORBIDDEN", { message: "Notary (ENP) access required" })
	}
	if (qlegal?.role === "enp") {
		return userId
	}

	const hasEnp = await registry.userHasEnpProfile(userId)
	if (!hasEnp) {
		throw new ORPCError("FORBIDDEN", { message: "Notary (ENP) access required" })
	}
	return userId
}

@Controller()
export class RegistryController {
	constructor(
		private readonly service: RegistryService,
		private readonly rateLimit: SlidingWindowRateLimitService
	) {}

	@Implement(v1.registry.list)
	async list(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.registry.list).handler(async ({ context }) => {
			const enpUserId = await resolveRegistryEnpUserId(session, context, this.service)
			const scenario = getMockScenario(req)
			if (scenario === "empty") return []
			applyCommonScenario(scenario, "Registry Acts")
			try {
				await this.service.repopulateLatestEndedMeetingIfMissing(enpUserId)
			} catch {
				/* best-effort: latest ended meeting may have been missed at end-session */
			}
			return this.service.findAllForEnp(enpUserId)
		})
	}

	/** Register before `get` (`/registry/:id`) so `enb-access-requests` is not treated as an act id. */
	@Implement(v1.registry.listEnbAccessRequests)
	async listEnbAccessRequests(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.registry.listEnbAccessRequests).handler(async ({ context }) => {
			const enpUserId = await resolveRegistryEnpUserId(session, context, this.service)
			applyCommonScenario(getMockScenario(req), "ENB Access Requests")
			return this.service.listEnbAccessRequests(enpUserId)
		})
	}

	@Implement(v1.registry.get)
	async get(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.registry.get).handler(async ({ input, context }) => {
			const enpUserId = await resolveRegistryEnpUserId(session, context, this.service)
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Registry Act")
			return this.service.findOneForEnp(enpUserId, input.id)
		})
	}

	@Implement(v1.registry.create)
	@AuditEvent({ eventType: "registry.act_created", targetTable: "registry_acts" })
	async create(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.registry.create).handler(async ({ input, context }) => {
			const enpUserId = await resolveRegistryEnpUserId(session, context, this.service)
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Registry Act")
			return this.service.create(enpUserId, input)
		})
	}

	@Implement(v1.registry.finalizeSessionDraft)
	@AuditEvent({ eventType: "registry.finalize_session_draft", targetTable: "registry_acts" })
	async finalizeSessionDraft(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.registry.finalizeSessionDraft).handler(async ({ input, context }) => {
			const enpUserId = await resolveRegistryEnpUserId(session, context, this.service)
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Registry Act")
			return this.service.finalizeSessionDraft(enpUserId, input)
		})
	}

	@Implement(v1.registry.bulkScSync)
	@AuditEvent({ eventType: "registry.sc_bulk_sync", targetTable: "registry_acts" })
	async bulkScSync(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.registry.bulkScSync).handler(async ({ input, context }) => {
			const failAll = (message: string) => ({
				submitted: 0,
				failed: input.actIds.length,
				results: input.actIds.map(actId => ({
					actId,
					success: false as const,
					error: message,
				})),
			})

			try {
				const enpUserId = await resolveRegistryEnpUserId(session, context, this.service)
				try {
					this.rateLimit.check(`registry-sc-bulk:${enpUserId}`, {
						limit: env.REGISTRY_SC_SYNC_RATE_LIMIT_MAX,
						windowMs: env.REGISTRY_SC_SYNC_RATE_LIMIT_WINDOW_MS,
						message: "SC sync rate limit exceeded for this notary. Try again later.",
					})
				} catch (e) {
					if (e instanceof ORPCError && e.code === "TOO_MANY_REQUESTS") {
						return failAll(e.message ?? "SC sync rate limit exceeded. Try again later.")
					}
					throw e
				}
				const scenario = getMockScenario(req)
				applyCommonScenario(scenario, "SC Sync")
				if (scenario === "sc_sync_fail") {
					return failAll("SC API unavailable (mock scenario)")
				}
				await applyDelay(scenario)
				return await this.service.bulkScSync(enpUserId, input.actIds)
			} catch (e) {
				if (e instanceof ORPCError) throw e
				const msg = e instanceof Error ? e.message : String(e)
				return failAll(msg.slice(0, 500))
			}
		})
	}

	@Implement(v1.registry.refreshNotarizedDocument)
	async refreshNotarizedDocument(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.registry.refreshNotarizedDocument).handler(async ({ input, context }) => {
			const enpUserId = await resolveRegistryEnpUserId(session, context, this.service)
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Registry Notarized Document")
			return this.service.refreshActNotarizedDocument(enpUserId, input.id)
		})
	}

	@Implement(v1.registry.recordIncompleteAct)
	@AuditEvent({ eventType: "registry.incomplete_act_recorded", targetTable: "registry_acts" })
	async recordIncompleteAct(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.registry.recordIncompleteAct).handler(async ({ input, context }) => {
			const enpUserId = await resolveRegistryEnpUserId(session, context, this.service)
			applyCommonScenario(getMockScenario(req), "Registry Act")
			return this.service.recordIncompleteAct(enpUserId, input)
		})
	}

	@Implement(v1.registry.createEnbAccessRequest)
	@AuditEvent({
		eventType: "registry.enb_access_request_created",
		targetTable: "enb_access_requests",
	})
	async createEnbAccessRequest(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.registry.createEnbAccessRequest).handler(async ({ input, context }) => {
			const enpUserId = await resolveRegistryEnpUserId(session, context, this.service)
			applyCommonScenario(getMockScenario(req), "ENB Access Request")
			return this.service.createEnbAccessRequest(enpUserId, input)
		})
	}

	@Implement(v1.registry.decideEnbAccessRequest)
	@AuditEvent({
		eventType: "registry.enb_access_request_decided",
		targetTable: "enb_access_requests",
	})
	async decideEnbAccessRequest(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.registry.decideEnbAccessRequest).handler(async ({ input, context }) => {
			const enpUserId = await resolveRegistryEnpUserId(session, context, this.service)
			applyCommonScenario(getMockScenario(req), "ENB Access Request")
			return runOrpcHandler(() => this.service.decideEnbAccessRequest(enpUserId, input))
		})
	}

	@Implement(v1.registry.getProtestProceedings)
	async getProtestProceedings(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.registry.getProtestProceedings).handler(async ({ input, context }) => {
			const enpUserId = await resolveRegistryEnpUserId(session, context, this.service)
			applyCommonScenario(getMockScenario(req), "Protest Proceedings")
			return this.service.getProtestProceedings(enpUserId, input.id)
		})
	}

	@Implement(v1.registry.upsertProtestProceedings)
	@AuditEvent({
		eventType: "registry.protest_proceedings_saved",
		targetTable: "registry_protest_proceedings",
	})
	async upsertProtestProceedings(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.registry.upsertProtestProceedings).handler(async ({ input, context }) => {
			const enpUserId = await resolveRegistryEnpUserId(session, context, this.service)
			applyCommonScenario(getMockScenario(req), "Protest Proceedings")
			return this.service.upsertProtestProceedings(enpUserId, input)
		})
	}

	@Implement(v1.registry.submitMonthlyNotarialBook)
	@AuditEvent({
		eventType: "registry.monthly_book_submit_requested",
		targetTable: "registry_acts",
	})
	async submitMonthlyNotarialBook(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.registry.submitMonthlyNotarialBook).handler(async ({ input, context }) => {
			const enpUserId = await resolveRegistryEnpUserId(session, context, this.service)
			applyCommonScenario(getMockScenario(req), "Monthly Notarial Book Submit")
			return this.service.submitMonthlyNotarialBook(enpUserId, input)
		})
	}
}
