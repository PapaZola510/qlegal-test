/** Query param for in-session guest invite tokens (`?guest=…`). */
export const GUEST_SESSION_QUERY_PARAM = "guest"

/** @deprecated Use {@link GUEST_SESSION_QUERY_PARAM} */
export const GUEST_LOBBY_QUERY_PARAM = GUEST_SESSION_QUERY_PARAM

export function buildGuestMeetingPath(appointmentId: string, guestInviteToken: string): string {
	const q = new URLSearchParams({ [GUEST_SESSION_QUERY_PARAM]: guestInviteToken })
	return `/appointments/${appointmentId}/meeting?${q.toString()}`
}

/** Legacy lobby URLs redirect to the meeting; kept for callers that still use the name. */
export function buildGuestLobbyPath(appointmentId: string, guestInviteToken: string): string {
	return buildGuestMeetingPath(appointmentId, guestInviteToken)
}

export function readGuestInviteTokenFromSearchParams(
	searchParams: URLSearchParams | null | undefined
): string | null {
	const raw = searchParams?.get(GUEST_SESSION_QUERY_PARAM)?.trim()
	return raw && raw.length >= 8 ? raw : null
}

/** Read guest token from a full URL (e.g. HyperVerge liveness `redirect` query param). */
export function readGuestInviteTokenFromUrl(url: string | null | undefined): string | null {
	if (!url?.trim()) return null
	try {
		return readGuestInviteTokenFromSearchParams(new URL(url).searchParams)
	} catch {
		return null
	}
}
