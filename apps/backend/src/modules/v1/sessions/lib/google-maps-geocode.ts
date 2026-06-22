import { Logger } from "@nestjs/common"

import { env } from "@/config/env.config"

const log = new Logger("LocationGeocode")

interface GeocodingResponse {
	status: string
	results: Array<{
		address_components: Array<{
			long_name: string
			short_name: string
			types: string[]
		}>
		formatted_address: string
		geometry: { location: { lat: number; lng: number } }
	}>
	error_message?: string
}

export interface ParsedAddress {
	homeStreet: string | null
	barangay: string | null
	cityProvince: string | null
	fullAddress: string | null
}

export interface GeocodingErrorDetails {
	status: string
	statusCode?: number
	message?: string
}

export interface GeocodingLookupResult {
	countryCode: string | null
	countryName: string | null
	formattedAddress: string | null
	parsedAddress: ParsedAddress | null
	error?: GeocodingErrorDetails
}

/**
 * Parse Google Maps `address_components` into the slim shape we keep on the
 * user profile. Falls back to `neighborhood` for barangay when sublocality is
 * missing (common in rural PH addresses).
 */
function parseAddressComponents(result: GeocodingResponse["results"][0]): ParsedAddress {
	if (!result) {
		return { homeStreet: null, barangay: null, cityProvince: null, fullAddress: null }
	}

	const components = result.address_components
	let streetNumber = ""
	let route = ""
	let barangay = ""
	let city = ""
	let province = ""

	for (const component of components) {
		const types = component.types
		if (types.includes("street_number")) {
			streetNumber = component.long_name
		} else if (types.includes("route")) {
			route = component.long_name
		} else if (types.includes("sublocality") || types.includes("sublocality_level_1")) {
			barangay = component.long_name
		} else if (types.includes("locality") || types.includes("administrative_area_level_2")) {
			city = component.long_name
		} else if (types.includes("administrative_area_level_1")) {
			province = component.long_name
		} else if (types.includes("neighborhood") && !barangay) {
			barangay = component.long_name
		}
	}

	const homeStreet = [streetNumber, route].filter(Boolean).join(" ").trim() || null
	const cityProvince = [city, province].filter(Boolean).join(", ").trim() || null

	return {
		homeStreet,
		barangay: barangay || null,
		cityProvince,
		fullAddress: result.formatted_address,
	}
}

/**
 * Reverse-geocode coordinates to a country code + formatted address using the
 * Google Maps Geocoding API. Returns a discriminated error payload so callers
 * can map specific failure modes (quota, denied, zero results) to the right
 * user-visible reason.
 */
export async function getCountryFromCoordinates(
	lat: number,
	lng: number
): Promise<GeocodingLookupResult> {
	const apiKey = env.GOOGLE_MAPS_API_KEY?.trim()
	if (!apiKey) {
		log.error("GOOGLE_MAPS_API_KEY is not configured; location verification cannot proceed")
		return {
			countryCode: null,
			countryName: null,
			formattedAddress: null,
			parsedAddress: null,
			error: {
				status: "REQUEST_DENIED",
				message: "GOOGLE_MAPS_API_KEY is not configured on the server",
			},
		}
	}

	try {
		const response = await fetch(
			`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
		)

		if (!response.ok) {
			log.error(`Google Maps API returned status ${response.status}`)
			return {
				countryCode: null,
				countryName: null,
				formattedAddress: null,
				parsedAddress: null,
				error: {
					status: "HTTP_ERROR",
					statusCode: response.status,
					message: "Google Maps Geocoding HTTP request failed",
				},
			}
		}

		const data = (await response.json()) as GeocodingResponse

		if (data.status !== "OK" || !data.results || data.results.length === 0) {
			log.error(`Google Maps API error: ${data.status} - ${data.error_message ?? ""}`)
			return {
				countryCode: null,
				countryName: null,
				formattedAddress: null,
				parsedAddress: null,
				error: {
					status: data.status,
					message: data.error_message ?? "Google Maps Geocoding returned no results",
				},
			}
		}

		const result = data.results[0]
		if (!result) {
			return {
				countryCode: null,
				countryName: null,
				formattedAddress: null,
				parsedAddress: null,
				error: {
					status: "NO_PRIMARY_RESULT",
					message: "Google Maps response did not contain a primary result",
				},
			}
		}

		const formattedAddress = result.formatted_address ?? null
		const parsedAddress = parseAddressComponents(result)

		let countryComponent = result.address_components.find(c => c.types.includes("country"))
		if (!countryComponent) {
			for (const res of data.results) {
				countryComponent = res.address_components.find(c => c.types.includes("country"))
				if (countryComponent) break
			}
		}

		return {
			countryCode: countryComponent?.short_name ?? null,
			countryName: countryComponent?.long_name ?? null,
			formattedAddress,
			parsedAddress,
		}
	} catch (error) {
		log.error("Error getting country from coordinates", error)
		return {
			countryCode: null,
			countryName: null,
			formattedAddress: null,
			parsedAddress: null,
			error: {
				status: "NETWORK_ERROR",
				message: error instanceof Error ? error.message : "Unknown geocoding error",
			},
		}
	}
}
