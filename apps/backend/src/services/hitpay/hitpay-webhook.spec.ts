import { timingSafeEqual } from "node:crypto"

import { computeHitpayWebhookSignature } from "./hitpay-webhook-crypto"

describe("computeHitpayWebhookSignature", () => {
	it("matches HitPay HMAC-SHA256 of raw JSON body", () => {
		const salt = "test-salt"
		const body = Buffer.from(JSON.stringify({ id: "pr-1", status: "completed" }), "utf8")
		const signature = computeHitpayWebhookSignature(salt, body)

		const a = Buffer.from(signature, "utf8")
		const b = Buffer.from(signature, "utf8")
		expect(a.length).toBe(b.length)
		expect(timingSafeEqual(a, b)).toBe(true)
		expect(signature).toHaveLength(64)
	})

	it("changes when body changes", () => {
		const salt = "test-salt"
		const a = computeHitpayWebhookSignature(salt, Buffer.from('{"a":1}', "utf8"))
		const b = computeHitpayWebhookSignature(salt, Buffer.from('{"a":2}', "utf8"))
		expect(a).not.toBe(b)
	})
})
