import { z } from "zod"

import { TimestampFields } from "../shared/schemas.js"

export const EnpDocumentTypeSchema = z.object({
	id: z.string(),
	enpId: z.string(),
	name: z.string(),
	pricePhp: z.number().int().positive(),
	isActive: z.boolean(),
	...TimestampFields,
})

export const EnpDocumentTypeIdSchema = z.object({
	id: z.coerce.string(),
})

export const ListEnpDocumentTypesInputSchema = z.object({
	enpId: z.string().min(1),
})

export const CreateEnpDocumentTypeSchema = z.object({
	name: z.string().min(1).max(120),
	pricePhp: z.number().int().positive(),
})

export const UpdateEnpDocumentTypeSchema = z
	.object({
		id: z.coerce.string(),
		name: z.string().min(1).max(120).optional(),
		pricePhp: z.number().int().positive().optional(),
		isActive: z.boolean().optional(),
	})
	.strict()

export const DeleteEnpDocumentTypeResponseSchema = z.object({ ok: z.literal(true), id: z.string() })

export type EnpDocumentType = z.infer<typeof EnpDocumentTypeSchema>
export type ListEnpDocumentTypesInput = z.infer<typeof ListEnpDocumentTypesInputSchema>
export type CreateEnpDocumentType = z.infer<typeof CreateEnpDocumentTypeSchema>
export type UpdateEnpDocumentType = z.infer<typeof UpdateEnpDocumentTypeSchema>
