import { Controller, Req } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { v1 } from "@/config/api-versions.config"

import { IenAttestationService } from "../ien-attestation/ien-attestation.service"
import {
	applyCommonScenario,
	applyQuicksignPlotScenario,
	getMockScenario,
} from "../mock-data/mock-scenario.util"
import { QuicksignService } from "./quicksign.service"

function readQlegal(context: unknown): QlegalSessionContext | null {
	return (context as { qlegal: QlegalSessionContext | null }).qlegal
}

/**
 * oRPC resolves `context.qlegal` from cookies via {@link SessionContextService}.
 * The `@Session()` decorator can be empty on the same request (e.g. after a successful `/files` upload),
 * so prefer `qlegal` / middleware hydration and only fall back to Better Auth session when needed.
 */
function resolveQlegalAuth(
	context: unknown,
	session: UserSession,
	req: Request
): QlegalSessionContext {
	const qlegal = readQlegal(context) ?? req.qlegalSessionContext ?? null
	const sessionUserId = session.user?.id ?? null

	if (qlegal?.userId) {
		if (sessionUserId && sessionUserId !== qlegal.userId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Session context does not match authenticated user",
			})
		}
		return qlegal
	}

	if (!sessionUserId) {
		throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
	}

	return {
		userId: sessionUserId,
		sessionId: "unknown",
		role: "none",
		subOrgIds: [],
		complianceAuditAccess: false,
	}
}

@Controller()
export class QuicksignController {
	constructor(
		private readonly service: QuicksignService,
		private readonly ienAttestation: IenAttestationService
	) {}

	@Implement(v1.quicksign.list)
	async list(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.quicksign.list).handler(async ({ context }) => {
			const scenario = getMockScenario(req)
			if (scenario === "empty") return []
			applyCommonScenario(scenario, "QuickSign Projects")
			const qlegal = resolveQlegalAuth(context, session, req)
			return this.service.list(qlegal)
		})
	}

	@Implement(v1.quicksign.get)
	async get(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.quicksign.get).handler(async ({ input, context }) => {
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "QuickSign Project")
			const qlegal = resolveQlegalAuth(context, session, req)
			return this.service.getOne(qlegal, input.id)
		})
	}

	@Implement(v1.quicksign.create)
	async create(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.quicksign.create).handler(async ({ input, context }) => {
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "QuickSign Project")
			const qlegal = resolveQlegalAuth(context, session, req)
			return this.service.create(qlegal, input)
		})
	}

	@Implement(v1.quicksign.addSigner)
	async addSigner(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.quicksign.addSigner).handler(async ({ input, context }) => {
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "QuickSign Project")
			const qlegal = resolveQlegalAuth(context, session, req)
			return this.service.addSigner(qlegal, input)
		})
	}

	@Implement(v1.quicksign.getPlotLink)
	async getPlotLink(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.quicksign.getPlotLink).handler(async ({ input, context }) => {
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "QuickSign Project")
			applyQuicksignPlotScenario(scenario)
			const qlegal = resolveQlegalAuth(context, session, req)
			return this.service.getPlotLink(qlegal, input.id)
		})
	}

	@Implement(v1.quicksign.completePlotting)
	async completePlotting(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.quicksign.completePlotting).handler(async ({ input, context }) => {
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "QuickSign Project")
			const qlegal = resolveQlegalAuth(context, session, req)
			return this.service.completePlotting(qlegal, input.id)
		})
	}

	@Implement(v1.quicksign.retryDcProject)
	async retryDcProject(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.quicksign.retryDcProject).handler(async ({ input, context }) => {
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "QuickSign Project")
			const qlegal = resolveQlegalAuth(context, session, req)
			return this.service.retryDcProject(qlegal, input.id)
		})
	}

	@Implement(v1.quicksign.recordIenAttestation)
	async recordIenAttestation(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.quicksign.recordIenAttestation).handler(async ({ input, context }) => {
			applyCommonScenario(getMockScenario(req), "QuickSign Project")
			const qlegal = resolveQlegalAuth(context, session, req)
			return this.ienAttestation.recordQuicksignEnpAttestation(
				qlegal,
				input.id,
				input.notarizationType
			)
		})
	}

	@Implement(v1.quicksign.listIenAttestations)
	async listIenAttestations(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.quicksign.listIenAttestations).handler(async ({ input, context }) => {
			applyCommonScenario(getMockScenario(req), "QuickSign Project")
			const qlegal = resolveQlegalAuth(context, session, req)
			if (!qlegal?.userId)
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			await this.service.getOne(qlegal, input.id)
			return this.ienAttestation.listForProject(input.id)
		})
	}

	@Implement(v1.quicksign.saveSignatureFields)
	async saveSignatureFields(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.quicksign.saveSignatureFields).handler(async ({ input, context }) => {
			applyCommonScenario(getMockScenario(req), "QuickSign Project")
			const qlegal = resolveQlegalAuth(context, session, req)
			return this.service.saveSignatureFields(qlegal, input.id, input.fields)
		})
	}

	@Implement(v1.quicksign.getSignatureFields)
	async getSignatureFields(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.quicksign.getSignatureFields).handler(async ({ input, context }) => {
			applyCommonScenario(getMockScenario(req), "QuickSign Project")
			const qlegal = resolveQlegalAuth(context, session, req)
			return this.service.getSignatureFields(qlegal, input.id)
		})
	}

	@Implement(v1.quicksign.stampSignature)
	async stampSignature(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.quicksign.stampSignature).handler(
			async ({ input, context }) => {
				applyCommonScenario(getMockScenario(req), "QuickSign Project")
				const qlegal = resolveQlegalAuth(context, session, req)
				return this.service.stampSignature(
					qlegal,
					input.id,
					input.signerEmail,
					input.signaturePngBase64
				)
			}
		)
	}

	@Implement(v1.quicksign.finalize)
	async finalize(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.quicksign.finalize).handler(async ({ input, context }) => {
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "QuickSign Project")
			const qlegal = resolveQlegalAuth(context, session, req)
			return this.service.finalize(qlegal, input)
		})
	}
}
