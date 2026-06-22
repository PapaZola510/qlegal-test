import { z } from "zod"

import { ActTypeEnum, PaymentIntentStatusEnum } from "../shared/enums.js"
import { TimestampFields } from "../shared/schemas.js"

export const RegistryCompletionStatusEnum = z.enum(["completed", "incomplete"])

export const EnbAccessRequestTypeEnum = z.enum(["inspect", "copy"])

export const EnbAccessRequestOutcomeEnum = z.enum(["pending", "granted", "refused"])

export const ProtestNoticeSchema = z.object({
	toWhom: z.string().min(1),
	manner: z.string().min(1),
	whereMade: z.string().min(1),
	whenDirected: z.string().min(1),
	whereDirected: z.string().min(1),
})

export const ProtestProceedingsSchema = z.object({
	registryActId: z.string(),
	demandBy: z.string().nullable(),
	demandWhen: z.string().nullable(),
	demandWhere: z.string().nullable(),
	sumDemanded: z.string().nullable(),
	presented: z.boolean().nullable(),
	presentationNotes: z.string().nullable(),
	notices: z.array(ProtestNoticeSchema),
	otherFacts: z.string().nullable(),
	...TimestampFields,
})

export const UpsertProtestProceedingsSchema = z.object({
	registryActId: z.string().min(1),
	demandBy: z.string().max(500).optional(),
	demandWhen: z.string().max(500).optional(),
	demandWhere: z.string().max(500).optional(),
	sumDemanded: z.string().max(200).optional(),
	presented: z.boolean().optional(),
	presentationNotes: z.string().max(2000).optional(),
	notices: z.array(ProtestNoticeSchema).default([]),
	otherFacts: z.string().max(5000).optional(),
})

export const RecordIncompleteActSchema = z.object({
	title: z.string().min(1).max(500),
	actType: ActTypeEnum.default("other"),
	parties: z.array(z.object({ name: z.string(), role: z.string() })).default([]),
	executedAt: z.string().optional(),
	appointmentId: z.string().min(1).optional(),
	incompleteReason: z.string().min(1).max(2000),
	incompleteCircumstances: z.string().min(1).max(5000),
})

export const CreateEnbAccessRequestSchema = z.object({
	registryActId: z.string().min(1).optional(),
	bookNo: z.string().max(50).optional(),
	requestType: EnbAccessRequestTypeEnum,
	requesterName: z.string().min(1).max(300),
	requesterAddress: z.string().min(1).max(1000),
	lawfulPurpose: z.string().min(1).max(2000),
	requesterSignatureFileObjectId: z.string().min(1).optional(),
	identityEvidenceFileObjectId: z.string().min(1).optional(),
})

/** Validate a notarial book entry before a virtual inspect/copy request (Rule 24-10-14-SC c). */
export const LookupEnbEntryForAccessSchema = z.object({
	enpUserId: z.string().min(1),
	bookNo: z.string().min(1).max(50),
	entryNumber: z.string().min(1).max(80).optional(),
})

export const EnbEntryLookupResultSchema = z.object({
	registryActId: z.string().nullable(),
	entryNumber: z.string().nullable(),
	bookNo: z.string(),
	pageNo: z.string().nullable(),
	title: z.string().nullable(),
	enpName: z.string(),
	actType: z.string().nullable(),
	executedAt: z.string().nullable(),
})

/** Virtual inspect/copy request through the ENF (any authenticated requester). */
export const SubmitVirtualEnbAccessRequestSchema = z
	.object({
		enpUserId: z.string().min(1),
		registryActId: z.string().min(1).optional(),
		bookNo: z.string().min(1).max(50).optional(),
		entryNumber: z.string().min(1).max(80).optional(),
		requestType: EnbAccessRequestTypeEnum,
		requesterName: z.string().min(1).max(300),
		requesterAddress: z.string().min(1).max(1000),
		lawfulPurpose: z.string().min(3).max(2000),
		signatureImageData: z
			.string()
			.min(32)
			.max(600_000)
			.refine(v => v.startsWith("data:image/"), "Signature image must be a data URL"),
	})
	.refine(
		data =>
			Boolean(data.registryActId?.trim()) ||
			Boolean(data.bookNo?.trim() && data.entryNumber?.trim()) ||
			Boolean(data.bookNo?.trim() && !data.entryNumber?.trim()),
		{
			message:
				"Provide a registry entry (book + entry number) or a book number for book-level access",
		}
	)

