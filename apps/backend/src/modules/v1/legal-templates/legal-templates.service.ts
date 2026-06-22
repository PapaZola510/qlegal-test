import { Injectable } from "@nestjs/common"
import { and, eq } from "drizzle-orm"

import { legalTemplateDrafts } from "@repo/db/schema"

import { db } from "@/common/database/database.client"

@Injectable()
export class LegalTemplatesService {
	async getDraft({ userId, templateId }: { userId: string; templateId: string }) {
		const [row] = await db
			.select()
			.from(legalTemplateDrafts)
			.where(
				and(eq(legalTemplateDrafts.userId, userId), eq(legalTemplateDrafts.templateId, templateId))
			)
			.limit(1)

		if (!row) return null

		return {
			id: row.id,
			userId: row.userId,
			templateId: row.templateId as
				| "affidavit-of-loss"
				| "affidavit-of-discrepancy"
				| "sworn-affidavit-name-discrepancy"
				| "affidavit-of-undertaking"
				| "affidavit-of-undertaking-with-minor"
				| "affidavit-of-undertaking-psa-birth-marriage-certificate"
				| "verification-and-certification-against-forum-shopping"
				| "petition-for-voluntary-confinement-treatment"
				| "gsis-board-of-trustees-petition"
				| "sworn-statement-assets-liabilities-net-worth"
				| "affidavit-of-desistance"
				| "contract-of-lease"
				| "real-estate-mortgage"
				| "contract-of-services",
			data: row.data as Record<string, unknown>,
			updatedAt: row.updatedAt.toISOString(),
			createdAt: row.createdAt.toISOString(),
		}
	}

	async upsertDraft({
		userId,
		templateId,
		data,
	}: {
		userId: string
		templateId: string
		data: Record<string, unknown>
	}) {
		const [row] = await db
			.insert(legalTemplateDrafts)
			.values({ userId, templateId, data })
			.onConflictDoUpdate({
				target: [legalTemplateDrafts.userId, legalTemplateDrafts.templateId],
				set: {
					data,
					updatedAt: new Date(),
				},
			})
			.returning()

		if (!row) throw new Error("Failed to upsert legal template draft")

		return {
			id: row.id,
			userId: row.userId,
			templateId: row.templateId as
				| "affidavit-of-loss"
				| "affidavit-of-discrepancy"
				| "sworn-affidavit-name-discrepancy"
				| "affidavit-of-undertaking"
				| "affidavit-of-undertaking-with-minor"
				| "affidavit-of-undertaking-psa-birth-marriage-certificate"
				| "verification-and-certification-against-forum-shopping"
				| "petition-for-voluntary-confinement-treatment"
				| "gsis-board-of-trustees-petition"
				| "sworn-statement-assets-liabilities-net-worth"
				| "affidavit-of-desistance"
				| "contract-of-lease"
				| "real-estate-mortgage"
				| "contract-of-services",
			data: row.data as Record<string, unknown>,
			updatedAt: row.updatedAt.toISOString(),
			createdAt: row.createdAt.toISOString(),
		}
	}
}
