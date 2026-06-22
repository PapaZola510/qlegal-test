import type { IpApiCheckResult } from "./ip-api-client"
import type { ProxyCheckIpData, VpnCheckResult } from "./proxycheck-client"

/** VPN/proxy must be off before PH-only location verification runs. */
export function isVpnOrProxyActive(ipApi: IpApiCheckResult, proxycheck: VpnCheckResult): boolean {
	if (proxycheck.isVpn) return true
	if (ipApi.isProxy && ipApi.checked) return true
	// Without proxycheck.io, ip-api `hosting` flags datacenter/VPN egress addresses.
	if (!proxycheck.checked && ipApi.isHosting && ipApi.checked) return true
	return false
}

/** Country associated with the HTTP client IP (proxycheck preferred, then ip-api). */
export function resolveIpCountryCode(
	ipApi: IpApiCheckResult | null,
	proxycheckIpData: ProxyCheckIpData | null
): string | null {
	const fromProxy = proxycheckIpData?.country?.trim()
	if (fromProxy) return fromProxy.toUpperCase()

	if (ipApi?.checked && ipApi.countryCode?.trim()) {
		return ipApi.countryCode.trim().toUpperCase()
	}

	return null
}

export function vpnDetectionIpInfo(
	ipApi: IpApiCheckResult,
	proxycheck: VpnCheckResult
): { isp?: string; org?: string; country?: string } {
	return {
		isp: proxycheck.ipData?.provider ?? ipApi.isp ?? undefined,
		org: proxycheck.ipData?.organisation ?? ipApi.org ?? undefined,
		country: proxycheck.ipData?.country ?? ipApi.countryCode ?? undefined,
	}
}
