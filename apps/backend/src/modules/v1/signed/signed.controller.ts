import { Controller, Req } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { v1 } from "@/config/api-versions.config"

import { SignedService } from "./signed.service"

function readQlegal(context: unknown): QlegalSessionContext | null {
	return (context as { qlegal: QlegalSessionContext | null }).qlegal
}

/**
 * Prefer oRPC `context.qlegal` and middleware `req.qlegalSessionContext` so role is not stuck at `none`.
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
export class SignedController {
	constructor(private readonly service: SignedService) {}

	@Implement(v1.signed.listDocuments)
	async listDocuments(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.signed.listDocuments).handler(async ({ context }) => {
			const ctx = resolveQlegalAuth(context, session, req)
			return this.service.listDocuments(ctx)
		})
	}

	@Implement(v1.signed.requestCertifiedTrueCopy)
	async requestCertifiedTrueCopy(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.signed.requestCertifiedTrueCopy).handler(async ({ input, context }) => {
			const ctx = resolveQlegalAuth(context, session, req)
			return this.service.requestCertifiedTrueCopy(ctx, input)
		})
	}

	@Implement(v1.signed.getCtcPaymentStatus)
	async getCtcPaymentStatus(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.signed.getCtcPaymentStatus).handler(async ({ input, context }) => {
			const ctx = resolveQlegalAuth(context, session, req)
			return this.service.getCtcPaymentStatus(ctx, input.requestId)
		})
	}

	@Implement(v1.signed.listCtcPaymentBrands)
	async listCtcPaymentBrands(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.signed.listCtcPaymentBrands).handler(async ({ input, context }) => {
			const ctx = resolveQlegalAuth(context, session, req)
			return this.service.listCtcPaymentBrands(ctx, input.requestId)
		})
	}

	@Implement(v1.signed.createCtcPayment)
	async createCtcPayment(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.signed.createCtcPayment).handler(async ({ input, context }) => {
			const ctx = resolveQlegalAuth(context, session, req)
			return this.service.createCtcPayment(ctx, input.requestId, input.paymentOptionCode)
		})
	}

	@Implement(v1.signed.simulateCtcPayment)
	async simulateCtcPayment(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.signed.simulateCtcPayment).handler(async ({ input, context }) => {
			const ctx = resolveQlegalAuth(context, session, req)
			return this.service.simulateCtcPayment(ctx, input.requestId)
		})
	}
}
