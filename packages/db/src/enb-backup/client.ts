import { drizzle } from "drizzle-orm/node-postgres"

import { enbBackupSchema } from "./schema.js"

let backupDb: ReturnType<typeof drizzle<typeof enbBackupSchema>> | null = null

/**
 * Lazy Drizzle client for the ENB backup database.
 * Returns null when ENB_BACKUP_DATABASE_URL is unset.
 */
export function getEnbBackupDb(connectionString?: string) {
	const url = connectionString?.trim() || process.env.ENB_BACKUP_DATABASE_URL?.trim()
	if (!url) return null
	if (!backupDb) {
		backupDb = drizzle(url, { schema: enbBackupSchema })
	}
	return backupDb
}

export function resetEnbBackupDbForTests() {
	backupDb = null
}
