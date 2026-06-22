import { Controller, Req } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { v1 } from "@/config/api-versions.config"
import { AuditEvent } from "@/shared/decorators/audit-event.decorator"

import { EnbAccessService } from "./enb-access.service"

function resolveQlegalAuth(
	context: unknown,
	session: UserSession,
	req: Request
): QlegalSessionContext {
	const qlegal =
		(context as { qlegal: QlegalSessionContext | null }).qlegal ?? req.qlegalSessionContext ?? null
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
export class EnbAccessController {
	constructor(private readonly service: EnbAccessService) {}

	@Implement(v1.enbAccess.lookupEntry)
	async lookupEntry(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.enbAccess.lookupEntry).handler(async ({ input, context }) => {
			const ctx = resolveQlegalAuth(context, session, req)
			return this.service.lookupEntry(ctx, input)
		})
	}

	@Implement(v1.enbAccess.submitVirtualRequest)
	@AuditEvent({
		eventType: "enb.virtual_access_request_created",
		targetTable: "enb_access_requests",
	})
	async submitVirtualRequest(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.enbAccess.submitVirtualRequest).handler(async ({ input, context }) => {
			const ctx = resolveQlegalAuth(context, session, req)
			return this.service.submitVirtualRequest(ctx, input)
		})
	}

	@Implement(v1.enbAccess.listMyRequests)
	async listMyRequests(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.enbAccess.listMyRequests).handler(async ({ context }) => {
			const ctx = resolveQlegalAuth(context, session, req)
			return this.service.listMyRequests(ctx)
		})
	}
}
