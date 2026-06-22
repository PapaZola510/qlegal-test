import { Injectable, Logger } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { ORPCError } from "@orpc/server"
import { and, desc, eq, gte } from "drizzle-orm"
import type { Request } from "express"

import type {
	CheckVpnResult,
	LobbyLocationStatusResult,
	LocationReason,
	VerifyLocationInput,
	VerifyLocationResult,
} from "@repo/contracts"
import { appointments, auditEvents } from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { env } from "@/config/env.config"

import { resolveEffectiveClientIp } from "./lib/get-client-ip"
import { getCountryFromCoordinates } from "./lib/google-maps-geocode"
import { checkIpApi, type IpApiCheckResult } from "./lib/ip-api-client"
import {
	verifyLocationForRole,
	type LocationVerificationResult,
	type QlegalRoleForLocation,
} from "./lib/location-verification"
import { checkVpnStatus, type ProxyCheckIpData } from "./lib/proxycheck-client"
import { isVpnOrProxyActive, resolveIpCountryCode, vpnDetectionIpInfo } from "./lib/vpn-detection"

const SESSION_LOCATION_AUDIT_EVENT = "session_location_verify"

interface SessionLocationAuditPayload {
	appointmentId?: string
	allowed?: boolean
	reason?: string
	countryCode?: string | null
	accuracyMeters?: number | null
	clientIp?: string | null
	requestId?: string
	details?: VerifyLocationResult["details"]
}

/**
 * Map the q-legal session context role to the role union used by the location
 * rules. `none` and unknown roles fall through to PRINCIPAL semantics so we
 * never accidentally lock anyone out who has somehow made it into the lobby.
 */
function mapRoleForLocation(role: QlegalSessionContext["role"]): QlegalRoleForLocation {
	if (role === "enp") return "enp"
	if (role === "client") return "client"
	if (role === "admin" || role === "super_admin") return "admin"
	if (role === "sub_org_admin") return "sub_org_admin"
	return "client"
}

@Injectable()
export class LocationVerificationService {
	private readonly log = new Logger(LocationVerificationService.name)

