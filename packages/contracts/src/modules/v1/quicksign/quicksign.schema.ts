import { z } from "zod"

import {
	AppointmentNotarizationTypeEnum,
	AppointmentSessionModeEnum,
} from "../appointments/appointments.schema.js"
import { QuicksignStatusEnum } from "../shared/enums.js"
import { TimestampFields } from "../shared/schemas.js"

export const SignatureFieldSchema = z.object({
	signerEmail: z.string().email(),
	pageIndex: z.number().int().min(0),
	x: z.number().min(0),
	y: z.number().min(0),
	width: z.number().min(1),
	height: z.number().min(1),
})

/** Machine-readable codes returned on `ORPCError` via `data.quicksign.code` for UI recovery (Flow 8). */
export const QuicksignErrorCodeSchema = z.enum([
	"DC_PROJECT_CREATE_FAILED",
	"DC_PROJECT_EXPIRED",
	"DC_SIGNER_FAILED",
	"DC_PLOT_LINK_FAILED",
	"DC_POPUP_BLOCKED",
	"INVALID_STATE",
	"FILE_NOT_ACCESSIBLE",
	"SIGNER_NOT_REGISTERED",
])

export type QuicksignErrorCode = z.infer<typeof QuicksignErrorCodeSchema>

export const QuicksignProjectSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	ownerId: z.string(),
	ownerName: z.string(),
	status: QuicksignStatusEnum,
	/** Stored file (`qs_original`); client uses authenticated files API to download. */
	documentFileId: z.string(),
	/** Convenience display URL (may be synthetic when no presign is embedded). */
	documentUrl: z.string(),
	doconchainProjectUuid: z.string().nullable(),
	signatureFields: z.array(SignatureFieldSchema).nullable(),
	appointmentId: z.string().nullable(),
	plotCompletedAt: z.string().nullable(),
	signatories: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			/** Relaxed from `.email()`: legacy / DocOnChain rows may hold non-RFC strings; strict validation caused HTTP 500. */
			email: z.string().min(1),
			signedAt: z.string().nullable(),
			order: z.number().int(),
		})
	),
	documentTypes: z
		.array(
			z.object({
				id: z.string(),
				name: z.string(),
				pricePhpSnapshot: z.number().int(),
			})
		)
		.default([]),
	expiresAt: z.string().nullable(),
	completedAt: z.string().nullable(),
	/** Present on GET after DocOnChain + meeting signer sync. */
	signingComplete: z.boolean().optional(),
	/** Present when a notarial registry act exists for the linked appointment. */
	registrySynced: z.boolean().optional(),
	...TimestampFields,
})

export const CreateQuicksignProjectSchema = z.object({
	title: z.string().min(1).max(255),
	description: z.string().optional(),
	documentFileId: z.string().min(1),
	signer: z
		.object({
			firstName: z.string().min(1).max(120),
			lastName: z.string().min(1).max(120),
			email: z.string().email(),
		})
		.optional(),
	enpDocumentTypeIds: z.array(z.string().min(1)).min(1).max(10).optional(),
})

export const QuicksignIdSchema = z.object({
	id: z.coerce.string(),
})

export const QuicksignAddSignerSchema = z.object({
	id: z.coerce.string(),
	firstName: z.string().min(1).max(120),
	lastName: z.string().min(1).max(120),
	email: z.string().email(),
	order: z.number().int().min(1).optional(),
})

export const QuicksignPlotLinkResponseSchema = z.object({
	plotLink: z.string().url(),
	doconchainProjectUuid: z.string(),
})

export const QuicksignFinalizeSchema = z.object({
	id: z.coerce.string(),
	/** When omitted, the primary QuickSign signer email must match a registered client account. */
	clientUserId: z.string().min(1).optional(),
	/** ISO datetime; defaults to now when omitted. */
	scheduledAt: z.string().optional(),
	durationMinutes: z
		.number()
		.int()
		.positive()
		.max(24 * 60)
		.default(60),
	title: z.string().min(1).max(255).optional(),
	notarizationType: AppointmentNotarizationTypeEnum.default("acknowledgment"),
	sessionMode: AppointmentSessionModeEnum.default("hybrid"),
	notes: z.string().max(1000).optional(),
})

export const QuicksignPrincipalSignerStatusSchema = z.object({
	email: z.string().email(),
	name: z.string(),
	hasSigned: z.boolean(),
	signedAt: z.string().nullable(),
})

export const QuicksignFinalizeResponseSchema = z.object({
	appointmentId: z.string(),
	quicksignProjectId: z.string(),
	doconchainProjectUuid: z.string().nullable(),
	/** Lobby URL for the signer (and ENP) to join the hybrid session. */
	clientJoinUrl: z.string().url(),
	enpJoinUrl: z.string().url(),
	/** Principal/client signing URL (invite email). Same as `clientSignDocumentUrl`. */
	signDocumentUrl: z.string().url(),
	clientSignDocumentUrl: z.string().url(),
	/** ENP/notary signing URL — must not be shared with the principal. */
	enpSignDocumentUrl: z.string().url(),
	principalSignerStatus: QuicksignPrincipalSignerStatusSchema,
	documentFileId: z.string(),
	signingComplete: z.boolean(),
	registrySynced: z.boolean(),
})

export const SignatureFieldsInputSchema = z.object({
	id: z.coerce.string(),
	fields: z.array(SignatureFieldSchema).min(1),
})

export const SignatureFieldsResponseSchema = z.object({
	fields: z.array(SignatureFieldSchema),
})

export const StampSignatureInputSchema = z.object({
	id: z.coerce.string(),
	signerEmail: z.string().email(),
	signaturePngBase64: z.string().min(1),
})

export const StampSignatureResponseSchema = z.object({
	signed: z.literal(true),
})

export type SignatureField = z.infer<typeof SignatureFieldSchema>
export type SignatureFieldsInput = z.infer<typeof SignatureFieldsInputSchema>

export type QuicksignProject = z.infer<typeof QuicksignProjectSchema>
export type CreateQuicksignProject = z.infer<typeof CreateQuicksignProjectSchema>
export type QuicksignAddSigner = z.infer<typeof QuicksignAddSignerSchema>
export type QuicksignFinalize = z.infer<typeof QuicksignFinalizeSchema>
export type QuicksignFinalizeResponse = z.infer<typeof QuicksignFinalizeResponseSchema>
