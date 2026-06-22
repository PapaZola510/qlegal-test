import { timingSafeEqual } from "node:crypto"

import { isTlpeJwtNotExpired, verifyTlpeJwt } from "./tlpe-jwt"
import { isTlpePaymentSucceeded } from "./tlpe-status"

export function readTlpeNotifyHeader(
	headers: Record<string, unknown>,
	name: string
): string | undefined {
	const lower = name.toLowerCase()
	for (const [k, v] of Object.entries(headers)) {
		if (k.toLowerCase() !== lower) continue
		if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : undefined
		return typeof v === "string" ? v : undefined
	}
	return undefined
}

/** Require integrator Authorization header per TLPE notify webhook spec. */
export function validateTlpeNotifyAuthorization(
	headers: Record<string, unknown>,
	expectedAuthorization: string
): boolean {
	const provided = readTlpeNotifyHeader(headers, "authorization")?.trim()
	const expected = expectedAuthorization.trim()
	if (!provided || !expected) return false
	const a = Buffer.from(provided, "utf8")
	const b = Buffer.from(expected, "utf8")
	return a.length === b.length && timingSafeEqual(a, b)
}

export interface TlpeNotifyPayload extends Record<string, unknown> {
	transaction_id?: string
	status_code?: string
	status_message?: string
	amount?: string | number
	reference?: string
	data?: {
		transaction_id?: string
		payment?: {
			merchant_reference_id?: string
		}
		result?: {
			statusCode?: string
			message?: string
		}
	}
}

export interface ParsedTlpeNotify {
	transactionId: string
	referenceNumber: string | null
	statusCode: string
	paid: boolean
}

function extractNotifyFields(decoded: TlpeNotifyPayload): {
	transactionId: string | null
	referenceNumber: string | null
	statusCode: string
} {
	const nested = decoded.data
	const transactionId =
		(typeof nested?.transaction_id === "string" && nested.transaction_id.trim().length > 0
			? nested.transaction_id.trim()
			: null) ??
		(typeof decoded.transaction_id === "string" && decoded.transaction_id.trim().length > 0
			? decoded.transaction_id.trim()
			: null)

	const referenceNumber =
		(typeof nested?.payment?.merchant_reference_id === "string" &&
		nested.payment.merchant_reference_id.trim().length > 0
			? nested.payment.merchant_reference_id.trim()
			: null) ??
		(typeof decoded.reference === "string" && decoded.reference.trim().length > 0
			? decoded.reference.trim()
			: null)

	const statusCode =
		(typeof nested?.result?.statusCode === "string" ? nested.result.statusCode.trim() : "") ||
		(typeof decoded.status_code === "string" ? decoded.status_code.trim() : "")

	return { transactionId, referenceNumber, statusCode }
}

/**
 * Parse TLPE notify webhook body (`application/json` with `payload` JWT, HS256 + secret).
 * ([notify docs](https://developers.tlpe.io/post-notify-payment-result/))
 */
export function parseTlpeNotifyBody(
	rawBody: string,
	secret: string,
	authorization?: string
): ParsedTlpeNotify | null {
	const trimmed = rawBody.trim()
	if (!trimmed) return null

	let jwtToken: string | null = null

	if (trimmed.startsWith("{")) {
		try {
			const outer = JSON.parse(trimmed) as Record<string, unknown>
			if (typeof outer.payload === "string" && outer.payload.includes(".")) {
				jwtToken = outer.payload
			}
		} catch {
			return null
		}
	} else if (trimmed.includes(".")) {
		// Some sandboxes POST the JWT directly; production uses `{ "payload": "<jwt>" }`.
		jwtToken = trimmed
	}

	if (!jwtToken) return null

	const decoded = verifyTlpeJwt<TlpeNotifyPayload>(jwtToken, secret, authorization)
	if (!decoded || !isTlpeJwtNotExpired(decoded)) return null

	const { transactionId, referenceNumber, statusCode } = extractNotifyFields(decoded)
	if (!transactionId && !referenceNumber) return null

	return {
		transactionId: transactionId ?? referenceNumber!,
		referenceNumber,
		statusCode,
		paid: isTlpePaymentSucceeded(statusCode),
	}
}
