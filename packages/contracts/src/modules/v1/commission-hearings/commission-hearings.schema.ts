import { z } from "zod"

import { TimestampFields } from "../shared/schemas.js"

export const CommissionHearingStatusEnum = z.enum(["scheduled", "in_session", "ended", "cancelled"])

export const CommissionHearingParticipantRoleEnum = z.enum([
	"admin",
	"applicant",
	"hearing_oppositor",
])

export const CommissionHearingOppositionStatusEnum = z.enum([
	"filed",
	"forwarded",
	"access_granted",
	"appeared",
	"denied_no_show",
	"sustained",
	"overruled",
])

export const CommissionHearingSchema = z.object({
	id: z.string(),
	applicationId: z.string(),
	enaUserId: z.string(),
	applicantUserId: z.string(),
	applicantName: z.string(),
	applicantEmail: z.string().email(),
	livekitRoomName: z.string(),
	scheduledAt: z.string().nullable(),
	instructions: z.string().nullable(),
	status: CommissionHearingStatusEnum,
	startedAt: z.string().nullable(),
	endedAt: z.string().nullable(),
	recordingActive: z.boolean(),
	paymentRequired: z.boolean(),
	paymentStatus: z.enum(["none", "pending", "processing", "succeeded", "failed"]),
	lobbyPath: z.string(),
	verificationAppointmentId: z.string().nullable(),
	...TimestampFields,
})

export const CommissionHearingPaymentStatusSchema = z.object({
	hearingRoomId: z.string(),
	amountPhp: z.number().int(),
	required: z.boolean(),
	paid: z.boolean(),
	status: z.enum(["none", "pending", "processing", "succeeded", "failed"]),
	paymentIntentId: z.string().nullable(),
	qrCode: z.string().nullable(),
	checkoutUrl: z.string().nullable(),
	sandboxTestMode: z.boolean(),
	paidAt: z.string().nullable(),
})

export const CommissionHearingIdSchema = z.object({
	id: z.coerce.string(),
})

export const CommissionHearingOppositionApplicationIdSchema = z.object({
	applicationId: z.coerce.string(),
})

export const CommissionHearingOppositionIdSchema = CommissionHearingIdSchema.extend({
	oppositionId: z.coerce.string(),
})

export const ScheduleCommissionHearingSchema = z.object({
	applicationId: z.coerce.string(),
	scheduledAt: z.string().datetime({ offset: true }),
	instructions: z.string().max(2000).optional(),
})

export const CommissionHearingJoinTokenSchema = z.object({
	token: z.string(),
	livekitUrl: z.string(),
	livekitRoomName: z.string(),
	hearingRoomId: z.string(),
	participantRole: CommissionHearingParticipantRoleEnum,
	displayName: z.string(),
})

export const CommissionHearingJoinTokenInputSchema = CommissionHearingIdSchema.extend({
	oppositionToken: z.string().min(8).optional(),
})

export const InviteCommissionApplicantSchema = CommissionHearingIdSchema.extend({
	sendEmail: z.boolean().default(true),
	recipientEmail: z.string().email().optional(),
})

export const InviteCommissionApplicantResultSchema = z.object({
	inviteUrl: z.string(),
	expiresAt: z.string(),
})

export const CommissionHearingLobbyCheckInputSchema = CommissionHearingIdSchema.extend({
	inviteToken: z.string().min(8).optional(),
	oppositionToken: z.string().min(8).optional(),
})

export const CommissionHearingLobbyCheckResultSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("unauthenticated") }),
	z.object({ kind: z.literal("not_found") }),
	z.object({ kind: z.literal("forbidden") }),
	z.object({ kind: z.literal("wrong_status"), status: CommissionHearingStatusEnum }),
	z.object({ kind: z.literal("session_ended") }),
	z.object({ kind: z.literal("invite_invalid") }),
	z.object({ kind: z.literal("invite_expired") }),
	z.object({
		kind: z.literal("ok"),
		hearingRoomId: z.string(),
		livekitRoomName: z.string(),
		participantRole: CommissionHearingParticipantRoleEnum,
		displayName: z.string(),
		applicantName: z.string(),
		scheduledAt: z.string().nullable(),
		status: CommissionHearingStatusEnum,
		verificationAppointmentId: z.string().nullable(),
	}),
])

