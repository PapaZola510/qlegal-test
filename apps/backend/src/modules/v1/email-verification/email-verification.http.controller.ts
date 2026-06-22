import { Body, Controller, Get, Post, Req } from "@nestjs/common"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import { getClientIp } from "@/common/http/client-ip"

import { EmailVerificationService } from "./email-verification.service"

/**
 * Plain NestJS HTTP controller for email verification endpoints.
 *
 * This exists as a compatibility layer so the web app can call
 * `/api/v1/email/verification/*` even if oRPC route registration is not active.
 */
@Controller({ path: "email/verification", version: "1" })
export class EmailVerificationHttpController {
	constructor(private readonly service: EmailVerificationService) {}

	@Get("status")
	async status(@Session() session: UserSession) {
		const userId = session.user?.id
		if (!userId) return { emailVerified: false, expiresAt: null, resendAvailableAt: null }
		return this.service.getStatus({ userId })
	}

	@Post("request")
	async requestOtp(@Req() req: Request, @Session() session: UserSession) {
		const userId = session.user?.id
		if (!userId)
			return { expiresAt: new Date(0).toISOString(), resendAvailableAt: new Date(0).toISOString() }
		return this.service.requestOtp({ userId, requestIp: getClientIp(req) })
	}

	@Post("verify")
	async verifyOtp(@Body() body: { otp?: string }, @Session() session: UserSession) {
		const userId = session.user?.id
		if (!userId) return { ok: false }
		return this.service.verifyOtp({ userId, otp: String(body?.otp ?? "") })
	}
}
