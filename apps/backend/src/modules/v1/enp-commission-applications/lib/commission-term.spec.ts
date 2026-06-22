import { computeCommissionTermEnd } from "./commission-term"

describe("computeCommissionTermEnd", () => {
	it("ends on Dec 31 of the next UTC year for mid-year commissions", () => {
		const result = computeCommissionTermEnd(new Date("2026-06-10T05:30:00.000Z"))

		expect(result.toISOString()).toBe("2027-12-31T23:59:59.999Z")
	})

	it("ends on Dec 31 of the next UTC year for Jan 1 commissions", () => {
		const result = computeCommissionTermEnd(new Date("2026-01-01T00:00:00.000Z"))

		expect(result.toISOString()).toBe("2027-12-31T23:59:59.999Z")
	})

	it("uses the commission date UTC year at the Dec 31 boundary", () => {
		const result = computeCommissionTermEnd(new Date("2026-12-31T23:59:59.999Z"))

		expect(result.toISOString()).toBe("2027-12-31T23:59:59.999Z")
	})
})
