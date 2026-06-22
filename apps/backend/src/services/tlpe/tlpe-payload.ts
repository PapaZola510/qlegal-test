import { randomUUID } from "node:crypto"

import type { TlpeCustomerInput } from "./tlpe-customer-mapper"

const TLPE_CHECKOUT_JWT_TTL_SEC = 300

const DEFAULT_PH = {
	line1: "Philippines",
	line2: "N/A",
	city_municipality: "Manila",
	zip: "1000",
	state_province_region: "NCR",
	country_code: "PH",
	mobile: "+639000000000",
}

function splitName(full: string): { firstName: string; lastName: string } {
	const trimmed = full.trim()
	if (!trimmed) return { firstName: "Client", lastName: "User" }
	const parts = trimmed.split(/\s+/)
	if (parts.length === 1) return { firstName: parts[0]!, lastName: "." }
	const lastName = parts.pop()!
	return { firstName: parts.join(" "), lastName }
}

function formatTlpeAmount(amountPhp: number): number {
	return Math.round(Math.max(1, amountPhp) * 100) / 100
}

export interface BuildTlpeTransactionPayloadInput {
	amountPhp: number
	transactionId: string
	description: string
	customer: TlpeCustomerInput
	paymentOptionCode: string
	callbackUrl?: string
	notifyUser?: boolean
}

/** Nested `data` object for TLPE checkout JWT ([API reference](https://developers.tlpe.io/api-reference/)). */
export function buildTlpeTransactionPayload(input: BuildTlpeTransactionPayloadInput): {
	data: Record<string, unknown>
} {
	const email =
		typeof input.customer.email === "string" && input.customer.email.includes("@")
			? input.customer.email.trim()
			: "client@qlegal.local"
	const { firstName, lastName } = splitName(input.customer.name ?? "Client User")
	const mobile =
		typeof input.customer.phone === "string" && input.customer.phone.trim().length >= 10
			? input.customer.phone.trim().startsWith("+")
				? input.customer.phone.trim()
				: `+63${input.customer.phone.trim().replace(/^0/, "")}`
			: DEFAULT_PH.mobile

	const billing = {
		line1:
			typeof input.customer.address === "string" && input.customer.address.trim().length > 0
				? input.customer.address.trim()
				: DEFAULT_PH.line1,
		line2: DEFAULT_PH.line2,
		city_municipality:
			typeof input.customer.city === "string" && input.customer.city.trim().length > 0
				? input.customer.city.trim()
				: DEFAULT_PH.city_municipality,
		zip:
			typeof input.customer.zipCode === "string" && input.customer.zipCode.trim().length > 0
				? input.customer.zipCode.trim()
				: DEFAULT_PH.zip,
		state_province_region:
			typeof input.customer.province === "string" && input.customer.province.trim().length > 0
				? input.customer.province.trim()
				: DEFAULT_PH.state_province_region,
		country_code: DEFAULT_PH.country_code,
	}

	return {
		data: {
			customer: {
				first_name: firstName,
				last_name: lastName,
				billing_address: billing,
				shipping_address: billing,
				contact: { email, mobile },
			},
			payment: {
				description: input.description.slice(0, 200),
				amount: formatTlpeAmount(input.amountPhp),
				currency: "PHP",
				option: input.paymentOptionCode,
				merchant_reference_id: input.transactionId,
			},
			route: {
				...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
				notify_user: input.notifyUser ?? false,
			},
			time_offset: "+08:00",
		},
	}
}

/** Router JWT envelope for signed TLPE endpoints (checkout, direct payment, etc.). */
export function buildTlpeRouterJwtPayload(
	path: string,
	data: Record<string, unknown>
): Record<string, unknown> {
	const now = Math.floor(Date.now() / 1000)
	return {
		iss: "TLPE",
		sub: "TLPE Base Router Authentication",
		aud: "TLPE Base Router",
		exp: now + TLPE_CHECKOUT_JWT_TTL_SEC,
		iat: now,
		jti: randomUUID(),
		method: "POST",
		path,
		data,
	}
}

/** Signed checkout JWT — POST /checkout ([docs](https://developers.tlpe.io/post-payment-checkout/)). */
export function buildTlpeCheckoutJwtPayload(
	data: Record<string, unknown>
): Record<string, unknown> {
	return buildTlpeRouterJwtPayload("/checkout", data)
}

/** Signed direct payment JWT — POST /payment ([docs](https://developers.tlpe.io/post-direct-payment/)). */
export function buildTlpeDirectJwtPayload(data: Record<string, unknown>): Record<string, unknown> {
	return buildTlpeRouterJwtPayload("/payment", data)
}

/** Flat body for Easy Payment Link POST ([docs](https://developers.tlpe.io/easy-payment-link/)). */
export function buildTlpeEasyPaymentLinkBody(
	input: BuildTlpeTransactionPayloadInput,
	authorizationToken: string
): Record<string, unknown> {
	const { data } = buildTlpeTransactionPayload(input)
	return {
		customer: data.customer,
		payment: data.payment,
		route: data.route,
		key: authorizationToken,
	}
}
