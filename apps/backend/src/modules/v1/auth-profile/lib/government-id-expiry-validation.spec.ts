import {
	deriveGovernmentIdValidation,
	governmentIdWarningDismissKey,
	pickGovernmentIdWarningTier,
} from "./government-id-expiry-validation"

describe("government-id-expiry-validation", () => {
	const now = new Date("2026-06-01T12:00:00.000Z")

	it("blocks expired government ID", () => {
		const v = deriveGovernmentIdValidation(
			{
				governmentIdValidUntil: new Date("2026-05-31T12:00:00.000Z"),
				governmentIdExpiryNoticeDismissals: [],
				governmentIdExpiryNoticeSnoozeUntil: null,
			},
			now
		)
		expect(v.blocked).toBe(true)
		expect(v.status).toBe("blocked")
		expect(v.blockReason).toContain("identity verification")
	})

	it("warns at 30-day tier", () => {
		const v = deriveGovernmentIdValidation(
			{
				governmentIdValidUntil: new Date("2026-06-30T23:59:59.000Z"),
				governmentIdExpiryNoticeDismissals: [],
				governmentIdExpiryNoticeSnoozeUntil: null,
			},
			now
		)
		expect(v.status).toBe("expiring")
		expect(v.warningTier).toBe(30)
		expect(v.blocked).toBe(false)
	})

	it("does not warn more than 30 days before expiry", () => {
		const v = deriveGovernmentIdValidation(
			{
				governmentIdValidUntil: new Date("2026-07-15T23:59:59.000Z"),
				governmentIdExpiryNoticeDismissals: [],
				governmentIdExpiryNoticeSnoozeUntil: null,
			},
			now
		)
		expect(v.status).toBe("active")
		expect(v.warningTier).toBeNull()
	})

	it("maps day buckets", () => {
		expect(pickGovernmentIdWarningTier(25)).toBe(30)
		expect(pickGovernmentIdWarningTier(15)).toBe(20)
		expect(pickGovernmentIdWarningTier(1)).toBe(1)
		expect(pickGovernmentIdWarningTier(35)).toBeNull()
	})

	it("is active when no expiry on file", () => {
		const v = deriveGovernmentIdValidation(
			{
				governmentIdValidUntil: null,
				governmentIdExpiryNoticeDismissals: [],
				governmentIdExpiryNoticeSnoozeUntil: null,
			},
			now
		)
		expect(v.blocked).toBe(false)
		expect(v.status).toBe("active")
	})

	it("respects snooze", () => {
		const v = deriveGovernmentIdValidation(
			{
				governmentIdValidUntil: new Date("2026-06-30T23:59:59.000Z"),
				governmentIdExpiryNoticeDismissals: [],
				governmentIdExpiryNoticeSnoozeUntil: new Date("2026-06-02T18:00:00.000Z"),
			},
			now
		)
		expect(v.status).toBe("active")
		expect(v.warningTier).toBeNull()
	})

	it("respects dismissed tier", () => {
		const v = deriveGovernmentIdValidation(
			{
				governmentIdValidUntil: new Date("2026-06-30T23:59:59.000Z"),
				governmentIdExpiryNoticeDismissals: [governmentIdWarningDismissKey("2026-06-30", 30)],
				governmentIdExpiryNoticeSnoozeUntil: null,
			},
			now
		)
		expect(v.warningTier).toBeNull()
	})
})
