import { env } from "@/config/env.config"

import type { TlpeCustomerInput } from "./tlpe-customer-mapper"
import { buildTlpeEasyPaymentLinkBody } from "./tlpe-payload"
import { tlpeAuthorizationHeader, tlpePaymentLinkUrl } from "./tlpe.client"

export interface CreateEasyPaymentLinkInput {
	amountPhp: number
	transactionId: string
	description: string
	customer: TlpeCustomerInput
	/** Processing / convenience fee passed to TLPE (PHP, string per API). */
	convenienceFixedFeePhp?: number
	/** TLPE payment option code from GET /options; pre-selects brand on EPL when set. */
	paymentOptionCode?: string
}

export interface EasyPaymentLinkResult {
	link: string
	transactionId: string
}

interface EasyPaymentLinkApiResponse {
	link?: string
}

/**
 * Create a dynamic Easy Payment Link ([docs](https://developers.tlpe.io/easy-payment-link/)).
 * Requires TLPE_PAYMENT_LINK_URL from AltPayNet onboarding.
 */
export async function createEasyPaymentLink(
	input: CreateEasyPaymentLinkInput
): Promise<EasyPaymentLinkResult> {
	const paymentLinkUrl = tlpePaymentLinkUrl()
	const authorizationToken = tlpeAuthorizationHeader()
	const callbackUrl = env.TLPE_CALLBACK_URL?.trim() || undefined

	const body = buildTlpeEasyPaymentLinkBody(
		{
			amountPhp: input.amountPhp,
			transactionId: input.transactionId,
			description: input.description,
			customer: input.customer,
			paymentOptionCode: input.paymentOptionCode?.trim() ?? "",
			callbackUrl,
			notifyUser: false,
		},
		authorizationToken
	)

	// Easy link payment object uses merchant_reference_id; option not required on hosted link form.
	const payment = body.payment as Record<string, unknown>
	if (
		input.convenienceFixedFeePhp !== null &&
		input.convenienceFixedFeePhp !== undefined &&
		input.convenienceFixedFeePhp > 0
	) {
		payment.convenienceFixedFee = String(Math.floor(input.convenienceFixedFeePhp))
	}

	const response = await fetch(paymentLinkUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	})

	if (!response.ok) {
		const errorText = await response.text()
		throw new Error(
			`TLPE Easy Payment Link error: ${response.status} ${response.statusText} - ${errorText}`
		)
	}

	const data = (await response.json()) as EasyPaymentLinkApiResponse
	const link = typeof data.link === "string" ? data.link.trim() : ""
	if (!link) {
		throw new Error("TLPE Easy Payment Link response missing link")
	}

	return { link, transactionId: input.transactionId }
}
