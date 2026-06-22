import { Logger } from "@nestjs/common"
import { eq } from "drizzle-orm"

import { enpProfiles } from "@repo/db/schema"

import {
	getSupremeCourtAccessToken,
	queryNotaryCommissionStatus,
	scNormalizeId,
	supremeCourtIsConfigured,
} from "@/services/sc-registry/supreme-court-client"
import { db } from "@/common/database/database.client"

import { isEnpScCommissionSyncStale } from "./sc-commission-sync-policy"

const log = new Logger("SyncEnpScCommissionStatus")

type EnpScSyncRow = Pick<
	typeof enpProfiles.$inferSelect,
	| "userId"
	| "npnCommissionNo"
	| "rollNo"
	| "scCommissionStatusSyncedAt"
	| "scCommissionStatusAdminOverride"
>

export {
	isEnpScCommissionSyncStale,
	SC_COMMISSION_SYNC_STALE_MS,
} from "./sc-commission-sync-policy"

function scCommissionStatusForStorage(normalizedStatus: string): string {
	return normalizedStatus === "canceled" ? "cancelled" : normalizedStatus
}

export async function persistEnpScCommissionStatus(
	userId: string,
	normalizedStatus: string,
	options?: { adminOverride?: boolean }
): Promise<void> {
	const now = new Date()
	const storedStatus = scCommissionStatusForStorage(normalizedStatus)
	await db
		.update(enpProfiles)
		.set({
			scCommissionStatus: storedStatus,
			scCommissionStatusSyncedAt: now,
			scCommissionStatusAdminOverride: options?.adminOverride ?? false,
			updatedAt: now,
		})
		.where(eq(enpProfiles.userId, userId))
}

export async function syncEnpScCommissionStatusFromSc(
	userId: string,
	options?: { force?: boolean }
): Promise<{ synced: boolean; status: string | null }> {
	if (!supremeCourtIsConfigured()) {
		return { synced: false, status: null }
	}

	const [enp] = await db
		.select({
			userId: enpProfiles.userId,
			npnCommissionNo: enpProfiles.npnCommissionNo,
			rollNo: enpProfiles.rollNo,
			scCommissionStatusSyncedAt: enpProfiles.scCommissionStatusSyncedAt,
			scCommissionStatusAdminOverride: enpProfiles.scCommissionStatusAdminOverride,
		})
		.from(enpProfiles)
		.where(eq(enpProfiles.userId, userId))
		.limit(1)

	if (!enp?.npnCommissionNo?.trim() || !enp.rollNo?.trim()) {
		return { synced: false, status: null }
	}
	if (!options?.force) {
		if (enp.scCommissionStatusAdminOverride) {
			return { synced: false, status: null }
		}
		if (!isEnpScCommissionSyncStale(enp)) {
			return { synced: false, status: null }
		}
	}

	try {
		const token = await getSupremeCourtAccessToken()
		const npn = scNormalizeId(enp.npnCommissionNo, "NPN-")
		const rn = scNormalizeId(enp.rollNo, "RN-")
		const { normalizedStatus } = await queryNotaryCommissionStatus({ token, npn, rn })
		await persistEnpScCommissionStatus(userId, normalizedStatus, { adminOverride: false })
		return { synced: true, status: normalizedStatus }
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error)
		log.warn(`SC commission sync skipped for ENP ${userId}: ${msg.slice(0, 240)}`)
		return { synced: false, status: null }
	}
}

export async function syncEnpScCommissionStatusIfStale(userId: string): Promise<boolean> {
	const result = await syncEnpScCommissionStatusFromSc(userId)
	return result.synced
}

export async function syncAllStaleEnpScCommissionStatuses(): Promise<number> {
	if (!supremeCourtIsConfigured()) return 0

	const rows = await db
		.select({
			userId: enpProfiles.userId,
			npnCommissionNo: enpProfiles.npnCommissionNo,
			rollNo: enpProfiles.rollNo,
			scCommissionStatusSyncedAt: enpProfiles.scCommissionStatusSyncedAt,
			scCommissionStatusAdminOverride: enpProfiles.scCommissionStatusAdminOverride,
		})
		.from(enpProfiles)

	let synced = 0
	for (const row of rows) {
		if (!row.npnCommissionNo?.trim() || !row.rollNo?.trim()) continue
		if (!isEnpScCommissionSyncStale(row)) continue
		const result = await syncEnpScCommissionStatusFromSc(row.userId, { force: true })
		if (result.synced) synced += 1
	}
	return synced
}
