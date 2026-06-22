import { z } from "zod"

export const RequestEmailVerificationOtpResultSchema = z.object({
	expiresAt: z.string(),
	resendAvailableAt: z.string(),
})

export const EmailVerificationStatusSchema = z.object({
	emailVerified: z.boolean(),
	expiresAt: z.string().nullable(),
	resendAvailableAt: z.string().nullable(),
})

export const VerifyEmailOtpInputSchema = z.object({
	otp: z.string().regex(/^\d{6}$/),
})

export const VerifyEmailOtpResultSchema = z.object({
	ok: z.literal(true),
})

export type RequestEmailVerificationOtpResult = z.infer<
	typeof RequestEmailVerificationOtpResultSchema
>
export type EmailVerificationStatus = z.infer<typeof EmailVerificationStatusSchema>
export type VerifyEmailOtpInput = z.infer<typeof VerifyEmailOtpInputSchema>
export type VerifyEmailOtpResult = z.infer<typeof VerifyEmailOtpResultSchema>
