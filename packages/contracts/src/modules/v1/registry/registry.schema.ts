import { z } from "zod"

import { AppointmentSessionModeEnum } from "../appointments/appointments.schema.js"
import { ActTypeEnum, ScStatusEnum } from "../shared/enums.js"
import { TimestampFields } from "../shared/schemas.js"
import { EnbAccessRequestSchema } from "./enb-compliance.schema.js"

export const RegistryCompletionStatusEnum = z.enum(["completed", "incomplete"])

export const RegistryEnbSignerRoleEnum = z.enum(["principal", "witness"])

export const RegistryEnbSignatureSchema = z.object({
	signerName: z.string(),
	signerRole: RegistryEnbSignerRoleEnum.default("principal"),
	signedAt: z.string(),
	signatureAcknowledgment: z.string().nullable(),
	signatureImageData: z.string().nullable(),
})

export const RegistryIenAttestationSchema = z.object({
	role: z.enum(["enp", "principal", "witness"]),
	signerName: z.string(),
	signerEmail: z.string().email(),
	confirmedAt: z.string(),
	acknowledgmentText: z.string(),
})

export const RegistryActSchema = z.object({
	id: z.string(),
	enpId: z.string(),
	actNumber: z.string(),
	/** Canonical SC-format entry number (doc-page-month-year). */
	entryNumber: z.string().nullable(),
	completionStatus: RegistryCompletionStatusEnum,
	incompleteReason: z.string().nullable(),
	incompleteCircumstances: z.string().nullable(),
	actType: ActTypeEnum,
	title: z.string(),
	parties: z.array(z.object({ name: z.string(), role: z.string() })),
	executedAt: z.string(),
	documentUrl: z.string().nullable(),
	/** Set for acts synced when a meeting ends (`description` includes `qlegal-file:{id}`). */
	documentFileObjectId: z.string().nullable(),
	/** QuickSign project UUID (`description` includes `qlegal-dc:{uuid}`). */
	doconchainProjectUuid: z.string().nullable(),
	/** Registry document code (`description` may include `qlegal-dc-code:{code}`). */
	documentCode: z.string().nullable(),
	scStatus: ScStatusEnum,
	scSubmittedAt: z.string().nullable(),
	scSyncedAt: z.string().nullable(),
	scRejectionReason: z.string().nullable(),
	scExternalRef: z.string().nullable(),
	appointmentId: z.string().nullable(),
	/** Client booking purpose / notes from the linked appointment, when any. */
	appointmentPurpose: z.string().nullable(),
	/** Linked appointment session mode (IEN vs REN on export). */
	sessionMode: AppointmentSessionModeEnum.nullable(),
	bookNo: z.string().nullable(),
	pageNo: z.string().nullable(),
	feePhp: z.number().int().nullable(),
	/** Lobby geolocation (reverse-geocoded) for linked appointment, when verified. */
	notarizationLocation: z.string().nullable(),
	/** Principal e-signatures captured during the live session (Rule §4). */
	principalEnbSignatures: z.array(RegistryEnbSignatureSchema).default([]),
	/** IEN checkbox acknowledgments captured before Signing. */
	ienNotarialAttestations: z.array(RegistryIenAttestationSchema).default([]),
	/** ENB inspect/copy and certified true copy requests linked to this entry. */
	enbAccessRequests: z.array(EnbAccessRequestSchema).default([]),
	...TimestampFields,
})

export const SessionDraftInputSchema = z.object({
	documentTitle: z.string().min(1),
	notarizationType: z.string().min(1),
	parties: z.string().min(1),
	pageNo: z.string().min(1),
	bookNo: z.string().min(1),
	fee: z.string().min(1),
	description: z.string().optional(),
})

export const FinalizeSessionDraftInputSchema = z.object({
	/** When set, links the act to an appointment owned by the same ENP (ignored if the id is unknown). */
	appointmentId: z.string().min(1).optional(),
	draft: SessionDraftInputSchema,
})

export const CreateRegistryActSchema = z.object({
	actType: ActTypeEnum,
	title: z.string().min(1),
	parties: z.array(z.object({ name: z.string(), role: z.string() })),
	executedAt: z.string(),
	documentUrl: z.string().url().optional(),
})

export const RegistryActIdSchema = z.object({
	id: z.coerce.string(),
})

export const BulkScSyncInputSchema = z.object({
	actIds: z.array(z.string()).min(1),
})

export const BulkScSyncResultSchema = z.object({
	submitted: z.number(),
	failed: z.number(),
	results: z.array(
		z.object({
			actId: z.string(),
			success: z.boolean(),
			error: z.string().nullable(),
		})
	),
})

export const MonthlyNotarialBookDestinationEnum = z.enum(["scp", "ena"])

export const SubmitMonthlyNotarialBookSchema = z.object({
	/** Calendar book key: YYYY-MM (book month = MM). */
	bookYearKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
	destination: MonthlyNotarialBookDestinationEnum.default("scp"),
})

export const SubmitMonthlyNotarialBookResultSchema = z.object({
	status: z.enum(["placeholder", "submitted", "failed"]),
	message: z.string(),
	bookLabel: z.string(),
	entryCount: z.number().int().nonnegative(),
	pendingSyncCount: z.number().int().nonnegative(),
	destination: MonthlyNotarialBookDestinationEnum,
	submittedAt: z.string(),
})

export type RegistryAct = z.infer<typeof RegistryActSchema>
export type CreateRegistryAct = z.infer<typeof CreateRegistryActSchema>
export type BulkScSyncResult = z.infer<typeof BulkScSyncResultSchema>
export type SubmitMonthlyNotarialBook = z.infer<typeof SubmitMonthlyNotarialBookSchema>
export type SubmitMonthlyNotarialBookResult = z.infer<typeof SubmitMonthlyNotarialBookResultSchema>
export type FinalizeSessionDraftInput = z.infer<typeof FinalizeSessionDraftInputSchema>

export const RefreshRegistryNotarizedDocumentResultSchema = z.object({
	available: z.boolean(),
	documentUrl: z.string().nullable(),
	documentCode: z.string().nullable(),
})

export type RefreshRegistryNotarizedDocumentResult = z.infer<
	typeof RefreshRegistryNotarizedDocumentResultSchema
>

export {
	CreateEnbAccessRequestSchema,
	DecideEnbAccessRequestSchema,
	EnbAccessRequestSchema,
	ProtestProceedingsSchema,
	RecordIncompleteActSchema,
	UpsertProtestProceedingsSchema,
} from "./enb-compliance.schema.js"
export type {
	CreateEnbAccessRequest,
	DecideEnbAccessRequest,
	EnbAccessRequest,
	ProtestProceedings,
	RecordIncompleteAct,
	UpsertProtestProceedings,
} from "./enb-compliance.schema.js"
