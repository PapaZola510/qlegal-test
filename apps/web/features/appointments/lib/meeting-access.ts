import type { Appointment, MeetingPaymentStatus } from "@repo/contracts"

/** `sessionStorage` key: client was redirected because the ENP ended the meeting (toast on appointments list). */
export const MEETING_ENDED_BY_NOTARY_STORAGE_KEY = "qlegal-meeting-ended-by-notary"

/**
 * True when the participant may open the lobby and join the LiveKit room.
 * Confirmed bookings always get a lobby path (ENP starts session from there); `canStart` is only a time-window hint from the API.
 */
export function canAccessMeetingLobby(apt: Appointment): boolean {
	return apt.status === "confirmed" || (apt.status === "in_session" && apt.canRejoin)
}

/** True when session fees were paid and no further meeting documents may be uploaded. */
export function isMeetingDocumentUploadLocked(
	paymentStatus?: MeetingPaymentStatus | null
): boolean {
	if (!paymentStatus?.required) return false
	return paymentStatus.paid === true && paymentStatus.status === "succeeded"
}

/**
 * True when clients/witnesses must not view or download notarized PDFs until session payment succeeds.
 * ENP is never locked.
 */
export function isMeetingNotarizedPdfLocked(
	paymentStatus: MeetingPaymentStatus | null | undefined,
	isEnp: boolean
): boolean {
	if (isEnp) return false
	if (!paymentStatus?.required) return false
	return !paymentStatus.paid
}
