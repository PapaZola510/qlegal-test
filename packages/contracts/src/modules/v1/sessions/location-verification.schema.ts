import { z } from "zod"

/**
 * Embassy/consulate metadata on verification details. New verifications are PH-only;
 * `near_embassy` / `enp_at_embassy_abroad` remain on the reason enum for legacy audit replay.
 */
export const EmbassyLocationSchema = z.object({
	name: z.string(),
	type: z.enum(["embassy", "consulate", "honorary_consul"]),
	country: z.string(),
	city: z.string(),
	coordinates: z.object({
		lat: z.number(),
		lng: z.number(),
	}),
	address: z.string().optional(),
})

/**
 * Mirrors quanby-legal's union (`features/sessions/lib/location-verification.ts`).
 * Includes both server-side outcomes and client-side-only reasons (`permission_denied`,
 * `unavailable`, `timeout`, `geolocation_error`) so the same dialog can render any state.
 */
export const LocationReasonEnum = z.enum([
	"in_philippines",
	"near_embassy",
	"outside_philippines",
	"enp_at_embassy_abroad",
	"location_unknown",
	"vpn_detected",
	"vpn_check_unavailable",
	"geolocation_error",
	"permission_denied",
	"unavailable",
	"timeout",
	"gps_accuracy_low",
	"google_maps_api_error",
	"server_error",
])

export const LocationVerificationDetailsSchema = z.object({
	isInPhilippines: z.boolean().optional(),
	nearbyEmbassy: EmbassyLocationSchema.optional(),
	distanceToEmbassyKm: z.number().optional(),
	countryCode: z.string().optional(),
	formattedAddress: z.string().optional(),
})

export const LocationDebugInfoSchema = z.object({
	errorCode: z.string().optional(),
	errorMessage: z.string().optional(),
	userMessage: z.string().optional(),
	suggestedAction: z.string().optional(),
	timestamp: z.string().optional(),
	accuracyMeters: z.number().optional(),
	apiStatusCode: z.string().optional(),
	requestId: z.string().optional(),
})

const ProxyCheckIpDataSchema = z
	.object({
		status: z.enum(["ok", "error"]).optional(),
		proxy: z.enum(["yes", "no"]).optional(),
		type: z.string().optional(),
		country: z.string().optional(),
		asn: z.string().optional(),
		provider: z.string().optional(),
		organisation: z.string().optional(),
	})
	.passthrough()

const IpApiDetailsSchema = z.object({
	checked: z.boolean(),
	isProxy: z.boolean(),
	countryCode: z.string().nullable(),
	isp: z.string().nullable(),
	org: z.string().nullable(),
	transportMode: z.enum(["secure_https", "insecure_http"]).optional(),
	authoritative: z.boolean().optional(),
	message: z.string().optional(),
})

const ParsedAddressSchema = z.object({
	homeStreet: z.string().nullable(),
	barangay: z.string().nullable(),
	cityProvince: z.string().nullable(),
	fullAddress: z.string().nullable(),
})

export const VerifyLocationInputSchema = z.object({
	latitude: z.number().min(-90).max(90),
	longitude: z.number().min(-180).max(180),
	accuracyMeters: z.number().min(0).optional(),
	appointmentId: z.string().uuid(),
	/** Browser egress IPv4 from ipify/WebRTC — required when API is proxied via localhost. */
	browserPublicIp: z.string().optional(),
})

export const CheckVpnInputSchema = z.object({
	browserPublicIp: z.string().optional(),
})

export const VerifyLocationResultSchema = z.object({
	allowed: z.boolean(),
	reason: LocationReasonEnum,
	details: LocationVerificationDetailsSchema.optional(),
	debugInfo: LocationDebugInfoSchema.optional(),
	vpnDetails: ProxyCheckIpDataSchema.nullable().optional(),
	ipApiDetails: IpApiDetailsSchema.nullable().optional(),
	parsedAddress: ParsedAddressSchema.nullable().optional(),
	clientIp: z.string().optional(),
})

export const CheckVpnResultSchema = z.object({
	checked: z.boolean(),
	isVpn: z.boolean(),
	message: z.string().optional(),
	ipInfo: z
		.object({
			isp: z.string().optional(),
			org: z.string().optional(),
			country: z.string().optional(),
		})
		.nullable()
		.optional(),
})

/** Restore lobby UI after HyperVerge redirect without re-prompting GPS. */
export const LobbyLocationStatusInputSchema = z.object({
	appointmentId: z.string().uuid(),
})

export const LobbyLocationStatusResultSchema = z.object({
	verified: z.boolean(),
	verifiedAt: z.string().datetime().optional(),
	result: VerifyLocationResultSchema.optional(),
})

export type EmbassyLocation = z.infer<typeof EmbassyLocationSchema>
export type LocationReason = z.infer<typeof LocationReasonEnum>
export type LocationVerificationDetails = z.infer<typeof LocationVerificationDetailsSchema>
export type LocationDebugInfo = z.infer<typeof LocationDebugInfoSchema>
export type VerifyLocationInput = z.infer<typeof VerifyLocationInputSchema>
export type CheckVpnInput = z.infer<typeof CheckVpnInputSchema>
export type VerifyLocationResult = z.infer<typeof VerifyLocationResultSchema>
export type CheckVpnResult = z.infer<typeof CheckVpnResultSchema>
export type LobbyLocationStatusInput = z.infer<typeof LobbyLocationStatusInputSchema>
export type LobbyLocationStatusResult = z.infer<typeof LobbyLocationStatusResultSchema>
