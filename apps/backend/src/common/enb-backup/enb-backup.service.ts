import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { eq, sql } from "drizzle-orm"

import { getEnbBackupDb } from "@repo/db/enb-backup/client"
import { enbBackupRegistryActs } from "@repo/db/enb-backup/schema"
import { registryActs } from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import { env } from "@/config/env.config"

type RegistryActRow = typeof registryActs.$inferSelect

@Injectable()
export class EnbBackupService implements OnModuleInit {
	private readonly log = new Logger(EnbBackupService.name)

	onModuleInit(): void {
		if (this.isEnabled()) {
			this.log.log("ENB backup database configured — registry writes will mirror to backup DB")
		} else {
			this.log.warn(
				"ENB_BACKUP_DATABASE_URL is unset — registry backup is disabled. Set it in apps/backend/.env and restart."
			)
		}
	}

	isEnabled(): boolean {
		return Boolean(env.ENB_BACKUP_DATABASE_URL?.trim())
	}

	private backupValues(row: RegistryActRow) {
		return {
			sourceActId: row.id,
			enpUserId: row.enpUserId,
			appointmentId: row.appointmentId,
			actNumber: row.actNumber,
			actType: row.actType,
			title: row.title,
			parties: row.parties,
			executedAt: row.executedAt,
			documentUrl: row.documentUrl,
			bookNo: row.bookNo,
			pageNo: row.pageNo,
			feePhp: row.feePhp,
			description: row.description,
			scStatus: row.scStatus,
			scSubmittedAt: row.scSubmittedAt,
			scSyncedAt: row.scSyncedAt,
			scRejectionReason: row.scRejectionReason,
			scExternalRef: row.scExternalRef,
			entryNumber: row.entryNumber,
			completionStatus: row.completionStatus,
			incompleteReason: row.incompleteReason,
			incompleteCircumstances: row.incompleteCircumstances,
			sourceCreatedAt: row.createdAt,
			sourceUpdatedAt: row.updatedAt,
			backedUpAt: new Date(),
		}
	}

	async syncRow(row: RegistryActRow): Promise<void> {
		const backupDb = getEnbBackupDb(env.ENB_BACKUP_DATABASE_URL)
		if (!backupDb) return

		try {
			await backupDb
				.insert(enbBackupRegistryActs)
				.values(this.backupValues(row))
				.onConflictDoUpdate({
					target: enbBackupRegistryActs.sourceActId,
					set: {
						enpUserId: sql`excluded.enp_user_id`,
						appointmentId: sql`excluded.appointment_id`,
						actNumber: sql`excluded.act_number`,
						actType: sql`excluded.act_type`,
						title: sql`excluded.title`,
						parties: sql`excluded.parties`,
						executedAt: sql`excluded.executed_at`,
						documentUrl: sql`excluded.document_url`,
						bookNo: sql`excluded.book_no`,
						pageNo: sql`excluded.page_no`,
						feePhp: sql`excluded.fee_php`,
						description: sql`excluded.description`,
						scStatus: sql`excluded.sc_status`,
						scSubmittedAt: sql`excluded.sc_submitted_at`,
						scSyncedAt: sql`excluded.sc_synced_at`,
						scRejectionReason: sql`excluded.sc_rejection_reason`,
						scExternalRef: sql`excluded.sc_external_ref`,
						entryNumber: sql`excluded.entry_number`,
						completionStatus: sql`excluded.completion_status`,
						incompleteReason: sql`excluded.incomplete_reason`,
						incompleteCircumstances: sql`excluded.incomplete_circumstances`,
						sourceCreatedAt: sql`excluded.source_created_at`,
						sourceUpdatedAt: sql`excluded.source_updated_at`,
						backedUpAt: sql`excluded.backed_up_at`,
					},
				})
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			const schemaHint = /column|does not exist|42703/i.test(msg)
				? " Run `pnpm db:push:enb-backup` to migrate the ENB backup database."
				: ""
			this.log.error(`ENB backup sync failed for act ${row.id}: ${msg.slice(0, 300)}${schemaHint}`)
		}
	}

	scheduleSyncActById(actId: string): void {
		if (!this.isEnabled()) return
		void this.syncActById(actId).catch(e => {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.warn(`ENB backup async sync failed for ${actId}: ${msg.slice(0, 200)}`)
		})
	}

	async syncActById(actId: string): Promise<void> {
		if (!this.isEnabled()) return
		const [row] = await db.select().from(registryActs).where(eq(registryActs.id, actId)).limit(1)
		if (!row) return
		await this.syncRow(row)
	}

	/** Backfill all registry acts into the backup database (ops / first deploy). */
	async reconcileAll(): Promise<{ synced: number; skipped: boolean }> {
		if (!this.isEnabled()) return { synced: 0, skipped: true }
		const rows = await db.select().from(registryActs)
		for (const row of rows) {
			await this.syncRow(row)
		}
		return { synced: rows.length, skipped: false }
	}
}
