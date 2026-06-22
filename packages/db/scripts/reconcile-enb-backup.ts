/**
 * Backfill ENB backup DB from primary registry_acts.
 * Usage: ENB_BACKUP_DATABASE_URL=... DATABASE_URL=... pnpm exec tsx scripts/reconcile-enb-backup.ts
 */
import "dotenv/config"

import { getEnbBackupDb } from "../src/enb-backup/client.js"
import { enbBackupRegistryActs } from "../src/enb-backup/schema.js"
import { createDBClient } from "../src/client.js"
import { registryActs } from "../src/schema.js"

async function main() {
	const backupUrl = process.env.ENB_BACKUP_DATABASE_URL?.trim()
	if (!backupUrl) {
		console.error("ENB_BACKUP_DATABASE_URL is required")
		process.exit(1)
	}

	const primary = createDBClient()
	const backup = getEnbBackupDb(backupUrl)
	if (!backup) {
		console.error("Failed to open ENB backup database")
		process.exit(1)
	}

	const rows = await primary.select().from(registryActs)
	let synced = 0
	for (const row of rows) {
		await backup
			.insert(enbBackupRegistryActs)
			.values({
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
				sourceCreatedAt: row.createdAt,
				sourceUpdatedAt: row.updatedAt,
				backedUpAt: new Date(),
			})
			.onConflictDoUpdate({
				target: enbBackupRegistryActs.sourceActId,
				set: { backedUpAt: new Date(), sourceUpdatedAt: row.updatedAt },
			})
		synced++
	}

	console.log(`ENB backup reconcile complete: ${synced} act(s) synced from primary registry.`)
}

main().catch(err => {
	console.error(err)
	process.exit(1)
})