export const CommissionHearingChatMessageSchema = z.object({
	id: z.string(),
	hearingRoomId: z.string(),
	senderUserId: z.string(),
	senderName: z.string(),
	body: z.string(),
	createdAt: z.string(),
})

export const CommissionHearingOppositionSchema = z.object({
	id: z.string(),
	applicationId: z.string(),
	hearingRoomId: z.string().nullable(),
	oppositorName: z.string(),
	oppositorEmail: z.string().email(),
	oppositorUserId: z.string().nullable(),
	grounds: z.string(),
	verifiedDocumentFileObjectId: z.string(),
	representativeDocumentFileObjectId: z.string().nullable(),
	status: CommissionHearingOppositionStatusEnum,
	nonAppearanceExcused: z.boolean(),
	createdAt: z.string(),
})

export const FileCommissionHearingOppositionSchema =
	CommissionHearingOppositionApplicationIdSchema.extend({
		oppositorName: z.string().min(1).max(255),
		oppositorEmail: z.string().email(),
		grounds: z.string().min(1).max(20_000),
		verifiedDocumentFileObjectId: z.string().min(1),
		representativeDocumentFileObjectId: z.string().min(1).optional(),
	})

export const DecideCommissionHearingOppositionSchema = CommissionHearingOppositionIdSchema.extend({
	outcome: z.enum(["sustained", "overruled", "denied_no_show"]),
	excused: z.boolean().optional(),
})

export const SendCommissionHearingChatSchema = CommissionHearingIdSchema.extend({
	body: z.string().min(1).max(4000),
})

export const CommissionHearingRecordingStartedSchema = CommissionHearingIdSchema.extend({
	egressId: z.string().optional(),
	startedAt: z.string().datetime({ offset: true }).optional(),
})

export const CommissionHearingRecordingStoppedSchema = CommissionHearingIdSchema.extend({
	egressId: z.string().optional(),
	fileObjectId: z.string().optional(),
	stoppedAt: z.string().datetime({ offset: true }).optional(),
})

export type CommissionHearingStatus = z.infer<typeof CommissionHearingStatusEnum>
export type CommissionHearingParticipantRole = z.infer<typeof CommissionHearingParticipantRoleEnum>
export type CommissionHearingOppositionStatus = z.infer<
	typeof CommissionHearingOppositionStatusEnum
>
export type CommissionHearing = z.infer<typeof CommissionHearingSchema>
export type CommissionHearingPaymentStatus = z.infer<typeof CommissionHearingPaymentStatusSchema>
export type CommissionHearingId = z.infer<typeof CommissionHearingIdSchema>
export type ScheduleCommissionHearing = z.infer<typeof ScheduleCommissionHearingSchema>
export type CommissionHearingOppositionApplicationId = z.infer<
	typeof CommissionHearingOppositionApplicationIdSchema
>
export type CommissionHearingOppositionId = z.infer<typeof CommissionHearingOppositionIdSchema>
export type CommissionHearingJoinToken = z.infer<typeof CommissionHearingJoinTokenSchema>
export type CommissionHearingJoinTokenInput = z.infer<typeof CommissionHearingJoinTokenInputSchema>
export type InviteCommissionApplicant = z.infer<typeof InviteCommissionApplicantSchema>
export type InviteCommissionApplicantResult = z.infer<typeof InviteCommissionApplicantResultSchema>
export type CommissionHearingLobbyCheckInput = z.infer<
	typeof CommissionHearingLobbyCheckInputSchema
>
export type CommissionHearingLobbyCheckResult = z.infer<
	typeof CommissionHearingLobbyCheckResultSchema
>
export type CommissionHearingChatMessage = z.infer<typeof CommissionHearingChatMessageSchema>
export type CommissionHearingOpposition = z.infer<typeof CommissionHearingOppositionSchema>
export type FileCommissionHearingOpposition = z.infer<typeof FileCommissionHearingOppositionSchema>
export type DecideCommissionHearingOpposition = z.infer<
	typeof DecideCommissionHearingOppositionSchema
>
export type SendCommissionHearingChat = z.infer<typeof SendCommissionHearingChatSchema>
export type CommissionHearingRecordingStarted = z.infer<
	typeof CommissionHearingRecordingStartedSchema
>
export type CommissionHearingRecordingStopped = z.infer<
	typeof CommissionHearingRecordingStoppedSchema
>
