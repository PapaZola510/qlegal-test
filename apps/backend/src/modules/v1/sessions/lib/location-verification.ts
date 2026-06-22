import { PHILIPPINE_EMBASSIES, type EmbassyLocation } from "./philippine-embassies"

/**
 * Philippine geographical boundaries (approximate bounding box) covering the
 * entire archipelago. Used as a coarse pre-check before relying on Google's
 * authoritative country lookup.
 */
export const PHILIPPINES_BOUNDS = {
	north: 21.5,
	south: 4.5,
	east: 127.0,
	west: 116.0,
}

/** Legacy embassy radius (km); unused while lobby verification is PH-only. */
export const DEFAULT_EMBASSY_RADIUS_KM = 1

function toRadians(degrees: number): number {
	return degrees * (Math.PI / 180)
}

/** Haversine distance between two coordinates in kilometres. */
export function calculateDistanceKm(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number
): number {
	const R = 6371

	const dLat = toRadians(lat2 - lat1)
	const dLng = toRadians(lng2 - lng1)

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

	return R * c
}

export function isWithinPhilippinesBounds(lat: number, lng: number): boolean {
	return (
		lat >= PHILIPPINES_BOUNDS.south &&
		lat <= PHILIPPINES_BOUNDS.north &&
		lng >= PHILIPPINES_BOUNDS.west &&
		lng <= PHILIPPINES_BOUNDS.east
	)
}

export function findNearestEmbassy(
	lat: number,
	lng: number
): { embassy: EmbassyLocation; distanceKm: number } | null {
	if (PHILIPPINE_EMBASSIES.length === 0) return null

	let nearest: EmbassyLocation | null = null
	let minDistance = Infinity

	for (const embassy of PHILIPPINE_EMBASSIES) {
		const distance = calculateDistanceKm(lat, lng, embassy.coordinates.lat, embassy.coordinates.lng)
		if (distance < minDistance) {
			minDistance = distance
			nearest = embassy
		}
	}

	if (!nearest) return null
	return { embassy: nearest, distanceKm: minDistance }
}

export function findEmbassiesWithinRadius(
	lat: number,
	lng: number,
	radiusKm: number = DEFAULT_EMBASSY_RADIUS_KM
): Array<{ embassy: EmbassyLocation; distanceKm: number }> {
	const results: Array<{ embassy: EmbassyLocation; distanceKm: number }> = []
	for (const embassy of PHILIPPINE_EMBASSIES) {
		const distance = calculateDistanceKm(lat, lng, embassy.coordinates.lat, embassy.coordinates.lng)
		if (distance <= radiusKm) results.push({ embassy, distanceKm: distance })
	}
	return results.sort((a, b) => a.distanceKm - b.distanceKm)
}

export function isNearPhilippineEmbassy(
	lat: number,
	lng: number,
	radiusKm: number = DEFAULT_EMBASSY_RADIUS_KM
): boolean {
	return findEmbassiesWithinRadius(lat, lng, radiusKm).length > 0
}

/**
 * Reasons returned by the server-side verifier. Client-only reasons
 * (`permission_denied`, `unavailable`, `timeout`, `geolocation_error`) are
 * declared in the contract enum but never produced here.
 */
export type LocationReason =
	| "in_philippines"
	| "near_embassy"
	| "outside_philippines"
	| "enp_at_embassy_abroad"
	| "location_unknown"
	| "vpn_detected"
	| "vpn_check_unavailable"
	| "geolocation_error"
	| "permission_denied"
	| "unavailable"
	| "timeout"
	| "gps_accuracy_low"
	| "google_maps_api_error"
	| "server_error"

export interface LocationVerificationResult {
	allowed: boolean
	reason: LocationReason
	details?: {
		isInPhilippines?: boolean
		nearbyEmbassy?: EmbassyLocation
		distanceToEmbassyKm?: number
		countryCode?: string
		formattedAddress?: string
	}
	debugInfo?: {
		errorCode?: string
		errorMessage?: string
		userMessage?: string
		suggestedAction?: string
		timestamp?: string
		accuracyMeters?: number
		apiStatusCode?: string
		requestId?: string
	}
}

/**
 * q-legal-new role union from `QlegalSessionContext` (note: `none` and
 * `guest_signer` go through different lobby paths and are not expected here).
 */
export type QlegalRoleForLocation = "enp" | "client" | "admin" | "sub_org_admin" | "guest_signer"

/**
 * Verify a coordinate for the given q-legal role.
 *
 * PH-only: all roles must be inside the Philippines per reverse-geocoded country.
 * Embassy proximity is not considered (see `philippine-embassies.ts` for legacy data).
 */
export function verifyLocationForRole(
	_role: QlegalRoleForLocation,
	_lat: number,
	_lng: number,
	isInPhilippines: boolean
): LocationVerificationResult {
	if (isInPhilippines) {
		return {
			allowed: true,
			reason: "in_philippines",
			details: { isInPhilippines: true },
		}
	}

	return {
		allowed: false,
		reason: "outside_philippines",
		details: { isInPhilippines: false },
	}
}
