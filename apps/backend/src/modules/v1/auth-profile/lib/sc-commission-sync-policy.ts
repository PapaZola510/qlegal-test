/** Re-fetch SC commission status at most once per ENP per interval (profile load + cron). */
export const SC_COMMISSION_SYNC_STALE_MS = 6 * 60 * 60 * 1000

export type EnpScSyncPolicyRow = {
	scCommissionStatusSyncedAt: Date | null
	scCommissionStatusAdminOverride: boolean
}

export function isEnpScCommissionSyncStale(row: EnpScSyncPolicyRow, now = Date.now()): boolean {
	if (row.scCommissionStatusAdminOverride) return false
	if (!row.scCommissionStatusSyncedAt) return true
	return now - row.scCommissionStatusSyncedAt.getTime() >= SC_COMMISSION_SYNC_STALE_MS
}
