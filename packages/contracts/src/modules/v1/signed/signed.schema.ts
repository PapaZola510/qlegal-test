import { z } from "zod"

import {
	AppointmentNotarizationTypeEnum,
	MeetingFeeBreakdownSchema,
} from "../appointments/appointments.schema.js"
import {
	CtcPaymentMethodEnum,
	EnbAccessRequestOutcomeEnum,
	type CtcPaymentMethod,
} from "../registry/enb-compliance.schema.js"
import { PaymentIntentStatusEnum } from "../shared/enums.js"

export type { CtcPaymentMethod }

export const SignedDocumentCtcRequestSchema = z.object({
	id: z.string(),
	outcome: EnbAccessRequestOutcomeEnum,
	refusalReason: z.string().nullable(),
	requestedAt: z.string(),
	decidedAt: z.string().nullable(),
	requesterPaymentMethod: CtcPaymentMethodEnum.nullable().optional(),
	/** True when client chose online payment and AltPayNet checkout is required. */
	paymentRequired: z.boolean().optional(),
	/** True when online payment has been confirmed. */
	paymentPaid: z.boolean().optional(),
	paymentStatus: PaymentIntentStatusEnum.nullable().optional(),
})

export const SignedDocumentSchema = z.object({
	/** Stable key: `{appointmentId}:{documentFileId}` */
	id: z.string(),
	appointmentId: z.string(),
	documentFileId: z.string(),
	documentTitle: z.string(),
	documentType: z.string().nullable(),
	enpId: z.string(),
	enpName: z.string(),
	appointmentKind: z.enum(["standard", "quicksign"]),
	notarizationType: AppointmentNotarizationTypeEnum,
	completedAt: z.string(),
	/** Latest certified true copy request for this document, if any. */
	ctcRequest: SignedDocumentCtcRequestSchema.nullable(),
})

export const RequestCertifiedTrueCopySchema = z.object({
	appointmentId: z.string().uuid(),
	documentFileId: z.string().min(1),
	requesterAddress: z.string().min(1).max(1000),
	lawfulPurpose: z.string().min(3).max(2000),
	paymentMethod: CtcPaymentMethodEnum.default("cash"),
})

export const CtcRequestIdSchema = z.object({
	requestId: z.string().min(1),
})

export const CtcPaymentStatusSchema = z.object({
	requestId: z.string(),
	required: z.boolean(),
	totalFeePhp: z.number().int().nonnegative(),
	breakdown: MeetingFeeBreakdownSchema,
	paid: z.boolean(),
	paymentIntentId: z.string().nullable(),
	status: PaymentIntentStatusEnum.nullable(),
	qrCode: z.string().nullable(),
	checkoutUrl: z.string().nullable(),
	paymentProvider: z.literal("tlpe").optional(),
	tlpeTestMode: z.boolean().optional(),
	selectedPaymentBrand: z.string().nullable().optional(),
})

export const CreateCtcPaymentResultSchema = CtcPaymentStatusSchema.extend({
	paymentIntentId: z.string(),
	status: PaymentIntentStatusEnum,
})

export const CreateCtcPaymentInputSchema = CtcRequestIdSchema.extend({
	paymentOptionCode: z.string().min(1).optional(),
})

export type SignedDocument = z.infer<typeof SignedDocumentSchema>
export type SignedDocumentCtcRequest = z.infer<typeof SignedDocumentCtcRequestSchema>
export type RequestCertifiedTrueCopy = z.infer<typeof RequestCertifiedTrueCopySchema>
export type CtcPaymentStatus = z.infer<typeof CtcPaymentStatusSchema>
export type CreateCtcPaymentResult = z.infer<typeof CreateCtcPaymentResultSchema>
