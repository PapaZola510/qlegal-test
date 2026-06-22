import { hitpayHeaders, hitpayRequest } from "./hitpay.client"

export interface CreateHitpayQrphPaymentParams {
	amountPhp: number
	referenceNumber: string
	purpose: string
	email?: string
	name?: string
}

export interface HitpayPaymentRequestResult {
	id: string
	url: string
	status: string
	amount: string
	currency: string
	qrCode: string | null
	checkoutUrl: string | null
}

interface HitpayPaymentRequestResponse {
	id: string
	url: string
	status: string
	amount: string
	currency: string
	qr_code_data?: {
		qr_code?: string
		qr_code_expiry?: string | null
	}
}

function formatAmountForHitpay(amountPhp: number): string {
	const whole = Math.floor(amountPhp)
	if (!Number.isFinite(whole) || whole <= 0) {
		throw new Error("Amount must be a positive integer (PHP)")
	}
	return `${whole}.00`
}

function buildPaymentRequestBody(
	params: CreateHitpayQrphPaymentParams,
	generateQr: boolean
): URLSearchParams {
	const body = new URLSearchParams()
	body.set("amount", formatAmountForHitpay(params.amountPhp))
	body.set("currency", "php")
	body.append("payment_methods[]", "qrph_netbank")
	if (generateQr) {
		body.set("generate_qr", "true")
	}
	body.set("purpose", params.purpose.slice(0, 255))
	body.set("reference_number", params.referenceNumber.slice(0, 255))
	body.set("email", params.email?.trim() || "meeting-payments@qlegal.local")
	if (params.name?.trim()) {
		body.set("name", params.name.trim().slice(0, 255))
	}
	body.set("send_email", "false")
	body.set("send_sms", "false")
	body.set("allow_repeated_payments", "false")
	return body
}

function isHitpayEmbeddedQrServerError(error: unknown): boolean {
	return error instanceof Error && /HitPay API error: 500/.test(error.message)
}

async function postPaymentRequest(
	params: CreateHitpayQrphPaymentParams,
	generateQr: boolean
): Promise<HitpayPaymentRequestResponse> {
	return hitpayRequest<HitpayPaymentRequestResponse>("/payment-requests", {
		method: "POST",
		headers: {
			...hitpayHeaders(),
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: buildPaymentRequestBody(params, generateQr).toString(),
	})
}

function shapePaymentResult(response: HitpayPaymentRequestResponse): HitpayPaymentRequestResult {
	const checkoutUrl = response.url?.trim() || null
	const qrRaw = response.qr_code_data?.qr_code
	const embeddedQr = typeof qrRaw === "string" && qrRaw.trim().length > 0 ? qrRaw.trim() : null
	// Sandbox often rejects generate_qr for qrph_netbank; encode hosted checkout as scannable QR.
	const qrCode = embeddedQr ?? checkoutUrl

	return {
		id: response.id,
		url: response.url,
		status: response.status,
		amount: response.amount,
		currency: response.currency,
		qrCode,
		checkoutUrl,
	}
}

export async function createHitpayQrphPaymentRequest(
	params: CreateHitpayQrphPaymentParams
): Promise<HitpayPaymentRequestResult> {
	try {
		const response = await postPaymentRequest(params, true)
		return shapePaymentResult(response)
	} catch (error) {
		if (!isHitpayEmbeddedQrServerError(error)) {
			throw error
		}
		const response = await postPaymentRequest(params, false)
		return shapePaymentResult(response)
	}
}
