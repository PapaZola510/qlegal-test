/** TLPE success status for completed payment ([sync docs](https://developers.tlpe.io/post-sync-payment-status/)). */
export const TLPE_STATUS_SUCCEEDED = "OK.00.00"

export function isTlpePaymentSucceeded(statusCode: string | undefined | null): boolean {
	if (!statusCode) return false
	return statusCode.trim() === TLPE_STATUS_SUCCEEDED
}
