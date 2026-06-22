import { env } from "@/config/env.config"

import { verifyHitpayWebhookSignature as verifyWithSalt } from "./hitpay-webhook-crypto"

export { computeHitpayWebhookSignature } from "./hitpay-webhook-crypto"

export function assertHitpayWebhookSignature(
	headers: Record<string, unknown>,
	rawBody: Buffer
): void {
	const salt = env.HITPAY_WEBHOOK_SALT?.trim()
	if (!salt) {
		throw new Error("HITPAY_WEBHOOK_SALT is not configured")
	}
	verifyWithSalt(headers, rawBody, salt)
}
