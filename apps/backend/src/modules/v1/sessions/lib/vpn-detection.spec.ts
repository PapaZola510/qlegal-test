import type { IpApiCheckResult } from "./ip-api-client"
import type { VpnCheckResult } from "./proxycheck-client"
import { isVpnOrProxyActive, resolveIpCountryCode } from "./vpn-detection"

const ipApiBase: IpApiCheckResult = {
	checked: true,
	isProxy: false,
	isHosting: false,
	countryCode: "UA",
	isp: "Example ISP",
	org: "Example Org",
	transportMode: "insecure_http",
	authoritative: false,
}

const proxycheckUnavailable: VpnCheckResult = {
	checked: false,
	isVpn: false,
	ipData: null,
}

describe("isVpnOrProxyActive", () => {
	it("detects ip-api proxy flag", () => {
		expect(isVpnOrProxyActive({ ...ipApiBase, isProxy: true }, proxycheckUnavailable)).toBe(true)
	})

	it("detects ip-api hosting when proxycheck is unavailable", () => {
		expect(isVpnOrProxyActive({ ...ipApiBase, isHosting: true }, proxycheckUnavailable)).toBe(true)
	})

	it("does not treat hosting alone as VPN when proxycheck confirms clean", () => {
		expect(
			isVpnOrProxyActive(
				{ ...ipApiBase, isHosting: true },
				{ checked: true, isVpn: false, ipData: null }
			)
		).toBe(false)
	})
})

describe("resolveIpCountryCode", () => {
	it("uses ip-api country when proxycheck has no country", () => {
		expect(resolveIpCountryCode(ipApiBase, null)).toBe("UA")
	})

	it("prefers proxycheck country over ip-api", () => {
		expect(
			resolveIpCountryCode(ipApiBase, {
				country: "PH",
			})
		).toBe("PH")
	})
})