	async verifyLocation(
		ctx: QlegalSessionContext | null,
		req: Request,
		input: VerifyLocationInput
	): Promise<VerifyLocationResult> {
		if (!ctx?.userId) {
			throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		}

		await this.assertAppointmentAccess(ctx.userId, input.appointmentId)

		const { latitude, longitude, accuracyMeters, appointmentId } = input
		const userId = ctx.userId
		const role = mapRoleForLocation(ctx.role)
		const timestamp = new Date().toISOString()
		const requestId = randomUUID()
		const maxAccuracy = env.SESSION_GPS_MAX_ACCURACY_M
		const requireCountry = env.SESSION_REQUIRE_COUNTRY.toUpperCase()

		let ipData: ProxyCheckIpData | null = null
		let ipApiData: IpApiCheckResult | null = null
		let clientIp: string | null = null

		try {
			if (accuracyMeters !== undefined && accuracyMeters > maxAccuracy) {
				this.log.warn(
					`GPS_ACCURACY_LOW userId=${userId} appointmentId=${appointmentId} accuracy=${accuracyMeters}m`
				)
				const result: VerifyLocationResult = {
					allowed: false,
					reason: "gps_accuracy_low",
					debugInfo: {
						errorCode: "GPS_ACCURACY_LOW",
						errorMessage: `GPS accuracy is ${accuracyMeters.toFixed(1)}m, above the ${maxAccuracy}m threshold`,
						userMessage: "Your GPS signal is currently too weak to verify location precisely.",
						suggestedAction:
							"Move outdoors, wait for a stronger signal, and retry location verification.",
						timestamp,
						accuracyMeters,
						requestId,
					},
				}
				await this.emitAudit(ctx, result, {
					appointmentId,
					clientIp: null,
					ipApiData: null,
					ipData: null,
					requestId,
					accuracyMeters,
				})
				return result
			}

			const effective = resolveEffectiveClientIp(req, input.browserPublicIp)
			clientIp = effective.ip

			if (effective.ipPathMismatch) {
				this.log.warn(
					`VPN_IP_PATH_MISMATCH userId=${userId} appointmentId=${appointmentId} headerIp=${effective.headerIp} browserIp=${effective.browserIp}`
				)
				const result: VerifyLocationResult = {
					allowed: false,
					reason: "vpn_detected",
					clientIp: effective.browserIp ?? undefined,
					debugInfo: {
						errorCode: "VPN_IP_PATH_MISMATCH",
						errorMessage: `Server saw ${effective.headerIp} but browser egress is ${effective.browserIp}`,
						userMessage: "Turn off your VPN or proxy before verifying location.",
						suggestedAction:
							"Disconnect VPN or proxy services and browser proxy extensions, then tap Try again.",
						timestamp,
						requestId,
					},
				}
				await this.emitAudit(ctx, result, {
					appointmentId,
					clientIp,
					ipApiData: null,
					ipData: null,
					requestId,
					accuracyMeters,
				})
				return result
			}

			if (!clientIp) {
				this.log.warn(
					`CLIENT_IP_UNKNOWN userId=${userId} appointmentId=${appointmentId} timestamp=${timestamp}`
				)
			}

			if (clientIp) {
				ipApiData = await checkIpApi(clientIp)
				const vpnCheck = await checkVpnStatus(clientIp)
				ipData = vpnCheck.ipData

				if (isVpnOrProxyActive(ipApiData, vpnCheck)) {
					this.log.log(
						`VPN_DETECTED userId=${userId} appointmentId=${appointmentId} clientIp=${clientIp} proxycheck=${vpnCheck.isVpn} ipApiProxy=${ipApiData.isProxy}`
					)
					const result: VerifyLocationResult = {
						allowed: false,
						reason: "vpn_detected",
						vpnDetails: ipData,
						ipApiDetails: ipApiData,
						clientIp: clientIp ?? undefined,
					}
					await this.emitAudit(ctx, result, {
						appointmentId,
						clientIp,
						ipApiData,
						ipData,
						requestId,
						accuracyMeters,
					})
					return result
				}

				if (!ipApiData.checked && !vpnCheck.checked) {
					this.log.warn(`VPN_CHECK_UNAVAILABLE userId=${userId} appointmentId=${appointmentId}`)
				}
			}

			const { countryCode, formattedAddress, parsedAddress, error } =
				await getCountryFromCoordinates(latitude, longitude)

			if (!countryCode) {
				const status = error?.status ?? "UNKNOWN"
				const message = error?.message ?? "Unable to determine country from coordinates"
				this.log.error(
					`GOOGLE_MAPS_LOOKUP_FAILED status=${status} statusCode=${error?.statusCode ?? "n/a"} userId=${userId} appointmentId=${appointmentId}`
				)

				const result = this.buildGeocodingErrorResult({
					status,
					message,
					formattedAddress,
					timestamp,
					requestId,
					clientIp,
				})
				await this.emitAudit(ctx, result, {
					appointmentId,
					clientIp,
					ipApiData,
					ipData,
					requestId,
					accuracyMeters,
				})
				return result
			}

			const ipCountryCode = resolveIpCountryCode(ipApiData, ipData)

			if (ipCountryCode && ipCountryCode !== countryCode.toUpperCase()) {
				this.log.warn(
					`VPN_COUNTRY_MISMATCH userId=${userId} appointmentId=${appointmentId} ipCountry=${ipCountryCode} geoCountry=${countryCode} clientIp=${clientIp ?? "unknown"}`
				)
				const result: VerifyLocationResult = {
					allowed: false,
					reason: "vpn_detected",
					vpnDetails: ipData,
					ipApiDetails: ipApiData,
					clientIp: clientIp ?? undefined,
					debugInfo: {
						errorCode: "VPN_COUNTRY_MISMATCH",
						errorMessage: `Network country (${ipCountryCode}) does not match GPS country (${countryCode.toUpperCase()})`,
						userMessage:
							"Turn off your VPN or proxy. Your network location and GPS location must match.",
						suggestedAction:
							"Disconnect VPN or proxy services and browser proxy extensions, then tap Try again.",
						timestamp,
						requestId,
					},
				}
				await this.emitAudit(ctx, result, {
					appointmentId,
					clientIp,
					ipApiData,
					ipData,
					requestId,
					accuracyMeters,
				})
				return result
			}

			const isInRequiredCountry = countryCode.toUpperCase() === requireCountry
			const verification: LocationVerificationResult = verifyLocationForRole(
				role,
				latitude,
				longitude,
				isInRequiredCountry
			)

			if (verification.details) {
				verification.details.countryCode = countryCode
				verification.details.formattedAddress = formattedAddress ?? undefined
			} else {
				verification.details = {
					countryCode,
					formattedAddress: formattedAddress ?? undefined,
				}
			}

			const result: VerifyLocationResult = {
				...verification,
				ipApiDetails: ipApiData,
				parsedAddress: parsedAddress ?? null,
				clientIp: clientIp ?? undefined,
			}
			await this.emitAudit(ctx, result, {
				appointmentId,
				clientIp,
				ipApiData,
				ipData,
				requestId,
				accuracyMeters,
				countryCode,
			})
			return result
		} catch (error) {
			this.log.error(
				`SERVER_ERROR userId=${userId} appointmentId=${appointmentId} requestId=${requestId}`,
				error
			)
			const result: VerifyLocationResult = {
				allowed: false,
				reason: "server_error",
				debugInfo: {
					errorCode: "SERVER_ERROR",
					errorMessage: error instanceof Error ? error.message : "Unknown server error",
					userMessage: "An unexpected server error occurred during location verification.",
					suggestedAction: "Please retry. If the issue persists, contact support.",
					timestamp,
					requestId,
				},
			}
			await this.emitAudit(ctx, result, {
				appointmentId,
				clientIp,
				ipApiData,
				ipData,
				requestId,
				accuracyMeters,
			})
			return result
		}
	}

