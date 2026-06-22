import { z } from "zod"

import {
	AppointmentNotarizationTypeEnum,
	AppointmentSchema,
	AppointmentSessionModeEnum,
} from "../appointments/appointments.schema.js"
import { TimestampFields } from "../shared/schemas.js"

export const DocumentReviewRequestStatusEnum = z.enum([
	"pending",
	"approved",
	"rejected",
	"cancelled",
])

export const DocumentReviewApprovalPathEnum = z.enum(["meeting", "quicksign"])

export type DocumentReviewApprovalPath = z.infer<typeof DocumentReviewApprovalPathEnum>

export const DocumentReviewRequestFileSchema = z.object({
	fileObjectId: z.string(),
	displayName: z.string().nullable(),
	mimeType: z.string(),
	sizeBytes: z.number().int().nonnegative(),
	sortOrder: z.number().int().nonnegative(),
	quicksignProjectId: z.string().nullable(),
	createdAt: z.string(),
})

export const DocumentReviewQuicksignQueueSchema = z.object({
	reviewRequestId: z.string(),
	totalDocuments: z.number().int().nonnegative(),
	/** 1-based index of the document currently in QuickSign */
	currentIndex: z.number().int().positive(),
	completedCount: z.number().int().nonnegative(),
	hasMore: z.boolean(),
})

export const DocumentReviewRequestSchema = z.object({
	id: z.string(),
	clientId: z.string(),
	clientName: z.string(),
	enpId: z.string(),
	enpName: z.string(),
	title: z.string(),
	note: z.string().nullable(),
	notarizationType: AppointmentNotarizationTypeEnum.nullable(),
	sessionMode: AppointmentSessionModeEnum,
	status: DocumentReviewRequestStatusEnum,
	/** ISO timestamps the client suggested (may be empty) */
	proposedSlots: z.array(z.string()),
	rejectionReason: z.string().nullable(),
	approvedAppointmentId: z.string().nullable(),
	approvedPath: DocumentReviewApprovalPathEnum.nullable(),
	activeQuicksignProjectId: z.string().nullable(),
	quicksignQueue: DocumentReviewQuicksignQueueSchema.nullable(),
	respondedAt: z.string().nullable(),
	files: z.array(DocumentReviewRequestFileSchema),
	...TimestampFields,
})

export const CreateDocumentReviewRequestSchema = z.object({
	enpId: z.string().min(1),
	title: z.string().min(1).max(255),
	note: z.string().max(2000).optional(),
	notarizationType: AppointmentNotarizationTypeEnum.optional(),
	sessionMode: AppointmentSessionModeEnum.default("remote"),
	/** ENP-configured document type IDs selected by the client (1+ required). */
	documentTypeIds: z.array(z.string().min(1)).min(1).max(10),
	/** File IDs already uploaded as `appointment_attachment` in `qlegal-documents` */
	fileObjectIds: z.array(z.string().min(1)).min(1).max(10),
	/** Optional ISO timestamps the client suggests (0–3 allowed) */
	proposedSlots: z.array(z.string()).max(3).optional().default([]),
})

export const DocumentReviewRequestIdSchema = z.object({
	id: z.coerce.string(),
})

export const ApproveDocumentReviewRequestSchema = z
	.object({
		id: z.coerce.string(),
		approvalPath: DocumentReviewApprovalPathEnum,
		/** Required for `meeting` (REN) */
		scheduledAt: z.string().optional(),
		durationMinutes: z.number().int().positive().default(60).optional(),
		notarizationType: AppointmentNotarizationTypeEnum,
		sessionMode: AppointmentSessionModeEnum.optional(),
		location: z.string().optional(),
		meetingUrl: z.string().url().optional(),
		notes: z.string().optional(),
	})
	.superRefine((val, ctx) => {
		if (val.approvalPath === "meeting") {
			if (!val.scheduledAt?.trim()) {
				ctx.addIssue({
					code: "custom",
					message: "scheduledAt is required for meeting approval",
					path: ["scheduledAt"],
				})
			}
		}
	})

export const RejectDocumentReviewRequestSchema = z.object({
	id: z.coerce.string(),
	rejectionReason: z.string().min(1).max(2000),
})

export const ApproveDocumentReviewQuicksignBootstrapSchema = z.object({
	quicksignProjectId: z.string(),
	documentFileId: z.string(),
	documentTitle: z.string(),
	queue: DocumentReviewQuicksignQueueSchema,
	clientEmail: z.string().email(),
	clientFirstName: z.string(),
	clientLastName: z.string(),
	notarizationType: AppointmentNotarizationTypeEnum,
})

export const ApproveDocumentReviewRequestResponseSchema = z.object({
	reviewRequest: DocumentReviewRequestSchema,
	appointment: AppointmentSchema.nullable(),
	quicksign: ApproveDocumentReviewQuicksignBootstrapSchema.nullable(),
})

export const AdvanceDocumentReviewQuicksignResponseSchema = z.object({
	quicksign: ApproveDocumentReviewQuicksignBootstrapSchema.nullable(),
	reviewRequest: DocumentReviewRequestSchema,
})

export type DocumentReviewRequest = z.infer<typeof DocumentReviewRequestSchema>
export type DocumentReviewRequestFile = z.infer<typeof DocumentReviewRequestFileSchema>
export type DocumentReviewQuicksignQueue = z.infer<typeof DocumentReviewQuicksignQueueSchema>
export type CreateDocumentReviewRequest = z.infer<typeof CreateDocumentReviewRequestSchema>
export type ApproveDocumentReviewRequest = z.infer<typeof ApproveDocumentReviewRequestSchema>
export type RejectDocumentReviewRequest = z.infer<typeof RejectDocumentReviewRequestSchema>
export type ApproveDocumentReviewRequestResponse = z.infer<
	typeof ApproveDocumentReviewRequestResponseSchema
>
export type ApproveDocumentReviewQuicksignBootstrap = z.infer<
	typeof ApproveDocumentReviewQuicksignBootstrapSchema
>
export type AdvanceDocumentReviewQuicksignResponse = z.infer<
	typeof AdvanceDocumentReviewQuicksignResponseSchema
>
