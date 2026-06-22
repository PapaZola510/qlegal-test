import type { JoinTokenPayload } from "@repo/contracts"

/** Bump when LiveKit grants change so cached join tokens are refreshed. */
const JOIN_PAYLOAD_CACHE_VERSION = 2

type StoredJoinPayload = JoinTokenPayload & { _cacheVersion?: number }

function storageKey(appointmentId: string): string {
	return `qlegal:livekit-join:${appointmentId}`
}

function sessionStorageUnsafe(): Storage | null {
	if (typeof window === "undefined") return null
	try {
		return window.sessionStorage
	} catch {
		return null
	}
}

export function storeJoinPayload(appointmentId: string, payload: JoinTokenPayload): void {
	const s = sessionStorageUnsafe()
	if (!s) return
	const stored: StoredJoinPayload = { ...payload, _cacheVersion: JOIN_PAYLOAD_CACHE_VERSION }
	s.setItem(storageKey(appointmentId), JSON.stringify(stored))
}

export function readJoinPayload(appointmentId: string): JoinTokenPayload | null {
	const s = sessionStorageUnsafe()
	if (!s) return null
	const raw = s.getItem(storageKey(appointmentId))
	if (!raw) return null
	try {
		const parsed = JSON.parse(raw) as StoredJoinPayload
		if (parsed._cacheVersion !== JOIN_PAYLOAD_CACHE_VERSION) {
			s.removeItem(storageKey(appointmentId))
			return null
		}
		const { _cacheVersion: _v, ...payload } = parsed
		void _v
		return payload
	} catch {
		s.removeItem(storageKey(appointmentId))
		return null
	}
}

export function clearJoinPayload(appointmentId: string): void {
	const s = sessionStorageUnsafe()
	if (!s) return
	s.removeItem(storageKey(appointmentId))
}
