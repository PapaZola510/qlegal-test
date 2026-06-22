import {
	isEnpScCommissionSyncStale,
	SC_COMMISSION_SYNC_STALE_MS,
} from "./sc-commission-sync-policy"

describe("sync-enp-sc-commission-status", () => {
	it("treats missing sync timestamp as stale", () => {
		expect(
			isEnpScCommissionSyncStale({
				scCommissionStatusSyncedAt: null,
				scCommissionStatusAdminOverride: false,
			})
		).toBe(true)
	})

	it("skips stale check while admin override is active", () => {
		expect(
			isEnpScCommissionSyncStale({
				scCommissionStatusSyncedAt: null,
				scCommissionStatusAdminOverride: true,
			})
		).toBe(false)
	})

	it("respects stale interval", () => {
		const now = Date.now()
		expect(
			isEnpScCommissionSyncStale(
				{
					scCommissionStatusSyncedAt: new Date(now - SC_COMMISSION_SYNC_STALE_MS + 60_000),
					scCommissionStatusAdminOverride: false,
				},
				now
			)
		).toBe(false)
		expect(
			isEnpScCommissionSyncStale(
				{
					scCommissionStatusSyncedAt: new Date(now - SC_COMMISSION_SYNC_STALE_MS - 1),
					scCommissionStatusAdminOverride: false,
				},
				now
			)
		).toBe(true)
	})
})
