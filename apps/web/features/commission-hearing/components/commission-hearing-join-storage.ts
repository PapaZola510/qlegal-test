"use client"

import type { CommissionHearingJoinToken } from "@repo/contracts"

const CACHE_VERSION = 1

type StoredCommissionHearingJoinToken = CommissionHearingJoinToken & { _cacheVersion?: number }

function storageKey(hearingRoomId: string) {
	return `qlegal:commission-hearing:${hearingRoomId}:join`
}

export function storeCommissionHearingJoinPayload(
	hearingRoomId: string,
	payload: CommissionHearingJoinToken
): void {
	try {
		sessionStorage.setItem(
			storageKey(hearingRoomId),
			JSON.stringify({ ...payload, _cacheVersion: CACHE_VERSION })
		)
	} catch {
		/* Ignore private-mode/quota storage failures. */
	}
}

export function readCommissionHearingJoinPayload(
	hearingRoomId: string
): CommissionHearingJoinToken | null {
	try {
		const raw = sessionStorage.getItem(storageKey(hearingRoomId))
		if (!raw) return null
		const parsed = JSON.parse(raw) as StoredCommissionHearingJoinToken
		if (parsed._cacheVersion !== CACHE_VERSION) {
			sessionStorage.removeItem(storageKey(hearingRoomId))
			return null
		}
		return parsed
	} catch {
		return null
	}
}

export function clearCommissionHearingJoinPayload(hearingRoomId: string): void {
	try {
		sessionStorage.removeItem(storageKey(hearingRoomId))
	} catch {
		/* Ignore private-mode/quota storage failures. */
	}
}
