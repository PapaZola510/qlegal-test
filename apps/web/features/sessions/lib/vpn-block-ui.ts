import type { CheckVpnResult, VerifyLocationResult } from "@repo/contracts"

/**
 * Geolocation may start when VPN is not positively detected.
 * Inconclusive checks (checked: false) proceed — blocking only on confirmed VPN.
 */
export function isQuickVpnCheckPassed(result: CheckVpnResult | null): boolean {
	if (result === null) return false
	if (result.checked && result.isVpn) return false
	return true
}

/** Show the turn-off-VPN dialog only on confirmed detection. */
export function shouldTreatAsVpnBlock(result: VerifyLocationResult): boolean {
	if (result.reason === "vpn_detected") return true
	if (result.vpnDetails) return true
	if (result.ipApiDetails?.isProxy === true) return true
	return false
}

export function vpnInfoFromCheckResult(
	result: CheckVpnResult | VerifyLocationResult
): { isp?: string; org?: string; country?: string } | null {
	if ("ipInfo" in result && result.ipInfo) {
		return {
			isp: result.ipInfo.isp,
			org: result.ipInfo.org,
			country: result.ipInfo.country,
		}
	}
	if ("vpnDetails" in result && result.vpnDetails) {
		return {
			isp: result.vpnDetails.provider,
			org: result.vpnDetails.organisation,
			country: result.vpnDetails.country,
		}
	}
	if ("ipApiDetails" in result && result.ipApiDetails) {
		return {
			isp: result.ipApiDetails.isp ?? undefined,
			org: result.ipApiDetails.org ?? undefined,
			country: result.ipApiDetails.countryCode ?? undefined,
		}
	}
	return null
}
