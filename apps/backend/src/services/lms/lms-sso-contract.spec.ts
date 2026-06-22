import {
	buildLmsSsoCreateCodeRequestBody,
	resolveSsoCodeExpiresInSeconds,
} from "./lms-sso-contract"

describe("buildLmsSsoCreateCodeRequestBody", () => {
	it("matches QLearn spec (id, email, redirectUri, classCode only)", () => {
		expect(
			buildLmsSsoCreateCodeRequestBody({
				id: "user-1",
				email: "user@example.com",
				redirectUri: "https://qlearn.quanbyit.com/student/courses/view?id=crs_0bc482f1ea0b0eafb95d",
				classCode: "qlegal-12345",
			})
		).toEqual({
			id: "user-1",
			email: "user@example.com",
			redirectUri: "https://qlearn.quanbyit.com/student/courses/view?id=crs_0bc482f1ea0b0eafb95d",
			classCode: "qlegal-12345",
		})
	})
})

describe("resolveSsoCodeExpiresInSeconds", () => {
	it("prefers expiresInSeconds from response", () => {
		expect(resolveSsoCodeExpiresInSeconds({ expiresInSeconds: 90 }, 120)).toBe(90)
	})

	it("derives TTL from expiresAt when seconds field is absent", () => {
		const expiresAt = new Date(Date.now() + 45_000).toISOString()
		const seconds = resolveSsoCodeExpiresInSeconds({ expiresAt }, 120)
		expect(seconds).toBeGreaterThanOrEqual(44)
		expect(seconds).toBeLessThanOrEqual(45)
	})

	it("falls back when response has no expiry fields", () => {
		expect(resolveSsoCodeExpiresInSeconds({}, 120)).toBe(120)
	})
})