	/**
	 * Returns whether this user already passed lobby location verification for the
	 * appointment within the configured TTL (survives HyperVerge full-page redirect).
	 */
	async getLobbyStatus(
		ctx: QlegalSessionContext | null,
		appointmentId: string
	): Promise<LobbyLocationStatusResult> {
		if (!ctx?.userId) {
			throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		}

		await this.assertAppointmentAccess(ctx.userId, appointmentId)

		const recent = await getRecentAllowedLocationAudit(ctx.userId, appointmentId)
		if (!recent) {
			return { verified: false }
		}

		const payload = recent.payload
		const reason = (payload.reason as LocationReason | undefined) ?? "in_philippines"

		return {
			verified: true,
			verifiedAt: recent.occurredAt.toISOString(),
			result: {
				allowed: true,
				reason,
				details: payload.details ?? {
					countryCode: payload.countryCode ?? undefined,
					isInPhilippines: payload.countryCode?.toUpperCase() === "PH",
				},
				clientIp: payload.clientIp ?? undefined,
			},
		}
	}

	async checkVpn(req: Request, browserPublicIp?: string): Promise<CheckVpnResult> {
		const effective = resolveEffectiveClientIp(req, browserPublicIp)
		const clientIp = effective.ip

		if (effective.ipPathMismatch) {
			this.log.warn(
				`VPN_IP_PATH_MISMATCH checkVpn headerIp=${effective.headerIp} browserIp=${effective.browserIp}`
			)
			return {
				checked: true,
				isVpn: true,
				ipInfo: {
					org: "Network path mismatch",
					country: effective.browserIp ?? undefined,
				},
			}
		}

		if (!clientIp) {
			return { checked: false, isVpn: false, message: "Could not determine client IP" }
		}

		const ipApiCheckResult = await checkIpApi(clientIp)
		const vpnCheckResult = await checkVpnStatus(clientIp)

		if (isVpnOrProxyActive(ipApiCheckResult, vpnCheckResult)) {
			return {
				checked: true,
				isVpn: true,
				ipInfo: vpnDetectionIpInfo(ipApiCheckResult, vpnCheckResult),
			}
		}

		if (!vpnCheckResult.checked && !ipApiCheckResult.checked) {
			this.log.warn(
				`VPN check inconclusive for ${clientIp}: ip-api=${ipApiCheckResult.message ?? "unknown"}, proxycheck=${vpnCheckResult.message ?? "unknown"}`
			)
			return {
				checked: true,
				isVpn: false,
				ipInfo: vpnDetectionIpInfo(ipApiCheckResult, vpnCheckResult),
			}
		}

		return {
			checked: true,
			isVpn: false,
			ipInfo: null,
		}
	}

