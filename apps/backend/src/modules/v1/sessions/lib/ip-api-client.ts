import { Logger } from "@nestjs/common"

const log = new Logger("LocationIpApi")

interface IpApiResponse {
	status?: "success" | "fail"
	message?: string
	country?: string
	countryCode?: string
	region?: string
	city?: string
	lat?: number
	lon?: number
	timezone?: string
	proxy?: boolean
	hosting?: boolean
	isp?: string
	org?: string
	as?: string
}

export type IpApiTransportMode = "secure_https" | "insecure_http"

export interface IpApiCheckResult {
	checked: boolean
	/** True when ip-api `proxy` field is true (VPN/anonymizer). */
	isProxy: boolean
	/** True when ip-api `hosting` field is true (datacenter); not used alone to block. */
	isHosting: boolean
	countryCode: string | null
	isp: string | null
	org: string | null
	transportMode: IpApiTransportMode
	authoritative: boolean
	message?: string
}

/**
 * Best-effort proxy/hosting check via ip-api.com (free tier, HTTP only).
 *
 * The free endpoint is insecure HTTP and not contractually authoritative — we
 * surface `authoritative: false` so callers know to confirm with the paid
 * proxycheck.io lane before hard-blocking the user.
 */
export async function checkIpApi(ip: string): Promise<IpApiCheckResult> {
	const baseUrl = "http://ip-api.com/json"
	const transportMode: IpApiTransportMode = "insecure_http"
	const authoritative = false

	log.warn(
		"Using insecure HTTP transport for ip-api.com (advisory only; proxycheck confirms hard blocks)"
	)

	try {
		const response = await fetch(
			`${baseUrl}/${ip}?fields=status,message,country,countryCode,region,city,lat,lon,timezone,isp,org,as,proxy,hosting`
		)

		if (!response.ok) {
			log.error(`ip-api.com returned status ${response.status}`)
			return {
				checked: false,
				isProxy: false,
				isHosting: false,
				countryCode: null,
				isp: null,
				org: null,
				transportMode,
				authoritative,
				message: "ip-api request failed",
			}
		}

		const data = (await response.json()) as IpApiResponse
		if (data.status !== "success") {
			return {
				checked: false,
				isProxy: false,
				isHosting: false,
				countryCode: null,
				isp: null,
				org: null,
				transportMode,
				authoritative,
				message: data.message ?? "ip-api returned non-success status",
			}
		}

		const isProxy = data.proxy === true
		const isHosting = data.hosting === true

		return {
			checked: true,
			isProxy,
			isHosting,
			countryCode: data.countryCode ?? null,
			isp: data.isp ?? null,
			org: data.org ?? null,
			transportMode,
			authoritative,
		}
	} catch (error) {
		log.error("Error checking IP reputation", error)
		return {
			checked: false,
			isProxy: false,
			isHosting: false,
			countryCode: null,
			isp: null,
			org: null,
			transportMode,
			authoritative,
			message: "ip-api check error",
		}
	}
}
