"use client"

import * as React from "react"
import {
	CheckmarkCircle02FreeIcons,
	Clock01FreeIcons,
	Loading01FreeIcons,
	MapPinFreeIcons,
	ShieldFreeIcons,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type {
	LocationDebugInfo,
	LocationVerificationDetails,
	UserRole,
	VerifyLocationResult,
} from "@repo/contracts"

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { useGeolocation } from "@/core/hooks/use-geolocation"
import {
	isTrustedServerIpForWebrtc,
	useWebrtcLeakDetection,
} from "@/core/hooks/use-webrtc-leak-detection"
import { cn } from "@/core/lib/utils"
import {
	useLocationVerification,
	useQuickVpnCheck,
} from "@/features/sessions/api/location-verification.hooks"
import { LocationErrorDialog } from "@/features/sessions/components/dialogs/location-error-dialog"
import { VpnDetectedDialog } from "@/features/sessions/components/dialogs/vpn-detected-dialog"
import { formatDistance } from "@/features/sessions/lib/location-reverification-copy"
import {
	isQuickVpnCheckPassed,
	shouldTreatAsVpnBlock,
	vpnInfoFromCheckResult,
} from "@/features/sessions/lib/vpn-block-ui"
import { env } from "@/env"

type LobbyUserRole = UserRole | "guest_signer" | "none"

type LocationStatus =
	| "awaiting_liveness"
	| "checking_vpn"
	| "checking_location"
	| "verifying"
	| "verified"
	| "vpn_detected"
	| "error"
	| "permission_denied"
	| "unavailable"
	| "timeout"

interface LobbyLocationBlockerProps {
	appointmentId: string
	role: LobbyUserRole
	/** When false, VPN/GPS are not requested (liveness must complete first). */
	livenessVerified: boolean
	onVerifiedChange: (verified: boolean) => void
	className?: string
}

interface VpnInfo {
	isp?: string
	org?: string
	country?: string
}

function vpnInfoFromVerifyResult(result: VerifyLocationResult): VpnInfo | null {
	if (result.vpnDetails) {
		return {
			isp: result.vpnDetails.provider,
			org: result.vpnDetails.organisation,
			country: result.vpnDetails.country,
		}
	}
	if (result.ipApiDetails) {
		return {
			isp: result.ipApiDetails.isp ?? undefined,
			org: result.ipApiDetails.org ?? undefined,
			country: result.ipApiDetails.countryCode ?? undefined,
		}
	}
	return null
}

function resetPipelineState() {
	return {
		locationStatus: "checking_vpn" as LocationStatus,
		verificationResult: null as VerifyLocationResult | null,
		vpnInfo: null as VpnInfo | null,
		expectedIp: null as string | null,
		isClientValidationPending: false,
		hasAttemptedVerification: false,
	}
}

/**
 * 4-gate lobby location pipeline (mirrors quanby-legal):
 *   1. Quick VPN check (`session.locationVerification.checkVpn`) before any prompt.
 *   2. High-accuracy geolocation via the browser's Geolocation API.
 *   3. Server `verifyLocation` (Google Maps reverse-geocode + PH-only country check).
 *   4. WebRTC ICE candidate scan vs server-reported public IP.
 *
 * The pipeline runs only after `livenessVerified` is true so a HyperVerge redirect
 * does not race with an early GPS prompt.
 */
export function LobbyLocationBlocker({
	appointmentId,
	role,
	livenessVerified,
	onVerifiedChange,
	className,
}: LobbyLocationBlockerProps) {
	const { verifyLocation } = useLocationVerification()
	const {
		vpnCheckResult,
		browserPublicIp,
		isChecking: isVpnChecking,
		performVpnCheck,
		resetVpnCheck,
	} = useQuickVpnCheck()

	const [locationStatus, setLocationStatus] = React.useState<LocationStatus>("awaiting_liveness")
	const [verificationResult, setVerificationResult] = React.useState<VerifyLocationResult | null>(
		null
	)
	const [vpnInfo, setVpnInfo] = React.useState<VpnInfo | null>(null)
	const [expectedIp, setExpectedIp] = React.useState<string | null>(null)
	const [isClientValidationPending, setIsClientValidationPending] = React.useState(false)
	const [hasAttemptedVerification, setHasAttemptedVerification] = React.useState(false)
	const [isRetryingLocation, setIsRetryingLocation] = React.useState(false)
	const [isRetryingVpn, setIsRetryingVpn] = React.useState(false)
	const quickVpnCheckedForAppointmentId = React.useRef<string | null>(null)
	const livenessWasVerifiedRef = React.useRef(false)

	const pipelineActive = livenessVerified

	const webrtcLeak = useWebrtcLeakDetection(expectedIp)
	const isDebug = env.NEXT_PUBLIC_LOCATION_VERIFICATION_DEBUG === "true"
	const maxGpsAccuracyMeters = env.NEXT_PUBLIC_SESSION_GPS_MAX_ACCURACY_M

	const geolocationOptions = React.useMemo<PositionOptions>(
		() => ({ enableHighAccuracy: true, timeout: 30_000, maximumAge: 0 }),
		[]
	)

	const quickVpnPassed = isQuickVpnCheckPassed(vpnCheckResult)

	const {
		position,
		error: geoError,
		isLoading: isGeoLoading,
	} = useGeolocation(geolocationOptions, quickVpnPassed && pipelineActive)

	React.useEffect(() => {
		onVerifiedChange(livenessVerified && locationStatus === "verified")
	}, [livenessVerified, locationStatus, onVerifiedChange])

	// Start a fresh location pipeline once liveness completes (including after HyperVerge redirect).
	React.useEffect(() => {
		if (!livenessVerified) {
			livenessWasVerifiedRef.current = false
			setLocationStatus("awaiting_liveness")
			return
		}

		if (livenessWasVerifiedRef.current) return
		livenessWasVerifiedRef.current = true

		const reset = resetPipelineState()
		setLocationStatus(reset.locationStatus)
		setVerificationResult(reset.verificationResult)
		setVpnInfo(reset.vpnInfo)
		setExpectedIp(reset.expectedIp)
		setIsClientValidationPending(reset.isClientValidationPending)
		setHasAttemptedVerification(reset.hasAttemptedVerification)
		quickVpnCheckedForAppointmentId.current = null
	}, [livenessVerified])

	// Step 1: quick VPN pre-check (no geolocation prompt yet).
	React.useEffect(() => {
		if (!pipelineActive) return
		if (quickVpnCheckedForAppointmentId.current === appointmentId) return
		quickVpnCheckedForAppointmentId.current = appointmentId
		void performVpnCheck()
	}, [appointmentId, performVpnCheck, pipelineActive])

	// VPN result handler — block on positive detection, otherwise enable geolocation.
	React.useEffect(() => {
		if (!pipelineActive || !vpnCheckResult) return

		if (isDebug) {
			// eslint-disable-next-line no-console
			console.log("[Location Verification Debug] Quick VPN result", vpnCheckResult)
		}

		if (vpnCheckResult.checked && vpnCheckResult.isVpn) {
			setLocationStatus("vpn_detected")
			setVpnInfo(vpnInfoFromCheckResult(vpnCheckResult))
			setHasAttemptedVerification(true)
			return
		}

		setLocationStatus(prev => (prev === "checking_vpn" ? "checking_location" : prev))
	}, [vpnCheckResult, isDebug, pipelineActive])

	// Step 2 error handler — map browser geolocation errors to dialog states.
	React.useEffect(() => {
		if (!pipelineActive) return
		if (!geoError || hasAttemptedVerification) return
		// eslint-disable-next-line no-console
		if (isDebug) console.log("[Location Verification Debug] Geolocation error", geoError)

		if (geoError.code === 1) {
			setLocationStatus("permission_denied")
		} else if (geoError.code === 2) {
			setLocationStatus("unavailable")
		} else if (geoError.code === 3) {
			setLocationStatus("timeout")
		} else {
			setLocationStatus("error")
			setVerificationResult({
				allowed: false,
				reason: "geolocation_error",
				debugInfo: {
					errorCode: `GEOLOCATION_ERROR_${geoError.code}`,
					errorMessage: geoError.message || "Unknown geolocation error",
					userMessage:
						"Your device reported a geolocation error. Please check browser compatibility and location settings.",
					suggestedAction:
						"Try a supported browser, enable location services, and retry verification.",
					timestamp: new Date().toISOString(),
				},
			})
		}
		setHasAttemptedVerification(true)
	}, [geoError, hasAttemptedVerification, isDebug, pipelineActive])

	// Step 3: server reverse-geocode + PH-only decision (only after VPN pre-check passed).
	React.useEffect(() => {
		if (!pipelineActive) return
		if (locationStatus === "vpn_detected") return
		if (!position || hasAttemptedVerification) return
		setHasAttemptedVerification(true)
		setLocationStatus("verifying")

		const accuracy = position.coords.accuracy
		if (accuracy > maxGpsAccuracyMeters) {
			setLocationStatus("error")
			setVerificationResult({
				allowed: false,
				reason: "gps_accuracy_low",
				debugInfo: {
					errorCode: "GPS_ACCURACY_LOW",
					errorMessage: `GPS accuracy is ${accuracy.toFixed(1)}m, above the ${maxGpsAccuracyMeters}m threshold`,
					userMessage: "Your GPS signal is too weak to verify location accurately.",
					suggestedAction: "Move outdoors, wait for stronger signal, then retry.",
					timestamp: new Date().toISOString(),
					accuracyMeters: accuracy,
				},
			})
			return
		}

		if (isDebug) {
			// eslint-disable-next-line no-console
			console.log("[Location Verification Debug] Submitting verification", {
				latitude: position.coords.latitude,
				longitude: position.coords.longitude,
				accuracyMeters: accuracy,
				appointmentId,
			})
		}

		verifyLocation.mutate(
			{
				latitude: position.coords.latitude,
				longitude: position.coords.longitude,
				accuracyMeters: accuracy,
				appointmentId,
				browserPublicIp: browserPublicIp ?? undefined,
			},
			{
				onSuccess: result => {
					setExpectedIp(result.clientIp ?? null)

					if (shouldTreatAsVpnBlock(result)) {
						setLocationStatus("vpn_detected")
						const info = vpnInfoFromCheckResult(result) ?? vpnInfoFromVerifyResult(result)
						if (info) setVpnInfo(info)
					} else if (result.allowed) {
						if (result.clientIp) {
							setIsClientValidationPending(true)
							setLocationStatus("checking_location")
						} else {
							setLocationStatus("verified")
						}
					} else {
						setLocationStatus("error")
					}
					setVerificationResult(result)
				},
				onError: error => {
					// eslint-disable-next-line no-console
					if (isDebug) console.log("[Location Verification Debug] Mutation error", error)
					setLocationStatus("error")
					setVerificationResult({
						allowed: false,
						reason: "server_error",
						debugInfo: {
							errorCode: "LOCATION_VERIFICATION_MUTATION_ERROR",
							errorMessage: error instanceof Error ? error.message : String(error),
							userMessage: "We could not reach the location verification service.",
							suggestedAction: "Please check your connection and retry.",
							timestamp: new Date().toISOString(),
						},
					})
				},
			}
		)
	}, [
		position,
		hasAttemptedVerification,
		appointmentId,
		isDebug,
		maxGpsAccuracyMeters,
		verifyLocation,
		pipelineActive,
		locationStatus,
		browserPublicIp,
	])

	// Step 4: WebRTC vs server IP — block when HTTP and STUN public IPs diverge (typical VPN leak).
	React.useEffect(() => {
		if (!pipelineActive || !isClientValidationPending || webrtcLeak.isLoading) return

		const serverIpTrusted = isTrustedServerIpForWebrtc(expectedIp)

		if (serverIpTrusted && webrtcLeak.isLeaking) {
			if (isDebug) {
				// eslint-disable-next-line no-console
				console.warn("[Location Verification Debug] WebRTC IP mismatch", {
					expectedIp,
					leakedIps: webrtcLeak.leakedIps,
				})
			}
			setLocationStatus("vpn_detected")
			setVpnInfo({
				org: "WebRTC mismatch",
				isp: webrtcLeak.leakedIps[0],
				country: verificationResult?.details?.countryCode,
			})
		} else {
			setLocationStatus("verified")
		}

		setIsClientValidationPending(false)
	}, [
		pipelineActive,
		isClientValidationPending,
		expectedIp,
		verificationResult?.details?.countryCode,
		webrtcLeak.isLeaking,
		webrtcLeak.isLoading,
		webrtcLeak.leakedIps,
		isDebug,
	])

	const retryVpnCheck = React.useCallback(async () => {
		if (isRetryingVpn) return
		setIsRetryingVpn(true)
		setHasAttemptedVerification(false)
		setVerificationResult(null)
		setVpnInfo(null)
		setExpectedIp(null)
		setIsClientValidationPending(false)
		setLocationStatus("checking_vpn")
		resetVpnCheck()
		quickVpnCheckedForAppointmentId.current = null

		const result = await performVpnCheck()
		setIsRetryingVpn(false)

		if (result.checked && result.isVpn) {
			setLocationStatus("vpn_detected")
			setVpnInfo(vpnInfoFromCheckResult(result))
			setHasAttemptedVerification(true)
		} else {
			setLocationStatus("checking_location")
			setHasAttemptedVerification(false)
		}
	}, [isRetryingVpn, performVpnCheck, resetVpnCheck])

	const retryVerification = React.useCallback(() => {
		if (isRetryingLocation) return
		setIsRetryingLocation(true)
		setHasAttemptedVerification(false)
		setLocationStatus("checking_vpn")
		setVerificationResult(null)
		setVpnInfo(null)
		setExpectedIp(null)
		setIsClientValidationPending(false)
		// Geolocation results are cached by the browser; a full reload is the
		// simplest way to re-trigger the prompt and the watchPosition cycle.
		if (typeof window !== "undefined") window.location.reload()
	}, [isRetryingLocation])

	const showVpnDialog = pipelineActive && locationStatus === "vpn_detected"
	const showLocationErrorDialog =
		pipelineActive &&
		!showVpnDialog &&
		(locationStatus === "error" ||
			locationStatus === "permission_denied" ||
			locationStatus === "unavailable" ||
			locationStatus === "timeout")
	const errorDetails: LocationVerificationDetails | undefined = verificationResult?.details
	const errorDebug: LocationDebugInfo | undefined = verificationResult?.debugInfo
	const errorReason =
		locationStatus === "permission_denied"
			? "permission_denied"
			: locationStatus === "unavailable"
				? "unavailable"
				: locationStatus === "timeout"
					? "timeout"
					: (verificationResult?.reason ?? "location_unknown")

	let statusLabel = "Waiting for liveness verification…"
	if (livenessVerified) {
		if (locationStatus === "checking_vpn") {
			statusLabel = isVpnChecking ? "Checking network reputation…" : "Preparing location check…"
		} else if (locationStatus === "checking_location") {
			statusLabel = isGeoLoading
				? "Waiting for GPS fix…"
				: isClientValidationPending
					? "Cross-checking your network…"
					: "Verifying your location…"
		} else if (locationStatus === "verifying") {
			statusLabel = "Verifying your location…"
		} else if (locationStatus === "verified") {
			const detail = verificationResult?.details
			if (detail?.nearbyEmbassy && detail.distanceToEmbassyKm !== undefined) {
				statusLabel = `Verified near ${detail.nearbyEmbassy.name} (${formatDistance(detail.distanceToEmbassyKm)})`
			} else if (detail?.formattedAddress) {
				statusLabel = `Verified: ${detail.formattedAddress}`
			} else {
				statusLabel = "Location verified."
			}
		} else if (locationStatus === "vpn_detected") {
			statusLabel = "VPN or proxy detected — turn it off to continue"
		}
	}

	const statusIcon =
		locationStatus === "verified"
			? CheckmarkCircle02FreeIcons
			: locationStatus === "vpn_detected"
				? ShieldFreeIcons
				: locationStatus === "verifying" || locationStatus === "checking_location"
					? Loading01FreeIcons
					: locationStatus === "checking_vpn"
						? Clock01FreeIcons
						: MapPinFreeIcons

	const iconClass =
		locationStatus === "verified"
			? "text-emerald-600"
			: locationStatus === "vpn_detected"
				? "text-red-600"
				: locationStatus === "verifying" || locationStatus === "checking_location"
					? "text-muted-foreground animate-spin"
					: "text-muted-foreground"

	return (
		<>
			<div className={cn("h-full min-h-0", className)}>
				<Card className="h-full">
					<CardHeader>
						<CardTitle className="text-base">Confirm your location</CardTitle>
						<CardDescription>
							After identity liveness is complete, we check for VPN or proxy first. Only when your
							network is clear do we request GPS and verify you are in the Philippines.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-start gap-3">
							<HugeiconsIcon
								icon={statusIcon}
								className={`mt-0.5 size-5 shrink-0 ${iconClass}`}
								strokeWidth={2}
							/>
							<div className="space-y-1">
								<p className="text-sm font-medium">{statusLabel}</p>
								{locationStatus === "verified" &&
									verificationResult?.details?.formattedAddress &&
									verificationResult.details.formattedAddress !== statusLabel && (
										<p className="text-muted-foreground text-xs">
											{verificationResult.details.formattedAddress}
										</p>
									)}
								{!livenessVerified ? (
									<p className="text-muted-foreground text-xs">
										Complete identity liveness above first. Location access will be requested after
										that step succeeds.
									</p>
								) : locationStatus === "vpn_detected" ? (
									<p className="text-muted-foreground text-xs">
										Disconnect your VPN or proxy, then tap &quot;Try again&quot; in the dialog to
										continue.
									</p>
								) : locationStatus !== "verified" ? (
									<p className="text-muted-foreground text-xs">
										Your browser may show a permission prompt — please allow location access.
									</p>
								) : null}
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<VpnDetectedDialog
				open={showVpnDialog}
				ipInfo={vpnInfo}
				onRetry={() => void retryVpnCheck()}
				isRetrying={isRetryingVpn || isVpnChecking}
			/>
			<LocationErrorDialog
				open={showLocationErrorDialog}
				errorReason={errorReason}
				userRole={role}
				details={errorDetails}
				debugInfo={errorDebug}
				onRetry={retryVerification}
				isRetrying={isRetryingLocation}
			/>
		</>
	)
}