	/** Caller must be a party (or guest signer) for the appointment they claim to be verifying. */
	private async assertAppointmentAccess(userId: string, appointmentId: string): Promise<void> {
		const [apt] = await db
			.select({ enpUserId: appointments.enpUserId, clientUserId: appointments.clientUserId })
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)

		if (!apt) {
			throw new ORPCError("NOT_FOUND", { message: "Appointment not found" })
		}

		const isParty = userId === apt.enpUserId || userId === apt.clientUserId
		if (isParty) return

		// Guests still need a recent location audit row; we permit verification without
		// matching them to the appointment row directly (the lobby gate already
		// validates their guest invite token).
	}

	private buildGeocodingErrorResult(args: {
		status: string
		message: string
		formattedAddress: string | null
		timestamp: string
		requestId: string
		clientIp: string | null
	}): VerifyLocationResult {
		const { status, message, formattedAddress, timestamp, requestId, clientIp } = args
		const baseDetails = {
			isInPhilippines: false,
			formattedAddress: formattedAddress ?? undefined,
		}
		const baseClientIp = clientIp ?? undefined

		if (status === "OVER_DAILY_LIMIT" || status === "OVER_QUERY_LIMIT") {
			return {
				allowed: false,
				reason: "google_maps_api_error",
				details: baseDetails,
				debugInfo: {
					errorCode: "GOOGLE_MAPS_QUOTA_EXCEEDED",
					errorMessage: message,
					userMessage: "Location verification service is temporarily at capacity.",
					suggestedAction: "Please retry in a few minutes or contact support if this persists.",
					timestamp,
					apiStatusCode: status,
					requestId,
				},
				clientIp: baseClientIp,
			}
		}

		if (status === "REQUEST_DENIED") {
			return {
				allowed: false,
				reason: "google_maps_api_error",
				details: baseDetails,
				debugInfo: {
					errorCode: "GOOGLE_MAPS_REQUEST_DENIED",
					errorMessage: message,
					userMessage: "Location service configuration is currently unavailable.",
					suggestedAction:
						"Please contact support and share the request ID shown in technical details.",
					timestamp,
					apiStatusCode: status,
					requestId,
				},
				clientIp: baseClientIp,
			}
		}

		if (status === "ZERO_RESULTS") {
			return {
				allowed: false,
				reason: "location_unknown",
				details: baseDetails,
				debugInfo: {
					errorCode: "GOOGLE_MAPS_ZERO_RESULTS",
					errorMessage: "Coordinates appear to be in an unmapped area",
					userMessage: "We could not match your coordinates to a known address.",
					suggestedAction: "Move to an open area with stronger GPS signal and try again.",
					timestamp,
					apiStatusCode: status,
					requestId,
				},
				clientIp: baseClientIp,
			}
		}

		if (status === "NETWORK_ERROR" || status === "HTTP_ERROR") {
			return {
				allowed: false,
				reason: "server_error",
				details: baseDetails,
				debugInfo: {
					errorCode: "LOCATION_SERVICE_NETWORK_ERROR",
					errorMessage: message,
					userMessage: "We could not reach the location verification service.",
					suggestedAction: "Please check your connection and retry.",
					timestamp,
					apiStatusCode: status,
					requestId,
				},
				clientIp: baseClientIp,
			}
		}

		return {
			allowed: false,
			reason: "google_maps_api_error",
			details: baseDetails,
			debugInfo: {
				errorCode: "GOOGLE_MAPS_API_ERROR",
				errorMessage: message,
				userMessage: "Location verification is temporarily unavailable.",
				suggestedAction: "Please retry shortly.",
				timestamp,
				apiStatusCode: status,
				requestId,
			},
			clientIp: baseClientIp,
		}
	}

	private async emitAudit(
		ctx: QlegalSessionContext,
		result: VerifyLocationResult,
		extras: {
			appointmentId: string
			clientIp: string | null
			ipApiData: IpApiCheckResult | null
			ipData: ProxyCheckIpData | null
			requestId: string
			accuracyMeters: number | undefined
			countryCode?: string
		}
	): Promise<void> {
		try {
			const subOrgId = ctx.subOrgIds[0] ?? null
			await db.insert(auditEvents).values({
				id: randomUUID(),
				actorUserId: ctx.userId,
				subOrgId,
				eventType: SESSION_LOCATION_AUDIT_EVENT,
				targetTable: "appointments",
				targetId: extras.appointmentId,
				payload: {
					appointmentId: extras.appointmentId,
					allowed: result.allowed,
					reason: result.reason,
					countryCode: extras.countryCode ?? result.details?.countryCode ?? null,
					accuracyMeters: extras.accuracyMeters ?? null,
					clientIp: extras.clientIp,
					requestId: extras.requestId,
					details: result.details ?? null,
					vpnDetails: extras.ipData,
					ipApiDetails: extras.ipApiData,
				},
				occurredAt: new Date(),
			})
		} catch (error) {
			this.log.error("Failed to emit session_location_verify audit event", error)
		}
	}
}

