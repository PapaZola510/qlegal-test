import { z } from "zod"

export const RequestEmailMfaOtpResultSchema = z.object({
	expiresAt: z.string(),
	resendAvailableAt: z.string(),
})

export const EmailMfaStatusSchema = z.object({
	mfaVerified: z.boolean(),
	expiresAt: z.string().nullable(),
	resendAvailableAt: z.string().nullable(),
})

export const VerifyEmailMfaOtpInputSchema = z.object({
	otp: z.string().regex(/^\d{6}$/),
})

export const VerifyEmailMfaOtpResultSchema = z.object({
	ok: z.literal(true),
})

export type RequestEmailMfaOtpResult = z.infer<typeof RequestEmailMfaOtpResultSchema>
export type EmailMfaStatus = z.infer<typeof EmailMfaStatusSchema>
export type VerifyEmailMfaOtpInput = z.infer<typeof VerifyEmailMfaOtpInputSchema>
export type VerifyEmailMfaOtpResult = z.infer<typeof VerifyEmailMfaOtpResultSchema>
