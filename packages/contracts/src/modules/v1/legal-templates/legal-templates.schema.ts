import { z } from "zod"

export const TemplateIdSchema = z.enum([
	"affidavit-of-loss",
	"affidavit-of-discrepancy",
	"sworn-affidavit-name-discrepancy",
	"affidavit-of-undertaking",
	"affidavit-of-undertaking-with-minor",
	"affidavit-of-undertaking-psa-birth-marriage-certificate",
	"verification-and-certification-against-forum-shopping",
	"petition-for-voluntary-confinement-treatment",
	"gsis-board-of-trustees-petition",
	"sworn-statement-assets-liabilities-net-worth",
	"affidavit-of-desistance",
	"contract-of-lease",
	"real-estate-mortgage",
	"contract-of-services",
])

export type TemplateId = z.infer<typeof TemplateIdSchema>

export const LegalTemplateDraftSchema = z.object({
	id: z.string(),
	userId: z.string(),
	templateId: TemplateIdSchema,
	data: z.record(z.string(), z.unknown()),
	updatedAt: z.string().datetime(),
	createdAt: z.string().datetime(),
})

export type LegalTemplateDraft = z.infer<typeof LegalTemplateDraftSchema>

export const GetDraftInputSchema = z.object({
	templateId: TemplateIdSchema,
})

export const UpsertDraftInputSchema = z.object({
	templateId: TemplateIdSchema,
	data: z.record(z.string(), z.unknown()),
})
