import { z } from "zod"

import { AppointmentStatusEnum } from "../shared/enums.js"
import { PaginatedResponseMeta, PaginationInputSchema, TimestampFields } from "../shared/schemas.js"

export const AppointmentNotarizationTypeEnum = z.enum([
	"acknowledgment",
	"jurat",
	"oath_affirmation",
	"copy_certification",
	"signature_witnessing",
])

export const AppointmentSessionModeEnum = z.enum(["remote", "in_person", "hybrid"])

export const AppointmentSchema = z.object({
	id: z.string(),
	clientId: z.string(),
	clientName: z.string(),
	enpId: z.string(),
	enpName: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	status: AppointmentStatusEnum,
	scheduledAt: z.string(),
	durationMinutes: z.number().int().positive(),
	location: z.string().nullable(),
	/** @deprecated Prefer sessionMode; kept for older mocks */
	isVirtual: z.boolean(),
	meetingUrl: z.string().nullable(),
	notes: z.string().nullable(),
	notarizationType: AppointmentNotarizationTypeEnum,
	sessionMode: AppointmentSessionModeEnum,
	kind: z.enum(["standard", "quicksign", "commission_hearing"]).default("standard"),
	declineReason: z.string().nullable().optional(),
	/** Set when ENP sends a per-document booking quote. */
	quoteSentAt: z.string().nullable().optional(),
	quoteNotes: z.string().nullable().optional(),
	/** Sum of quoted document fees (PHP), when a quote was sent. */
	quoteTotalPhp: z.number().int().nonnegative().nullable().optional(),
	documentsCount: z.number().int().nonnegative(),
	canStart: z.boolean(),
	canRejoin: z.boolean(),
	/** Section 4: principal e-sign phase on the ENB before session may end. */
	enbSigningStatus: z.enum(["not_started", "active", "completed"]).default("not_started"),
	enbSigningStartedAt: z.string().nullable().optional(),
	enbSigningCompletedAt: z.string().nullable().optional(),
	...TimestampFields,
})

export const CreateAppointmentSchema = z.object({
	/** Target ENP (user id with certified ENP profile) */
	enpId: z.string().min(1),
	title: z.string().min(1),
	description: z.string().optional(),
	scheduledAt: z.string(),
	durationMinutes: z.number().int().positive().default(60),
	location: z.string().optional(),
	meetingUrl: z.string().url().optional(),
	notes: z.string().optional(),
	notarizationType: AppointmentNotarizationTypeEnum,
	sessionMode: AppointmentSessionModeEnum,
	/** ENP-configured document type IDs selected by the client (1+ required). */
	documentTypeIds: z.array(z.string().min(1)).min(1).max(10),
	/** PDFs uploaded at booking (via `/files/for-notary`). At least one required. */
	bookingDocuments: z
		.array(
			z.object({
				fileObjectId: z.string().min(1),
				displayName: z.string().min(1).optional(),
			})
		)
		.min(1)
		.max(20),
	/** Plaintext invite token when booking via an ENP share link */
	bookingInviteToken: z.string().min(8).optional(),
})

export const AppointmentIdSchema = z.object({
	id: z.coerce.string(),
})

export const ListAppointmentsInputSchema = PaginationInputSchema.extend({
	status: AppointmentStatusEnum.optional(),
})

/** Per-status totals for inbox tabs (independent of the current page filter). */
export const AppointmentStatusCountsSchema = z.object({
	all: z.number().int().nonnegative(),
	pending: z.number().int().nonnegative(),
	quote_sent: z.number().int().nonnegative(),
	confirmed: z.number().int().nonnegative(),
	in_session: z.number().int().nonnegative(),
	ended: z.number().int().nonnegative(),
	declined: z.number().int().nonnegative(),
	cancelled: z.number().int().nonnegative(),
})

export const AppointmentListResponseSchema = z.object({
	items: z.array(AppointmentSchema),
	meta: PaginatedResponseMeta,
	statusCounts: AppointmentStatusCountsSchema,
})

export const MeetingDocumentTypePresetEnum = z.enum([
	"SIGNATURE_WITNESSING",
	"JURAT",
	"AFFIRMATION",
])

export const AppointmentBookedDocumentTypeSchema = z.object({
	/** ENP document type id selected at booking */
	id: z.string(),
	name: z.string(),
	pricePhpSnapshot: z.number().int().positive(),
})

