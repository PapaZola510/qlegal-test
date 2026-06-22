import { isTlpeBrandUnavailableOnTestApi } from "./tlpe-brand-availability"
import { fetchTlpePaymentOptions, type TlpePaymentOption } from "./tlpe-options"
import { tlpePaymentLinkConfigured } from "./tlpe.client"

/** TLPE integration path used for meeting session payments on this server. */
export type TlpeIntegrationProcess = "checkout" | "direct_payment" | "easy_payment_link"

/** Per-brand checkout behavior after POST /checkout (or on Easy Payment Link page). */
export type TlpeBrandCheckoutProcess =
	| "tlpe_hosted_checkout"
	| "ewallet_redirect"
	| "card_checkout"
	| "easy_payment_link_selector"

export interface TlpePaymentBrandWithProcess {
	code: string
	label: string
	image?: string
	checkoutProcess: TlpeBrandCheckoutProcess
	processSummary: string
	clientSteps: string[]
}

export function resolveTlpeIntegrationProcess(): TlpeIntegrationProcess {
	if (!tlpePaymentLinkConfigured()) {
		throw new Error(
			"TLPE_PAYMENT_LINK_URL is not configured. AltPayNet Easy Payment Link is required."
		)
	}
	return "easy_payment_link"
}

function normalizeBrandLabel(value: string): string {
	return value.trim().toLowerCase()
}

export function inferBrandCheckoutProcess(label: string): TlpeBrandCheckoutProcess {
	const normalized = normalizeBrandLabel(label)

	if (
		normalized.includes("visa") ||
		normalized.includes("master") ||
		normalized.includes("mastercard") ||
		normalized.includes("card")
	) {
		return "card_checkout"
	}

	if (
		normalized.includes("gcash") ||
		normalized.includes("maya") ||
		normalized.includes("grab") ||
		normalized.includes("paymaya")
	) {
		return "ewallet_redirect"
	}

	if (
		normalized.includes("qr") ||
		normalized.includes("instapay") ||
		normalized.includes("pesonet") ||
		normalized.includes("bank")
	) {
		return "tlpe_hosted_checkout"
	}

	return "tlpe_hosted_checkout"
}

function brandProcessCopy(
	checkoutProcess: TlpeBrandCheckoutProcess,
	label: string,
	integration: TlpeIntegrationProcess
): Pick<TlpePaymentBrandWithProcess, "processSummary" | "clientSteps"> {
	if (integration === "easy_payment_link") {
		return {
			processSummary: `Open the AltPayNet payment page and choose ${label}.`,
			clientSteps: [
				"Tap Show payment QR to generate a payment link.",
				`On the AltPayNet page, select ${label} and complete payment.`,
				"Return here — status updates automatically once AltPayNet confirms payment.",
			],
		}
	}

	switch (checkoutProcess) {
		case "ewallet_redirect":
			return {
				processSummary: `Redirects to the ${label} app or web cashier to authorize payment.`,
				clientSteps: [
					`Select ${label} and tap Show payment QR.`,
					"Scan the QR or open the payment link.",
					`Complete payment in ${label}; you will be returned when done.`,
				],
			}
		case "card_checkout":
			return {
				processSummary: `Opens AltPayNet hosted card checkout for ${label}.`,
				clientSteps: [
					`Select ${label} and tap Show payment QR.`,
					"Scan the QR or open the payment link.",
					"Enter card details on the secure AltPayNet page to pay.",
				],
			}
		case "tlpe_hosted_checkout":
		default:
			return {
				processSummary: `Opens AltPayNet hosted checkout for ${label}. The scannable QR Ph code is on that page.`,
				clientSteps: [
					`Select ${label} and tap Get payment link.`,
					"Open the AltPayNet checkout page in your browser.",
					"Scan the QR Ph code on that page with your banking app (not the link QR in qLegal).",
				],
			}
	}
}

export function mapTlpeOptionToBrand(
	option: TlpePaymentOption,
	integration: TlpeIntegrationProcess
): TlpePaymentBrandWithProcess {
	const label = option.value || option.code
	const checkoutProcess =
		integration === "easy_payment_link"
			? "easy_payment_link_selector"
			: inferBrandCheckoutProcess(label)
	const copy = brandProcessCopy(checkoutProcess, label, integration)

	const brand: TlpePaymentBrandWithProcess = {
		code: option.code,
		label,
		checkoutProcess,
		processSummary: copy.processSummary,
		clientSteps: copy.clientSteps,
	}
	if (option.image) brand.image = option.image
	return brand
}

/** GET /options mapped to brands with per-integration process instructions. */
export async function listTlpePaymentBrands(): Promise<{
	integrationProcess: TlpeIntegrationProcess
	brands: TlpePaymentBrandWithProcess[]
}> {
	const integrationProcess = resolveTlpeIntegrationProcess()
	const options = await fetchTlpePaymentOptions()
	return {
		integrationProcess,
		brands: options
			.filter(option => !isTlpeBrandUnavailableOnTestApi(option.value))
			.map(option => mapTlpeOptionToBrand(option, integrationProcess)),
	}
}
