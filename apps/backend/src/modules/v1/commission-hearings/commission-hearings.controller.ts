import { Controller, Req } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { v1 } from "@/config/api-versions.config"

import { CommissionHearingsService } from "./commission-hearings.service"

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
	if (!sessionUserId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
	return {
		userId: sessionUserId,
		sessionId: "unknown",
		role: "none",
		subOrgIds: [],
		complianceAuditAccess: false,
	}
}

@Controller()
export class CommissionHearingsController {
	constructor(private readonly service: CommissionHearingsService) {}

	@Implement(v1.commissionHearing.get)
	async get(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.get).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.getOne(resolveQlegalContext(context, session, req), input.id)
		})
	}

	@Implement(v1.commissionHearing.listMine)
	async listMine(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.listMine).handler(async ({ context }) => {
			requireAuthSession(session)
			return this.service.listMine(resolveQlegalContext(context, session, req))
		})
	}

	@Implement(v1.commissionHearing.listForAdmin)
	async listForAdmin(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.listForAdmin).handler(async ({ context }) => {
			requireAuthSession(session)
			return this.service.listForAdmin(resolveQlegalContext(context, session, req))
		})
	}

	@Implement(v1.commissionHearing.openSession)
	async openSession(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.openSession).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.openSession(resolveQlegalContext(context, session, req), input.id)
		})
	}

	@Implement(v1.commissionHearing.endSession)
	async endSession(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.endSession).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.endSession(resolveQlegalContext(context, session, req), input.id)
		})
	}

	@Implement(v1.commissionHearing.issueJoinToken)
	async issueJoinToken(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.issueJoinToken).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.issueJoinToken(resolveQlegalContext(context, session, req), {
				id: String(input.id),
				oppositionToken: input.oppositionToken,
			})
		})
	}

	@Implement(v1.commissionHearing.inviteApplicant)
	async inviteApplicant(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.inviteApplicant).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.inviteApplicant(resolveQlegalContext(context, session, req), input)
		})
	}

	@Implement(v1.commissionHearing.lobbyCheck)
	async lobbyCheck(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.lobbyCheck).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.lobbyCheck(resolveQlegalContext(context, session, req), input)
		})
	}

	@Implement(v1.commissionHearing.recordingStarted)
	async recordingStarted(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.recordingStarted).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.recordingStarted(resolveQlegalContext(context, session, req), input)
		})
	}

	@Implement(v1.commissionHearing.recordingStopped)
	async recordingStopped(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.recordingStopped).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.recordingStopped(resolveQlegalContext(context, session, req), input)
		})
	}

	@Implement(v1.commissionHearing.getPaymentStatus)
	async getPaymentStatus(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.getPaymentStatus).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.getHearingPaymentStatus(
				resolveQlegalContext(context, session, req),
				input.id
			)
		})
	}

	@Implement(v1.commissionHearing.createPayment)
	async createPayment(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.createPayment).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.createHearingPayment(
				resolveQlegalContext(context, session, req),
				input.id
			)
		})
	}

	@Implement(v1.commissionHearing.simulatePayment)
	async simulatePayment(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.simulatePayment).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.simulateHearingPayment(
				resolveQlegalContext(context, session, req),
				input.id
			)
		})
	}

	@Implement(v1.commissionHearing.listChat)
	async listChat(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.listChat).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.listChat(resolveQlegalContext(context, session, req), input.id)
		})
	}

	@Implement(v1.commissionHearing.sendChat)
	async sendChat(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.sendChat).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.sendChat(
				resolveQlegalContext(context, session, req),
				input.id,
				input.body
			)
		})
	}

	@Implement(v1.commissionHearing.fileOpposition)
	async fileOpposition(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.fileOpposition).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.fileOpposition(resolveQlegalContext(context, session, req), {
				...input,
				applicationId: String(input.applicationId),
			})
		})
	}

	@Implement(v1.commissionHearing.listOppositions)
	async listOppositions(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.listOppositions).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.listOppositions(
				resolveQlegalContext(context, session, req),
				String(input.applicationId)
			)
		})
	}

	@Implement(v1.commissionHearing.forwardOpposition)
	async forwardOpposition(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.forwardOpposition).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.forwardOpposition(resolveQlegalContext(context, session, req), {
				id: String(input.id),
				oppositionId: String(input.oppositionId),
			})
		})
	}

	@Implement(v1.commissionHearing.grantOppositorAccess)
	async grantOppositorAccess(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.grantOppositorAccess).handler(
			async ({ input, context }) => {
				requireAuthSession(session)
				return this.service.grantOppositorAccess(resolveQlegalContext(context, session, req), {
					id: String(input.id),
					oppositionId: String(input.oppositionId),
				})
			}
		)
	}

	@Implement(v1.commissionHearing.decideOpposition)
	async decideOpposition(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.commissionHearing.decideOpposition).handler(async ({ input, context }) => {
			requireAuthSession(session)
			return this.service.decideOpposition(resolveQlegalContext(context, session, req), {
				...input,
				id: String(input.id),
				oppositionId: String(input.oppositionId),
			})
		})
	}
}
