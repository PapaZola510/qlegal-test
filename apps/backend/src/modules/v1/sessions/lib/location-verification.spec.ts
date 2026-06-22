import { isNearPhilippineEmbassy, verifyLocationForRole } from "./location-verification"

const MANILA_LAT = 14.5995
const MANILA_LNG = 120.9842
const WASHINGTON_EMBASSY_LAT = 38.9074
const WASHINGTON_EMBASSY_LNG = -77.0381

describe("verifyLocationForRole", () => {
	it("allows all roles when reverse-geocode country is PH", () => {
		for (const role of ["enp", "client"] as const) {
			const result = verifyLocationForRole(role, MANILA_LAT, MANILA_LNG, true)
			expect(result).toEqual({
				allowed: true,
				reason: "in_philippines",
				details: { isInPhilippines: true },
			})
		}
	})

	it("denies all roles outside PH with outside_philippines", () => {
		for (const role of ["enp", "client"] as const) {
			const result = verifyLocationForRole(
				role,
				WASHINGTON_EMBASSY_LAT,
				WASHINGTON_EMBASSY_LNG,
				false
			)
			expect(result).toEqual({
				allowed: false,
				reason: "outside_philippines",
				details: { isInPhilippines: false },
			})
		}
	})

	it("denies near a PH embassy abroad (no near_embassy allowance)", () => {
		expect(isNearPhilippineEmbassy(WASHINGTON_EMBASSY_LAT, WASHINGTON_EMBASSY_LNG)).toBe(true)

		const result = verifyLocationForRole(
			"client",
			WASHINGTON_EMBASSY_LAT,
			WASHINGTON_EMBASSY_LNG,
			false
		)
		expect(result.allowed).toBe(false)
		expect(result.reason).toBe("outside_philippines")
	})
})
