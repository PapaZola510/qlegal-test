import { oc } from "@orpc/contract"

import {
	EmailVerificationStatusSchema,
	RequestEmailVerificationOtpResultSchema,
	VerifyEmailOtpInputSchema,
	VerifyEmailOtpResultSchema,
} from "./email-verification.schema.js"

/** Paths avoid `/auth/*` under `/api/v1` — Better Auth owns `/api/v1/auth/*`. */
export const emailVerificationContract = {
	status: oc
		.route({
			method: "GET",
			path: "/email/verification/status",
			summary: "Get current email verification/OTP status",
			tags: ["Email Verification"],
		})
		.output(EmailVerificationStatusSchema),

	requestOtp: oc
		.route({
			method: "POST",
			path: "/email/verification/request",
			summary: "Request email verification OTP",
			tags: ["Email Verification"],
		})
		.output(RequestEmailVerificationOtpResultSchema),

	verifyOtp: oc
		.route({
			method: "POST",
			path: "/email/verification/verify",
			summary: "Verify email OTP and mark email as verified",
			tags: ["Email Verification"],
		})
		.input(VerifyEmailOtpInputSchema)
		.output(VerifyEmailOtpResultSchema),
}
