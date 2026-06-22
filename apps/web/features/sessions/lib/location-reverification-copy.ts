import type { UserRole } from "@repo/contracts"

/**
 * Format a kilometre distance for display. Mirrors quanby-legal: under 1 km
 * shown as metres, otherwise as decimal kilometres.
 */
export function formatDistance(distanceKm: number): string {
	if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`
	return `${distanceKm.toFixed(1)} km`
}

/** Copy explaining that lobby location verification requires the Philippines only. */
export function getLocationRequirementMessage(role: UserRole | "guest_signer" | "none"): string {
	if (role === "enp") {
		return "As a notary (ENP), you must be physically located within the Philippines to conduct notarization sessions."
	}
	return "You must be located within the Philippines to join this meeting."
}
