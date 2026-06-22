import { Controller, Req } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import { getClientIp } from "@/common/http/client-ip"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { v1 } from "@/config/api-versions.config"

import { EmailMfaService } from "./email-mfa.service"

@Controller()
export class EmailMfaController {
	constructor(private readonly service: EmailMfaService) {}

	@Implement(v1.emailMfa.status)
	async status(@Session() session: UserSession, @Req() req: Request) {
		return implement(v1.emailMfa.status).handler(async ({ context }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			const q =
				(context as { qlegal: QlegalSessionContext | null }).qlegal ?? req.qlegalSessionContext
			if (!q?.sessionId) throw new ORPCError("UNAUTHORIZED", { message: "Session required" })
			return this.service.getStatus({ userId, sessionId: q.sessionId })
		})
	}

	@Implement(v1.emailMfa.requestOtp)
	async requestOtp(@Session() session: UserSession, @Req() req: Request) {
		return implement(v1.emailMfa.requestOtp).handler(async ({ context }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			const q =
				(context as { qlegal: QlegalSessionContext | null }).qlegal ?? req.qlegalSessionContext
			if (!q?.sessionId) throw new ORPCError("UNAUTHORIZED", { message: "Session required" })
			return this.service.requestOtp({
				userId,
				sessionId: q.sessionId,
				requestIp: getClientIp(req),
			})
		})
	}

	@Implement(v1.emailMfa.verifyOtp)
	async verifyOtp(@Session() session: UserSession, @Req() req: Request) {
		return implement(v1.emailMfa.verifyOtp).handler(async ({ input, context }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			const q =
				(context as { qlegal: QlegalSessionContext | null }).qlegal ?? req.qlegalSessionContext
			if (!q?.sessionId) throw new ORPCError("UNAUTHORIZED", { message: "Session required" })
			return this.service.verifyOtp({ userId, sessionId: q.sessionId, otp: input.otp })
		})
	}
}
