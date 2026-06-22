import { hitpayRequest } from "./hitpay.client"

export interface HitpayPaymentRequestStatus {
	id: string
	status: string
	referenceNumber: string | null
	amountPhp: number
}

interface HitpayPaymentRequestGetResponse {
	id: string
	status: string
	reference_number?: string | null
	amount?: string
}

function parseAmountPhp(amount: string | undefined): number | null {
	if (typeof amount !== "string") return null
	const n = Number.parseFloat(amount)
	if (!Number.isFinite(n) || n <= 0) return null
	return Math.floor(n)
}

export async function getHitpayPaymentRequest(
	requestId: string
): Promise<HitpayPaymentRequestStatus> {
	const response = await hitpayRequest<HitpayPaymentRequestGetResponse>(
		`/payment-requests/${encodeURIComponent(requestId)}`,
		{ method: "GET" }
	)
	const ref =
		typeof response.reference_number === "string" && response.reference_number.trim().length > 0
			? response.reference_number.trim()
			: null
	const amountPhp = parseAmountPhp(response.amount)
	if (amountPhp === null) {
		throw new Error("HitPay payment request returned invalid amount")
	}
	return {
		id: response.id,
		status: response.status,
		referenceNumber: ref,
		amountPhp,
	}
}

export function isHitpayPaymentRequestCompleted(status: string): boolean {
	return status.trim().toLowerCase() === "completed"
}