/**
 * Most recent allowed `session_location_verify` audit row for this user +
 * appointment within the configured TTL, if any.
 */
export async function getRecentAllowedLocationAudit(
	userId: string,
	appointmentId: string
): Promise<{ payload: SessionLocationAuditPayload; occurredAt: Date } | null> {
	if (env.NODE_ENV === "development" && env.SESSION_DEV_RELAX_LOCATION === "true") {
		return {
			occurredAt: new Date(),
			payload: {
				appointmentId,
				allowed: true,
				reason: "in_philippines",
				details: { isInPhilippines: true, countryCode: "PH" },
			},
		}
	}

	const ttlMinutes = env.SESSION_LOCATION_TOKEN_TTL_MIN
	const cutoff = new Date(Date.now() - ttlMinutes * 60_000)

	const rows = await db
		.select({
			payload: auditEvents.payload,
			targetId: auditEvents.targetId,
			occurredAt: auditEvents.occurredAt,
		})
		.from(auditEvents)
		.where(
			and(
				eq(auditEvents.actorUserId, userId),
				eq(auditEvents.eventType, SESSION_LOCATION_AUDIT_EVENT),
				gte(auditEvents.occurredAt, cutoff)
			)
		)
		.orderBy(desc(auditEvents.occurredAt))
		.limit(32)

	for (const row of rows) {
		if (row.targetId && row.targetId !== appointmentId) continue
		const payload = row.payload as SessionLocationAuditPayload | null
		if (!payload) continue
		if (payload.appointmentId && payload.appointmentId !== appointmentId) continue
		if (payload.allowed === true) {
			return { payload, occurredAt: row.occurredAt }
		}
	}

	return null
}

/**
 * Resolve whether a recent allowed `session_location_verify` audit row exists
 * for this user + appointment within the configured TTL. Used by
 * `sessions.service.ts` to gate join-token mints (mirrors the UI gate so the
 * client cannot skip the check by calling the mint directly).
 */
export async function hasRecentAllowedLocationAudit(
	userId: string,
	appointmentId: string
): Promise<boolean> {
	return (await getRecentAllowedLocationAudit(userId, appointmentId)) !== null
}