export const AppointmentAttachmentSchema = z.object({
	/** Synthetic id for stable React keys */
	id: z.string(),
	fileObjectId: z.string(),
	mimeType: z.string(),
	linkedAt: z.string(),
	/** From storage key when available */
	documentName: z.string().optional(),
	/** Preset code or custom act type label */
	documentType: z.string().optional(),
	/** Booked ENP service type this instrument belongs to */
	enpDocumentTypeId: z.string().optional(),
	sizeBytes: z.number().int().nonnegative().optional(),
	/** Latest meeting signing project for this file (ENP-owned), when present */
	quicksignProjectId: z.string().nullable().optional(),
	doconchainProjectUuid: z.string().nullable().optional(),
	/** User id of who uploaded the file (ENP or principal). */
	uploadedByUserId: z.string().optional(),
	/** True when the upload originated from the principal/client during a session. */
	uploadedByPrincipal: z.boolean().optional(),
	/** Notarial fee in PHP when set by the ENP. */
	feePhp: z.number().int().positive().optional(),
})

export const MeetingRecordingSchema = z.object({
	id: z.string(),
	appointmentId: z.string(),
	appointmentTitle: z.string(),
	fileObjectId: z.string(),
	mimeType: z.string(),
	linkedAt: z.string(),
	fileName: z.string(),
	sizeBytes: z.number().int().nonnegative().optional(),
})

export const LinkMeetingDocumentInputSchema = z
	.object({
		id: z.coerce.string(),
		fileObjectId: z.string().min(1),
		documentName: z.string().min(1).max(255),
		documentType: z.string().min(1).max(120),
		enpDocumentTypeId: z.string().min(1).optional(),
		feePhp: z.number().int().positive(),
	})
	.strict()

export const CreateMeetingDocumentProjectInputSchema = z
	.object({
		id: z.coerce.string(),
		fileObjectId: z.string().min(1),
		feePhp: z.number().int().positive().optional(),
	})
	.strict()

export const MeetingDocumentFileInputSchema = z
	.object({
		id: z.coerce.string(),
		fileObjectId: z.string().min(1),
	})
	.strict()

export const LinkMeetingRecordingInputSchema = z
	.object({
		id: z.coerce.string(),
		fileObjectId: z.string().min(1),
		fileName: z.string().min(1).max(255),
	})
	.strict()

export const DeleteMeetingRecordingInputSchema = z
	.object({
		id: z.coerce.string(),
		fileObjectId: z.string().min(1),
	})
	.strict()

export const UpdateMeetingDocumentFeeInputSchema = MeetingDocumentFileInputSchema.extend({
	feePhp: z.number().int().positive(),
}).strict()

export const DeleteMeetingDocumentResultSchema = z.object({
	ok: z.literal(true),
	fileObjectId: z.string(),
})

export const MeetingFeeBreakdownSchema = z.object({
	notarialFeePhp: z.number().int().nonnegative(),
	convenienceFeePhp: z.number().int().nonnegative(),
	processingFeePhp: z.number().int().nonnegative(),
	vatPhp: z.number().int().nonnegative(),
	totalPhp: z.number().int().nonnegative(),
})

export const MeetingPaymentStatusSchema = z.object({
	appointmentId: z.string(),
	required: z.boolean(),
	totalFeePhp: z.number().int().nonnegative(),
	breakdown: MeetingFeeBreakdownSchema,
	paid: z.boolean(),
	paymentIntentId: z.string().nullable(),
	status: z
		.enum(["pending", "processing", "succeeded", "failed", "refunded", "cancelled"])
		.nullable(),
	qrCode: z.string().nullable(),
	checkoutUrl: z.string().nullable(),
	/** True when document fees changed after the QR was generated; client must refresh payment. */
	qrStale: z.boolean().optional(),
	/** Active or intent payment provider for meeting session fees. */
	paymentProvider: z.enum(["hitpay", "tlpe"]).optional(),
	/** True in local dev when HitPay sandbox is configured (QRPH checkout may not complete). */
	sandboxTestMode: z.boolean().optional(),
	/** True in local dev when TLPE test API is configured. */
	tlpeTestMode: z.boolean().optional(),
	/** TLPE brand label used for the active payment link, when known. */
	selectedPaymentBrand: z.string().nullable().optional(),
})

export const CreateMeetingPaymentResultSchema = MeetingPaymentStatusSchema.extend({
	paymentIntentId: z.string(),
	status: z.enum(["pending", "processing", "succeeded", "failed", "refunded", "cancelled"]),
})

export const TlpeBrandCheckoutProcessEnum = z.enum([
	"tlpe_hosted_checkout",
	"ewallet_redirect",
	"card_checkout",
	"easy_payment_link_selector",
])

