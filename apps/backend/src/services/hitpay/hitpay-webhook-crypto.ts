import { createHmac, timingSafeEqual } from "node:crypto"

const SIG_HEADER = "hitpay-signature"

export function computeHitpayWebhookSignature(salt: string, rawBody: Buffer): string {
	return createHmac("sha256", salt).update(rawBody).digest("hex")
}

export function verifyHitpayWebhookSignature(
	headers: Record<string, unknown>,
	rawBody: Buffer,
	salt: string
): void {
	const headerVal =
		headers[SIG_HEADER] ?? headers[SIG_HEADER.toUpperCase()] ?? headers["Hitpay-Signature"]
	if (typeof headerVal !== "string" || !headerVal) {
		throw new Error("Missing Hitpay-Signature header")
	}

	const expected = computeHitpayWebhookSignature(salt, rawBody)
	const a = Buffer.from(expected, "utf8")
	const b = Buffer.from(headerVal, "utf8")
	if (a.length !== b.length || !timingSafeEqual(a, b)) {
		throw new Error("Invalid Hitpay webhook signature")
	}
}
