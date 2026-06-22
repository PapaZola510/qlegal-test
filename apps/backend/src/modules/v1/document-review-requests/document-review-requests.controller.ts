import { Controller, Req } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { v1 } from "@/config/api-versions.config"

import { DocumentReviewRequestsService } from "./document-review-requests.service"

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
export class DocumentReviewRequestsController {
	constructor(private readonly service: DocumentReviewRequestsService) {}

	@Implement(v1.documentReviewRequest.list)
	async list(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.documentReviewRequest.list).handler(async ({ context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session, req)
			return this.service.list(qlegal)
		})
	}

	@Implement(v1.documentReviewRequest.get)
	async get(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.documentReviewRequest.get).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session, req)
			return this.service.getOne(qlegal, input.id)
		})
	}

	@Implement(v1.documentReviewRequest.create)
	async create(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.documentReviewRequest.create).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session, req)
			return this.service.create(qlegal, input)
		})
	}

	@Implement(v1.documentReviewRequest.approve)
	async approve(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.documentReviewRequest.approve).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session, req)
			return this.service.approve(qlegal, input)
		})
	}

	@Implement(v1.documentReviewRequest.advanceQuicksign)
	async advanceQuicksign(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.documentReviewRequest.advanceQuicksign).handler(
			async ({ input, context }) => {
				requireAuthSession(session)
				const qlegal = resolveQlegalContext(context, session, req)
				return this.service.advanceQuicksign(qlegal, input.id)
			}
		)
	}

	@Implement(v1.documentReviewRequest.reject)
	async reject(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.documentReviewRequest.reject).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session, req)
			return this.service.reject(qlegal, input.id, input.rejectionReason)
		})
	}

	@Implement(v1.documentReviewRequest.cancel)
	async cancel(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.documentReviewRequest.cancel).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session, req)
			return this.service.cancel(qlegal, input.id)
		})
	}
}
