import { oc } from "@orpc/contract"

import {
	CheckVpnInputSchema,
	CheckVpnResultSchema,
	LobbyLocationStatusInputSchema,
	LobbyLocationStatusResultSchema,
	VerifyLocationInputSchema,
	VerifyLocationResultSchema,
} from "./location-verification.schema.js"

/**
 * Location verification routes — gates lobby entry by reverse-geocoding the
 * caller's coordinates, cross-checking with their IP, and (for ENP) requiring
 * physical presence in the Philippines.
 *
 * Nested under `session.locationVerification.*` to keep the routes co-located
 * with the existing session lobby flow.
 */
export const locationVerificationContract = {
	verifyLocation: oc
		.route({
			method: "POST",
			path: "/sessions/location/verify",
			summary: "Verify caller's coordinates + IP for lobby entry",
			tags: ["Sessions"],
		})
		.input(VerifyLocationInputSchema)
		.output(VerifyLocationResultSchema),

	checkVpn: oc
		.route({
			method: "POST",
			path: "/sessions/location/vpn-check",
			summary: "Quick VPN/proxy pre-check (no geolocation required)",
			tags: ["Sessions"],
		})
		.input(CheckVpnInputSchema)
		.output(CheckVpnResultSchema),

	getLobbyStatus: oc
		.route({
			method: "GET",
			path: "/sessions/location/lobby-status",
			summary: "Whether lobby location was verified recently for this appointment",
			tags: ["Sessions"],
		})
		.input(LobbyLocationStatusInputSchema)
		.output(LobbyLocationStatusResultSchema),
}
