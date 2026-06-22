import { z } from "zod"

export const IdParamSchema = z.object({
	id: z.coerce.string(),
})

export const NumericIdParamSchema = z.object({
	id: z.coerce.number().int().positive(),
})

export const TimestampFields = {
	createdAt: z
		.union([z.date(), z.string()])
		.transform(val => (typeof val === "string" ? new Date(val) : val)),
	updatedAt: z
		.union([z.date(), z.string()])
		.transform(val => (typeof val === "string" ? new Date(val) : val)),
}

export const PaginationInputSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const PaginatedResponseMeta = z.object({
	page: z.number(),
	limit: z.number(),
	total: z.number(),
	totalPages: z.number(),
})
