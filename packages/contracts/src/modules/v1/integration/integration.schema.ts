import { z } from "zod"

export const LmsCourseProgressEnum = z.enum(["not_started", "in_progress", "completed"])

export const LmsDemoCredentialsSchema = z.object({
	email: z.string().email(),
	password: z.string(),
})

export type LmsDemoCredentials = z.infer<typeof LmsDemoCredentialsSchema>

/** Draft §1–§3 handoff: upsert + enroll + SSO code → browser opens `redirectUrl`. */
export const StartLmsTrainingResponseSchema = z.object({
	redirectUrl: z.string().url(),
	classCode: z.string(),
	alreadyEnrolled: z.boolean(),
	codeExpiresInSeconds: z.number().int().positive(),
	/** Actual browser handoff used (`hmac` = signed auto-login URL). */
	ssoHandoffMode: z.enum(["hmac", "create_code"]),
	demoCredentials: LmsDemoCredentialsSchema.nullable(),
})

/** Draft §4 progress/query (QLegal read model). */
export const LmsTrainingProgressSchema = z.object({
	enrolled: z.boolean(),
	classCode: z.string().nullable(),
	progressPercent: z.number().int().min(0).max(100),
	completion: LmsCourseProgressEnum,
	passed: z.boolean(),
	lastAccessedAt: z.string().nullable(),
})

export const LmsTrainingCertificateSchema = z.discriminatedUnion("issued", [
	z.object({ issued: z.literal(false) }),
	z.object({
		issued: z.literal(true),
		certificateNumber: z.string(),
		issuedAt: z.string(),
		downloadUrl: z.string().url(),
		verifyUrl: z.string().url(),
	}),
])

export const SimulateLmsCompletionResponseSchema = z.object({
	success: z.literal(true),
	certificateId: z.string(),
})

export const SyncLmsCourseCompletionResponseSchema = z.object({
	completed: z.boolean(),
})

/** Draft §1 + §2 only: ensure QLearn user + class enrollment (no SSO redirect). */
export const SyncAccountToLmsResponseSchema = z.object({
	success: z.literal(true),
	lmsUserId: z.string(),
	upsertAction: z.enum(["created", "updated"]),
	classCode: z.string(),
	alreadyEnrolled: z.boolean(),
})

export type StartLmsTrainingResponse = z.infer<typeof StartLmsTrainingResponseSchema>
export type LmsTrainingProgress = z.infer<typeof LmsTrainingProgressSchema>
export type LmsTrainingCertificate = z.infer<typeof LmsTrainingCertificateSchema>
export type SyncAccountToLmsResponse = z.infer<typeof SyncAccountToLmsResponseSchema>
