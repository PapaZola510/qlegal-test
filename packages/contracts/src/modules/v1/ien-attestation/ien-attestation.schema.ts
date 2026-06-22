import { z } from "zod"

export const IenAttestationRoleEnum = z.enum(["enp", "principal", "witness"])

export const RecordQuicksignIenAttestationSchema = z.object({
	id: z.coerce.string(),
	role: z.literal("enp"),
	acknowledged: z.literal(true),
	notarizationType: z
		.enum([
			"acknowledgment",
			"jurat",
			"oath_affirmation",
			"copy_certification",
			"signature_witnessing",
		])
		.optional(),
})

export const RecordAppointmentIenAttestationSchema = z.object({
	id: z.coerce.string(),
	documentFileId: z.string().min(1),
	role: z.enum(["principal", "witness", "enp"]),
	acknowledged: z.literal(true),
})

export const ListQuicksignIenAttestationsSchema = z.object({
	id: z.coerce.string(),
})

export const ListAppointmentIenAttestationsSchema = z.object({
	id: z.coerce.string(),
	documentFileId: z.string().min(1),
})

export const ResolveIenSignUrlSchema = z.object({
	id: z.coerce.string(),
	documentFileId: z.string().min(1),
	role: IenAttestationRoleEnum.default("principal"),
})

export const IenAttestationEntrySchema = z.object({
	role: IenAttestationRoleEnum,
	userId: z.string(),
	signerName: z.string(),
	signerEmail: z.string().email(),
	confirmedAt: z.string(),
	acknowledgmentText: z.string(),
})

export const ListIenAttestationsResponseSchema = z.object({
	attestations: z.array(IenAttestationEntrySchema),
	requiredRoles: z.array(IenAttestationRoleEnum),
	attestationRequired: z.boolean(),
})

export const ResolveIenSignUrlResponseSchema = z.object({
	signDocumentUrl: z.string().url().nullable(),
	attestationRequired: z.boolean(),
	attestationComplete: z.boolean(),
})

export type IenAttestationRole = z.infer<typeof IenAttestationRoleEnum>
export type IenAttestationEntry = z.infer<typeof IenAttestationEntrySchema>
export type ListIenAttestationsResponse = z.infer<typeof ListIenAttestationsResponseSchema>
export type ResolveIenSignUrlResponse = z.infer<typeof ResolveIenSignUrlResponseSchema>
