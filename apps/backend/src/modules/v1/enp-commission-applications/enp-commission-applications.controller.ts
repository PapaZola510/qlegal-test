import { Controller, Req } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { v1 } from "@/config/api-versions.config"

import { EnpCommissionApplicationsService } from "./enp-commission-applications.service"

function readQlegal(context: unknown): QlegalSessionContext | null {
	return (context as { qlegal: QlegalSessionContext | null }).qlegal
}

function requireAuthSession(session: UserSession): string {
	const userId = session.user?.id
	if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
	return userId
}

function resolveQlegalContext(
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
export class EnpCommissionApplicationsController {
	constructor(private readonly service: EnpCommissionApplicationsService) {}

	@Implement(v1.enpCommissionApplication.submit)
	async submit(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.enpCommissionApplication.submit).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session, req)
			return this.service.submit(qlegal, input)
		})
	}

	@Implement(v1.enpCommissionApplication.listMine)
	async listMine(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.enpCommissionApplication.listMine).handler(async ({ context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session, req)
			return this.service.listMine(qlegal)
		})
	}

	@Implement(v1.enpCommissionApplication.listForReview)
	async listForReview(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.enpCommissionApplication.listForReview).handler(async ({ context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session, req)
			return this.service.listForReview(qlegal)
		})
	}

	@Implement(v1.enpCommissionApplication.get)
	async get(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.enpCommissionApplication.get).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session, req)
			return this.service.getOne(qlegal, input.id)
		})
	}

	@Implement(v1.enpCommissionApplication.scheduleSummaryHearing)
	async scheduleSummaryHearing(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.enpCommissionApplication.scheduleSummaryHearing).handler(
			async ({ input, context }) => {
				requireAuthSession(session)
				const qlegal = resolveQlegalContext(context, session, req)
				return this.service.scheduleSummaryHearing(qlegal, input)
			}
		)
	}

	@Implement(v1.enpCommissionApplication.grant)
	async grant(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.enpCommissionApplication.grant).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session, req)
			return this.service.grant(qlegal, input)
		})
	}

	@Implement(v1.enpCommissionApplication.deny)
	async deny(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.enpCommissionApplication.deny).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session, req)
			return this.service.deny(qlegal, input)
		})
	}

	@Implement(v1.enpCommissionApplication.getCommission)
	async getCommission(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.enpCommissionApplication.getCommission).handler(
			async ({ input, context }) => {
				requireAuthSession(session)
				const qlegal = resolveQlegalContext(context, session, req)
				return this.service.getCommission(qlegal, input)
			}
		)
	}
}
