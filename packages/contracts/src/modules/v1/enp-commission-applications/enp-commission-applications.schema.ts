import { z } from "zod"

import { TimestampFields } from "../shared/schemas.js"

export const EnpCommissionApplicationStatusEnum = z.enum([
	"submitted",
	"under_review",
	"hearing_scheduled",
	"approved",
	"rejected",
])

export const EnpCommissionStatusEnum = z.enum(["active", "revoked", "resigned", "expired"])

export const CommissionHearingStatusEnum = z.enum(["scheduled", "in_session", "ended", "cancelled"])

export const EnpCommissionSchema = z.object({
	id: z.string(),
	applicationId: z.string(),
	commissionedName: z.string(),
	placeOfWork: z.string(),
	commissionDate: z.string(),
	termEndDate: z.string(),
	status: EnpCommissionStatusEnum,
	amNumber: z.string(),
	certificateFileObjectId: z.string().nullable(),
	issuedByUserId: z.string(),
	createdAt: z.string(),
})

export const EnpCommissionSummaryHearingSchema = z.object({
	scheduledAt: z.string().nullable(),
	/** Dedicated ENA commission hearing room. */
	roomId: z.string().nullable(),
	/** @deprecated Legacy qLegal appointment backing older hearing rows. */
	appointmentId: z.string().nullable(),
	/** In-app lobby path, e.g. /commission-hearings/{id}/lobby */
	lobbyPath: z.string().nullable(),
	instructions: z.string().nullable(),
	scheduledByUserId: z.string().nullable(),
})

export const EnpCommissionApplicationRequirementEnum = z.enum([
	"good_moral",
	"passport_photo",
	"filing_fee",
	"enf_video_certification",
])

export const EnpCommissionApplicationDocumentSchema = z.object({
	requirementKey: EnpCommissionApplicationRequirementEnum,
	fileObjectId: z.string(),
	mimeType: z.string(),
	sizeBytes: z.number().int().nonnegative(),
})

export const EnpCommissionApplicationSchema = z.object({
	id: z.string(),
	applicantUserId: z.string(),
	applicantName: z.string(),
	applicantEmail: z.string(),
	subOrgId: z.string(),
	subOrgName: z.string().nullable(),
	citizenship: z.string(),
	ulasComplianceNumber: z.string().nullable(),
	qualificationsStatement: z.string(),
	undertakingRules: z.boolean(),
	undertakingDataSharing: z.boolean(),
	status: EnpCommissionApplicationStatusEnum,
	decisionReason: z.string().nullable(),
	hearingStatus: CommissionHearingStatusEnum.nullable(),
	commission: EnpCommissionSchema.nullable(),
	submittedAt: z.string(),
	summaryHearing: EnpCommissionSummaryHearingSchema,
	documents: z.array(EnpCommissionApplicationDocumentSchema),
	...TimestampFields,
})

export const SubmitEnpCommissionApplicationSchema = z.object({
	citizenship: z.string().min(1).max(120),
	ulasComplianceNumber: z.string().max(120).optional(),
	qualificationsStatement: z.string().min(1).max(20_000),
	undertakingRules: z.literal(true),
	undertakingDataSharing: z.literal(true),
	documents: z.object({
		good_moral: z.string().min(1),
		passport_photo: z.string().min(1),
		filing_fee: z.string().min(1),
		enf_video_certification: z.string().min(1),
	}),
})

export const EnpCommissionApplicationIdSchema = z.object({
	id: z.coerce.string(),
})

export const ScheduleEnpCommissionSummaryHearingSchema = EnpCommissionApplicationIdSchema.extend({
	scheduledAt: z.string().datetime({ offset: true }),
	instructions: z.string().max(2000).optional(),
})

export const GrantEnpCommissionApplicationSchema = EnpCommissionApplicationIdSchema.extend({
	commissionedName: z.string().min(1).max(255),
	placeOfWork: z.string().min(1).max(500),
	commissionDate: z.string().datetime({ offset: true }).optional(),
	certificateFileObjectId: z.string().min(1).optional(),
})

export const DenyEnpCommissionApplicationSchema = EnpCommissionApplicationIdSchema.extend({
	reason: z.string().max(2000).optional(),
})

export type EnpCommission = z.infer<typeof EnpCommissionSchema>
export type EnpCommissionApplication = z.infer<typeof EnpCommissionApplicationSchema>
export type EnpCommissionApplicationDocument = z.infer<
	typeof EnpCommissionApplicationDocumentSchema
>
export type SubmitEnpCommissionApplication = z.infer<typeof SubmitEnpCommissionApplicationSchema>
export type ScheduleEnpCommissionSummaryHearing = z.infer<
	typeof ScheduleEnpCommissionSummaryHearingSchema
>
export type GrantEnpCommissionApplication = z.infer<typeof GrantEnpCommissionApplicationSchema>
export type DenyEnpCommissionApplication = z.infer<typeof DenyEnpCommissionApplicationSchema>
export type EnpCommissionSummaryHearing = z.infer<typeof EnpCommissionSummaryHearingSchema>
