import { tlpeTestMode } from "./tlpe.client"

/** Brands that appear in GET /options but POST /checkout returns ER.02.00 on test-api.tlpe.io. */
const TLPE_TEST_UNAVAILABLE_BRAND_KEYS = new Set(["grabpay"])

export function brandMatchKey(label: string): string {
	return label.trim().toLowerCase().replace(/\s+/g, "")
}

/** True when this brand cannot complete checkout on the TLPE test API (merchant/acquirer limitation). */
export function isTlpeBrandUnavailableOnTestApi(label: string): boolean {
	if (!tlpeTestMode()) return false
	return TLPE_TEST_UNAVAILABLE_BRAND_KEYS.has(brandMatchKey(label))
}

export function tlpeBrandUnavailableMessage(label: string): string {
	return `${label} is not available on the AltPayNet TLPE test API (ER.02.00). Use Maya, GCash, or QR Ph for local testing, or ask AltPayNet to enable ${label} on your merchant account.`
}
