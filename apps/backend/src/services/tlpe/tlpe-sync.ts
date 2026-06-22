import { isTlpePaymentSucceeded } from "./tlpe-status"
import { tlpeRequest } from "./tlpe.client"

export interface TlpeSyncResult {
	transactionId: string
	statusCode: string
	statusMessage: string
	paid: boolean
}

interface TlpeSyncApiResponse {
	transaction_id?: string
	status_code?: string
	status_message?: string
	data?: {
		status_code?: string
		status_message?: string
		status_description?: string
	}
}

export { TLPE_STATUS_SUCCEEDED, isTlpePaymentSucceeded } from "./tlpe-status"

export async function syncTlpePayment(transactionId: string): Promise<TlpeSyncResult> {
	const data = await tlpeRequest<TlpeSyncApiResponse>("/sync", {
		method: "POST",
		body: JSON.stringify({ transaction_id: transactionId, notify_user: "false" }),
	})

	const statusCode =
		typeof data.data?.status_code === "string"
			? data.data.status_code
			: typeof data.status_code === "string"
				? data.status_code
				: ""
	const statusMessage =
		typeof data.data?.status_description === "string"
			? data.data.status_description
			: typeof data.data?.status_message === "string"
				? data.data.status_message
				: typeof data.status_message === "string"
					? data.status_message
					: ""

	return {
		transactionId: typeof data.transaction_id === "string" ? data.transaction_id : transactionId,
		statusCode,
		statusMessage,
		paid: isTlpePaymentSucceeded(statusCode),
	}
}
