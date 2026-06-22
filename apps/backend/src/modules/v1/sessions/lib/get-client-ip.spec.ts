import type { Request } from "express"

import { resolveEffectiveClientIp } from "./get-client-ip"

function mockReq(overrides: Partial<Request> = {}): Request {
	return {
		headers: {},
		socket: { remoteAddress: "127.0.0.1" },
		ip: "127.0.0.1",
		...overrides,
	} as Request
}

describe("resolveEffectiveClientIp", () => {
	it("uses browser egress IP when server only sees localhost", () => {
		const result = resolveEffectiveClientIp(mockReq(), "203.0.114.50")
		expect(result.ip).toBe("203.0.114.50")
		expect(result.browserIp).toBe("203.0.114.50")
		expect(result.ipPathMismatch).toBe(false)
	})

	it("flags mismatch when header and browser public IPs differ", () => {
		const result = resolveEffectiveClientIp(
			mockReq({ headers: { "x-forwarded-for": "8.8.8.8" } }),
			"203.0.114.50"
		)
		expect(result.ipPathMismatch).toBe(true)
		expect(result.ip).toBe("203.0.114.50")
	})

	it("prefers header public IP when it matches browser egress", () => {
		const result = resolveEffectiveClientIp(
			mockReq({ headers: { "x-forwarded-for": "203.0.114.50" } }),
			"203.0.114.50"
		)
		expect(result.ipPathMismatch).toBe(false)
		expect(result.ip).toBe("203.0.114.50")
	})
})
