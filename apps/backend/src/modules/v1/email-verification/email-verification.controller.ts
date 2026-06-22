import { Controller, Req } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import { getClientIp } from "@/common/http/client-ip"
import { v1 } from "@/config/api-versions.config"

import { EmailVerificationService } from "./email-verification.service"

@Controller()
export class EmailVerificationController {
	constructor(private readonly service: EmailVerificationService) {}

	@Implement(v1.emailVerification.status)
	async status(@Session() session: UserSession) {
		return implement(v1.emailVerification.status).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.getStatus({ userId })
		})
	}

	@Implement(v1.emailVerification.requestOtp)
	async requestOtp(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.emailVerification.requestOtp).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.requestOtp({ userId, requestIp: getClientIp(req) })
		})
	}

	@Implement(v1.emailVerification.verifyOtp)
	async verifyOtp(@Session() session: UserSession) {
		return implement(v1.emailVerification.verifyOtp).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.verifyOtp({ userId, otp: input.otp })
		})
	}
}