export const TlpeIntegrationProcessEnum = z.enum([
	"checkout",
	"direct_payment",
	"easy_payment_link",
])

export const TlpePaymentBrandSchema = z.object({
	code: z.string(),
	label: z.string(),
	image: z.string().url().optional(),
	checkoutProcess: TlpeBrandCheckoutProcessEnum,
	processSummary: z.string(),
	clientSteps: z.array(z.string()),
})

export const MeetingPaymentBrandsSchema = z.object({
	integrationProcess: TlpeIntegrationProcessEnum,
	brands: z.array(TlpePaymentBrandSchema),
})

export const CreateMeetingPaymentInputSchema = AppointmentIdSchema.extend({
	paymentOptionCode: z.string().min(1).optional(),
})

export const UpdateAppointmentStatusSchema = z.object({
	id: z.coerce.string(),
	status: AppointmentStatusEnum,
	declineReason: z.string().min(1).optional(),
})

export const BookingQuoteLineItemSchema = z.object({
	fileObjectId: z.string().min(1),
	notarizationType: AppointmentNotarizationTypeEnum,
	feePhp: z.number().int().positive(),
	enpDocumentTypeId: z.string().min(1).optional(),
})

export const SendBookingQuoteSchema = AppointmentIdSchema.extend({
	notes: z.string().max(2000).optional(),
	lineItems: z.array(BookingQuoteLineItemSchema).min(1).max(20),
})

export const DeclineBookingQuoteSchema = AppointmentIdSchema.extend({
	declineReason: z.string().min(1).max(2000),
})

export const DirectorySearchSchema = z.object({
	city: z.string().optional(),
	notarizationType: AppointmentNotarizationTypeEnum.optional(),
	maxBaseFee: z.coerce.number().int().nonnegative().optional(),
	sessionMode: AppointmentSessionModeEnum.optional(),
})

export const NotaryDirectoryEntrySchema = z.object({
	id: z.string(),
	firstName: z.string(),
	lastName: z.string(),
	email: z.string(),
	city: z.string(),
	province: z.string(),
	specializations: z.array(AppointmentNotarizationTypeEnum),
	baseFee: z.number().int().nonnegative(),
	availableModes: z.array(AppointmentSessionModeEnum),
	rating: z.number(),
	reviewCount: z.number().int().nonnegative(),
})

export const ResolveBookingInviteInputSchema = z.object({
	token: z.string().min(16),
})

export const ResolvedBookingInviteSchema = z.object({
	enpId: z.string(),
	firstName: z.string(),
	lastName: z.string(),
	email: z.string(),
	city: z.string(),
	province: z.string(),
})

export const RotateBookingInviteResponseSchema = z.object({
	token: z.string(),
	expiresAt: z.string(),
})

export type AppointmentBookedDocumentType = z.infer<typeof AppointmentBookedDocumentTypeSchema>
export type AppointmentAttachment = z.infer<typeof AppointmentAttachmentSchema>
export type MeetingRecording = z.infer<typeof MeetingRecordingSchema>
export type MeetingDocumentTypePreset = z.infer<typeof MeetingDocumentTypePresetEnum>
export type Appointment = z.infer<typeof AppointmentSchema>
export type AppointmentListResponse = z.infer<typeof AppointmentListResponseSchema>
export type AppointmentStatusCounts = z.infer<typeof AppointmentStatusCountsSchema>
export type CreateAppointment = z.infer<typeof CreateAppointmentSchema>
export type BookingQuoteLineItem = z.infer<typeof BookingQuoteLineItemSchema>
export type SendBookingQuote = z.infer<typeof SendBookingQuoteSchema>
export type DeclineBookingQuote = z.infer<typeof DeclineBookingQuoteSchema>
export type ListAppointmentsInput = z.infer<typeof ListAppointmentsInputSchema>
export type DirectorySearchInput = z.infer<typeof DirectorySearchSchema>
export type NotaryDirectoryEntry = z.infer<typeof NotaryDirectoryEntrySchema>
export type ResolvedBookingInvite = z.infer<typeof ResolvedBookingInviteSchema>
export type MeetingFeeBreakdown = z.infer<typeof MeetingFeeBreakdownSchema>
export type MeetingPaymentStatus = z.infer<typeof MeetingPaymentStatusSchema>
export type CreateMeetingPaymentResult = z.infer<typeof CreateMeetingPaymentResultSchema>
export type TlpePaymentBrand = z.infer<typeof TlpePaymentBrandSchema>
export type MeetingPaymentBrands = z.infer<typeof MeetingPaymentBrandsSchema>
