import { deriveEnpCommissionRecordStatus } from "./derive-enp-commission-record-status"

describe("deriveEnpCommissionRecordStatus", () => {
	it("marks revoked certificate as suspended", () => {
		expect(
			deriveEnpCommissionRecordStatus({
				certificateStatus: "revoked",
				commissionValidUntil: new Date("2030-01-01"),
				scCommissionStatus: "active",
			})
		).toBe("suspended")
	})

	it("marks SC unknown as suspended", () => {
		expect(
			deriveEnpCommissionRecordStatus({
				certificateStatus: "certified",
				commissionValidUntil: new Date("2030-01-01"),
				scCommissionStatus: "unknown",
			})
		).toBe("suspended")
	})

	it("marks SC disqualified as suspended", () => {
		expect(
			deriveEnpCommissionRecordStatus({
				certificateStatus: "certified",
				commissionValidUntil: new Date("2030-01-01"),
				scCommissionStatus: "disqualified",
			})
		).toBe("suspended")
	})

	it("marks past commission expiry as expired", () => {
		expect(
			deriveEnpCommissionRecordStatus({
				certificateStatus: "certified",
				commissionValidUntil: new Date("2020-01-01"),
				scCommissionStatus: "active",
			})
		).toBe("expired")
	})

	it("marks valid commission as active", () => {
		expect(
			deriveEnpCommissionRecordStatus({
				certificateStatus: "certified",
				commissionValidUntil: new Date("2030-01-01"),
				scCommissionStatus: "active",
			})
		).toBe("active")
	})
})
