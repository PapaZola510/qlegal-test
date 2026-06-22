import { oc } from "@orpc/contract"

import {
	EmailMfaStatusSchema,
	RequestEmailMfaOtpResultSchema,
	VerifyEmailMfaOtpInputSchema,
	VerifyEmailMfaOtpResultSchema,
} from "./email-mfa.schema.js"

export const emailMfaContract = {
	status: oc
		.route({
			method: "GET",
			path: "/email/mfa/status",
			summary: "Get current email MFA status for this session",
			tags: ["Email MFA"],
		})
		.output(EmailMfaStatusSchema),

	requestOtp: oc
		.route({
			method: "POST",
			path: "/email/mfa/request",
			summary: "Request email MFA OTP for this session",
			tags: ["Email MFA"],
		})
		.output(RequestEmailMfaOtpResultSchema),

	verifyOtp: oc
		.route({
			method: "POST",
			path: "/email/mfa/verify",
			summary: "Verify email MFA OTP and mark session as MFA verified",
			tags: ["Email MFA"],
		})
		.input(VerifyEmailMfaOtpInputSchema)
		.output(VerifyEmailMfaOtpResultSchema),
}