export const CtcPaymentMethodEnum = z.enum(["cash", "online"])

export type CtcPaymentMethod = z.infer<typeof CtcPaymentMethodEnum>

/** ENP compliance form completed before granting a certified true copy. */
export const CtcComplianceFormSchema = z.object({
	requestingPartyIdentityCheck: z.string().min(1).max(500),
	notarialActDate: z.string().min(1).max(100),
	documentType: z.string().min(1).max(500),
	principalNames: z.string().min(1).max(2000),
	witnessNames: z.string().max(2000).optional(),
	purposeOfRequest: z.string().min(1).max(2000),
	entryRequested: z.string().min(1).max(200),
	lawEnforcementCourtOrderAttached: z.boolean(),
	lawEnforcementNotes: z.string().max(2000).optional(),
	paymentMethod: CtcPaymentMethodEnum,
})

export const DecideEnbAccessRequestSchema = z.object({
	id: z.string().min(1),
	outcome: z.enum(["granted", "refused"]),
	refusalReason: z.string().max(2000).optional(),
	ctcCompliance: CtcComplianceFormSchema.optional(),
	enpSignatureImageData: z
		.string()
		.min(32)
		.max(600_000)
		.refine(v => v.startsWith("data:image/"), "Signature image must be a data URL")
		.optional(),
})

export const EnbAccessRequestSchema = z.object({
	id: z.string(),
	enpUserId: z.string(),
	registryActId: z.string().nullable(),
	bookNo: z.string().nullable(),
	requestType: EnbAccessRequestTypeEnum,
	certifiedTrueCopy: z.boolean().default(false),
	requesterUserId: z.string().nullable(),
	appointmentId: z.string().nullable(),
	documentFileObjectId: z.string().nullable(),
	requesterName: z.string(),
	requesterAddress: z.string(),
	lawfulPurpose: z.string(),
	requesterSignatureImageData: z.string().nullable(),
	requesterSignatureFileObjectId: z.string().nullable(),
	identityEvidenceFileObjectId: z.string().nullable(),
	requesterPaymentMethod: CtcPaymentMethodEnum.nullable().optional(),
	paymentIntentId: z.string().nullable().optional(),
	ctcPaymentStatus: PaymentIntentStatusEnum.nullable().optional(),
	outcome: EnbAccessRequestOutcomeEnum,
	refusalReason: z.string().nullable(),
	enpSignatureImageData: z.string().nullable(),
	ctcComplianceForm: CtcComplianceFormSchema.nullable(),
	requestedAt: z.string(),
	decidedAt: z.string().nullable(),
	registryActTitle: z.string().nullable(),
	entryNumber: z.string().nullable(),
	...TimestampFields,
})

export type ProtestProceedings = z.infer<typeof ProtestProceedingsSchema>
export type UpsertProtestProceedings = z.infer<typeof UpsertProtestProceedingsSchema>
export type RecordIncompleteAct = z.infer<typeof RecordIncompleteActSchema>
export type CreateEnbAccessRequest = z.infer<typeof CreateEnbAccessRequestSchema>
export type CtcComplianceForm = z.infer<typeof CtcComplianceFormSchema>
export type DecideEnbAccessRequest = z.infer<typeof DecideEnbAccessRequestSchema>
export type EnbAccessRequest = z.infer<typeof EnbAccessRequestSchema>
export type LookupEnbEntryForAccess = z.infer<typeof LookupEnbEntryForAccessSchema>
export type EnbEntryLookupResult = z.infer<typeof EnbEntryLookupResultSchema>
export type SubmitVirtualEnbAccessRequest = z.infer<typeof SubmitVirtualEnbAccessRequestSchema>
