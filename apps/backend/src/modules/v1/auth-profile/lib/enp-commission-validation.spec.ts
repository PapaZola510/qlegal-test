import {
	commissionWarningDismissKey,
	deriveEnpCommissionValidation,
	pickCommissionWarningTier,
} from "./enp-commission-validation"

describe("enp-commission-validation", () => {
	const now = new Date("2026-06-01T12:00:00.000Z")

	it("blocks expired commission", () => {
		const v = deriveEnpCommissionValidation(
			{
				certificateStatus: "certified",
				commissionValidUntil: new Date("2026-05-31T12:00:00.000Z"),
				commissionExpiryNoticeDismissals: [],
				commissionExpiryNoticeSnoozeUntil: null,
				scCommissionStatus: "active",
			},
			now
		)
		expect(v.blocked).toBe(true)
		expect(v.blockCategory).toBe("expired")
	})

	it("warns at 30-day tier", () => {
		const v = deriveEnpCommissionValidation(
			{
				certificateStatus: "certified",
				commissionValidUntil: new Date("2026-06-30T23:59:59.000Z"),
				commissionExpiryNoticeDismissals: [],
				commissionExpiryNoticeSnoozeUntil: null,
				scCommissionStatus: "active",
			},
			now
		)
		expect(v.status).toBe("expiring")
		expect(v.warningTier).toBe(30)
		expect(v.blocked).toBe(false)
	})

	it("respects dismissed warning tier", () => {
		const v = deriveEnpCommissionValidation(
			{
				certificateStatus: "certified",
				commissionValidUntil: new Date("2026-06-30T23:59:59.000Z"),
				commissionExpiryNoticeDismissals: [commissionWarningDismissKey("2026-06-30", 30)],
				commissionExpiryNoticeSnoozeUntil: null,
				scCommissionStatus: "active",
			},
			now
		)
		expect(v.status).toBe("active")
		expect(v.warningTier).toBeNull()
	})

	it("blocks SC unknown status", () => {
		const v = deriveEnpCommissionValidation(
			{
				certificateStatus: "certified",
				commissionValidUntil: new Date("2027-03-13T12:00:00.000Z"),
				commissionExpiryNoticeDismissals: [],
				commissionExpiryNoticeSnoozeUntil: null,
				scCommissionStatus: "unknown",
			},
			now
		)
		expect(v.blocked).toBe(true)
		expect(v.blockCategory).toBe("unknown")
	})

	it("blocks SC disqualified status", () => {
		const v = deriveEnpCommissionValidation(
			{
				certificateStatus: "certified",
				commissionValidUntil: new Date("2027-03-13T12:00:00.000Z"),
				commissionExpiryNoticeDismissals: [],
				commissionExpiryNoticeSnoozeUntil: null,
				scCommissionStatus: "disqualified",
			},
			now
		)
		expect(v.blocked).toBe(true)
		expect(v.blockCategory).toBe("disqualified")
	})

	it("hides warning while snoozed", () => {
		const v = deriveEnpCommissionValidation(
			{
				certificateStatus: "certified",
				commissionValidUntil: new Date("2026-06-30T23:59:59.000Z"),
				commissionExpiryNoticeDismissals: [],
				commissionExpiryNoticeSnoozeUntil: new Date("2026-06-02T18:00:00.000Z"),
				scCommissionStatus: "active",
			},
			now
		)
		expect(v.status).toBe("active")
		expect(v.warningTier).toBeNull()
	})

	it("maps day buckets", () => {
		expect(pickCommissionWarningTier(25)).toBe(30)
		expect(pickCommissionWarningTier(15)).toBe(20)
		expect(pickCommissionWarningTier(1)).toBe(1)
		expect(pickCommissionWarningTier(35)).toBeNull()
	})
})
