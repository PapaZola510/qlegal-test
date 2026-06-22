import {
	formatLmsMisconfigurationHint,
	looksLikeQlegalOrpcErrorBody,
	misconfiguredLmsBaseUrlMessage,
	validateLmsIntegrationBaseUrl,
} from "./lms-base-url"

describe("validateLmsIntegrationBaseUrl", () => {
	it("allows QLearn core API", () => {
		expect(() =>
			validateLmsIntegrationBaseUrl("https://qlearn-core.quanbyit.com/api/v1")
		).not.toThrow()
	})

	it("rejects QLegal staging host", () => {
		expect(() => validateLmsIntegrationBaseUrl("https://stg-qlegal.quanbyai.com/api/v1")).toThrow(
			/must not point at the QLegal app/
		)
	})

	it("rejects docker internal backend alias", () => {
		expect(() => validateLmsIntegrationBaseUrl("http://backend:3000/api/v1")).toThrow(/qlearn-core/)
	})

	it("rejects same host as public app", () => {
		expect(() =>
			validateLmsIntegrationBaseUrl("https://stg-qlegal.quanbyai.com/api/v1", {
				publicAppOrigin: "https://stg-qlegal.quanbyai.com",
			})
		).toThrow(/must not point at the QLegal app/)
	})
})

describe("looksLikeQlegalOrpcErrorBody", () => {
	it("detects oRPC internal server error JSON", () => {
		expect(
			looksLikeQlegalOrpcErrorBody(
				'{"defined":false,"code":"INTERNAL_SERVER_ERROR","status":500,"message":"Internal server error"}'
			)
		).toBe(true)
	})
})

describe("misconfiguredLmsBaseUrlMessage", () => {
	it("returns null for valid QLearn URL", () => {
		expect(misconfiguredLmsBaseUrlMessage("https://qlearn-core.quanbyit.com/api/v1")).toBeNull()
	})
})

describe("formatLmsMisconfigurationHint", () => {
	it("includes current base URL", () => {
		expect(formatLmsMisconfigurationHint("https://stg-qlegal.quanbyai.com/api/v1")).toContain(
			"stg-qlegal.quanbyai.com"
		)
	})
})
