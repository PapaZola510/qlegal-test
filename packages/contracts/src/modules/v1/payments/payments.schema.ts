import { z } from "zod"

import { PaymentIntentStatusEnum } from "../shared/enums.js"
import { TimestampFields } from "../shared/schemas.js"

export const PaymentIntentPurposeEnum = z.enum([
	"exam_retake",
	"meeting_session",
	"commission_hearing",
	"ctc_request",
	"other",
])

export const PaymentIntentSchema = z.object({
	id: z.string(),
	userId: z.string(),
	amount: z.number().int().min(0),
	currency: z.string().default("PHP"),
	status: PaymentIntentStatusEnum,
	description: z.string(),
	purpose: PaymentIntentPurposeEnum,
	provider: z.string(),
	referenceNumber: z.string().nullable(),
	paymentMethod: z.string().nullable(),
	paidAt: z.string().nullable(),
	paidViaAdminOverride: z.boolean(),
	consumedAt: z.string().nullable(),
	...TimestampFields,
})

export const CreatePaymentIntentSchema = z.object({
	amount: z.number().int().positive(),
	currency: z.string().default("PHP"),
	description: z.string().min(1),
	purpose: PaymentIntentPurposeEnum.optional().default("other"),
})

export const PaymentIdSchema = z.object({
	id: z.coerce.string(),
})

export type PaymentIntent = z.infer<typeof PaymentIntentSchema>
export type CreatePaymentIntent = z.infer<typeof CreatePaymentIntentSchema>
