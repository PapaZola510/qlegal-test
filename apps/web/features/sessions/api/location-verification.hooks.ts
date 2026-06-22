"use client"

import { useCallback, useState } from "react"
import { useMutation } from "@tanstack/react-query"

import type {
	CheckVpnInput,
	CheckVpnResult,
	VerifyLocationInput,
	VerifyLocationResult,
} from "@repo/contracts"

import { orpcClient } from "@/services/orpc/client"
import { discoverBrowserPublicIpv4 } from "@/features/sessions/lib/discover-browser-public-ipv4"

interface LocationVerificationClient {
	session: {
		locationVerification: {
			verifyLocation: (p: VerifyLocationInput) => Promise<VerifyLocationResult>
			checkVpn: (p: CheckVpnInput) => Promise<CheckVpnResult>
		}
	}
}

/**
 * Returns the mutating helpers the lobby blocker needs.
 */
export function useLocationVerification() {
	const verifyLocation = useMutation({
		mutationFn: async (input: VerifyLocationInput) =>
			(
				orpcClient as unknown as LocationVerificationClient
			).session.locationVerification.verifyLocation(input),
	})

	return {
		verifyLocation,
	}
}

/**
 * One-shot VPN check before geolocation. Discovers browser egress IP first so
 * VPN detection works even when API traffic is proxied via localhost.
 */
export function useQuickVpnCheck() {
	const [vpnCheckResult, setVpnCheckResult] = useState<CheckVpnResult | null>(null)
	const [browserPublicIp, setBrowserPublicIp] = useState<string | null>(null)
	const [isChecking, setIsChecking] = useState(false)

	const performVpnCheck = useCallback(async () => {
		setIsChecking(true)
		try {
			const discoveredIp = await discoverBrowserPublicIpv4()
			setBrowserPublicIp(discoveredIp)

			const result = await (
				orpcClient as unknown as LocationVerificationClient
			).session.locationVerification.checkVpn({
				browserPublicIp: discoveredIp ?? undefined,
			})
			setVpnCheckResult(result)
			return result
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error("[Quick VPN Check] Error:", error)
			const fallback: CheckVpnResult = {
				checked: false,
				isVpn: false,
				message:
					error instanceof Error
						? error.message
						: "VPN check failed. Proceeding with location-only verification.",
			}
			setVpnCheckResult(fallback)
			return fallback
		} finally {
			setIsChecking(false)
		}
	}, [])

	const resetVpnCheck = useCallback(() => {
		setVpnCheckResult(null)
		setBrowserPublicIp(null)
		setIsChecking(false)
	}, [])

	return {
		vpnCheckResult,
		browserPublicIp,
		isChecking,
		performVpnCheck,
		resetVpnCheck,
	}
}
