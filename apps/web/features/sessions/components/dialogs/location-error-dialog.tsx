"use client"

import { useMemo, useState } from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import {
	AlertCircleFreeIcons,
	ArrowDown01FreeIcons,
	CloudServerFreeIcons,
	GlobeFreeIcons,
	Loading01FreeIcons,
	MapPinFreeIcons,
	MapsOffFreeIcons,
	Navigation01FreeIcons,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type {
	LocationDebugInfo,
	LocationReason,
	LocationVerificationDetails,
	UserRole,
} from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import {
	formatDistance,
	getLocationRequirementMessage,
} from "@/features/sessions/lib/location-reverification-copy"
import { env } from "@/env"

type HugeIcon = React.ComponentProps<typeof HugeiconsIcon>["icon"]

type LobbyUserRole = UserRole | "guest_signer" | "none"

interface LocationErrorDialogProps {
	open: boolean
	errorReason: LocationReason
	userRole: LobbyUserRole
	details?: LocationVerificationDetails
	debugInfo?: LocationDebugInfo
	onRetry?: () => void
	isRetrying?: boolean
}

interface ErrorConfig {
	icon: HugeIcon
	iconColor: string
	iconBgColor: string
	title: string
	description: string
	showRetry: boolean
}

function getErrorConfig(errorReason: LocationReason, userRole: LobbyUserRole): ErrorConfig {
	const phOnlyRequirement = "You must be located within the Philippines to join this meeting."
	const enpRequirement =
		"As a notary (ENP), you must be physically located within the Philippines to conduct notarization sessions."
	const outsideDescription = userRole === "enp" ? enpRequirement : phOnlyRequirement

	const configs: Record<LocationReason, ErrorConfig> = {
		outside_philippines: {
			icon: GlobeFreeIcons,
			iconColor: "text-orange-600 dark:text-orange-500",
			iconBgColor: "bg-orange-100 dark:bg-orange-900/20",
			title: "Location Outside Allowed Area",
			description: outsideDescription,
			showRetry: true,
		},
		enp_at_embassy_abroad: {
			icon: MapPinFreeIcons,
			iconColor: "text-red-600 dark:text-red-500",
			iconBgColor: "bg-red-100 dark:bg-red-900/20",
			title: "Location Outside Allowed Area",
			description: enpRequirement,
			showRetry: true,
		},
		location_unknown: {
			icon: MapsOffFreeIcons,
			iconColor: "text-gray-600 dark:text-gray-400",
			iconBgColor: "bg-gray-100 dark:bg-gray-800",
			title: "Unable to Verify Location",
			description:
				"We could not determine your location. Please ensure location services are enabled and try again.",
			showRetry: true,
		},
		gps_accuracy_low: {
			icon: Navigation01FreeIcons,
			iconColor: "text-yellow-600 dark:text-yellow-500",
			iconBgColor: "bg-yellow-100 dark:bg-yellow-900/20",
			title: "GPS Accuracy Too Low",
			description:
				"Your GPS signal is not accurate enough yet. Move outdoors, wait for a stronger signal, then try again.",
			showRetry: true,
		},
		google_maps_api_error: {
			icon: CloudServerFreeIcons,
			iconColor: "text-red-600 dark:text-red-500",
			iconBgColor: "bg-red-100 dark:bg-red-900/20",
			title: "Location Service Error",
			description:
				"The location verification service returned an API error. Please retry, or contact support if this continues.",
			showRetry: true,
		},
		server_error: {
			icon: CloudServerFreeIcons,
			iconColor: "text-red-600 dark:text-red-500",
			iconBgColor: "bg-red-100 dark:bg-red-900/20",
			title: "Server Error",
			description:
				"We could not complete location verification because of a server issue. Please try again.",
			showRetry: true,
		},
		vpn_detected: {
			icon: AlertCircleFreeIcons,
			iconColor: "text-red-600 dark:text-red-500",
			iconBgColor: "bg-red-100 dark:bg-red-900/20",
			title: "VPN Detected",
			description: "VPN or proxy connections are not allowed during notarization sessions.",
			showRetry: false,
		},
		vpn_check_unavailable: {
			icon: AlertCircleFreeIcons,
			iconColor: "text-red-600 dark:text-red-500",
			iconBgColor: "bg-red-100 dark:bg-red-900/20",
			title: "VPN Check Unavailable",
			description:
				"VPN validation is temporarily unavailable due to server configuration. Meeting entry is blocked.",
			showRetry: false,
		},
		geolocation_error: {
			icon: Navigation01FreeIcons,
			iconColor: "text-yellow-600 dark:text-yellow-500",
			iconBgColor: "bg-yellow-100 dark:bg-yellow-900/20",
			title: "Geolocation Error",
			description:
				"There was an error obtaining your location. Please check your device settings and try again.",
			showRetry: true,
		},
		permission_denied: {
			icon: MapsOffFreeIcons,
			iconColor: "text-red-600 dark:text-red-500",
			iconBgColor: "bg-red-100 dark:bg-red-900/20",
			title: "Location Permission Denied",
			description:
				"Location access is required for this meeting. Please enable location permissions in your browser settings and try again.",
			showRetry: true,
		},
		unavailable: {
			icon: Navigation01FreeIcons,
			iconColor: "text-yellow-600 dark:text-yellow-500",
			iconBgColor: "bg-yellow-100 dark:bg-yellow-900/20",
			title: "Location Unavailable",
			description:
				"Your device could not determine your location. Please ensure GPS is enabled and you have a clear signal.",
			showRetry: true,
		},
		timeout: {
			icon: Navigation01FreeIcons,
			iconColor: "text-yellow-600 dark:text-yellow-500",
			iconBgColor: "bg-yellow-100 dark:bg-yellow-900/20",
			title: "Location Request Timed Out",
			description:
				"The location request took too long. Please check your connection and try again.",
			showRetry: true,
		},
		in_philippines: {
			icon: MapPinFreeIcons,
			iconColor: "text-green-600 dark:text-green-500",
			iconBgColor: "bg-green-100 dark:bg-green-900/20",
			title: "Location Verified",
			description: "Your location has been verified.",
			showRetry: false,
		},
		near_embassy: {
			icon: MapPinFreeIcons,
			iconColor: "text-green-600 dark:text-green-500",
			iconBgColor: "bg-green-100 dark:bg-green-900/20",
			title: "Location Verified",
			description: "Your location has been verified.",
			showRetry: false,
		},
	}

	return configs[errorReason] ?? configs.location_unknown
}

export function LocationErrorDialog({
	open,
	errorReason,
	userRole,
	details,
	debugInfo,
	onRetry,
	isRetrying = false,
}: LocationErrorDialogProps) {
	const router = useRouter()
	const config = getErrorConfig(errorReason, userRole)
	const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
	const isDebugMode = env.NEXT_PUBLIC_LOCATION_VERIFICATION_DEBUG === "true"
	const shouldShowTechnicalDetails = showTechnicalDetails || isDebugMode
	const isAccuracyLowState =
		errorReason === "gps_accuracy_low" && debugInfo?.accuracyMeters !== undefined

	const technicalDetailsText = useMemo(() => {
		const lines = [
			debugInfo?.errorCode ? `Error code: ${debugInfo.errorCode}` : null,
			debugInfo?.errorMessage ? `Error message: ${debugInfo.errorMessage}` : null,
			debugInfo?.apiStatusCode ? `API status: ${debugInfo.apiStatusCode}` : null,
			debugInfo?.accuracyMeters !== undefined
				? `GPS accuracy: ${debugInfo.accuracyMeters.toFixed(1)}m`
				: null,
			debugInfo?.requestId ? `Request ID: ${debugInfo.requestId}` : null,
			debugInfo?.timestamp ? `Timestamp: ${debugInfo.timestamp}` : null,
		].filter(Boolean)
		return lines.join("\n")
	}, [debugInfo])

	function handleGoBack() {
		router.push("/appointments" as Route)
	}

	return (
		<Dialog open={open}>
			<DialogContent className="sm:max-w-md" showCloseButton={false}>
				<DialogHeader className="text-center sm:text-center">
					<div
						className={`mx-auto mb-4 flex size-16 items-center justify-center rounded-full ${config.iconBgColor}`}
					>
						<HugeiconsIcon
							icon={config.icon}
							className={`size-8 ${config.iconColor}`}
							strokeWidth={2}
						/>
					</div>
					<DialogTitle className="text-xl">{config.title}</DialogTitle>
					<DialogDescription className="text-center">
						{debugInfo?.userMessage ?? config.description}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{errorReason === "enp_at_embassy_abroad" && details?.nearbyEmbassy && (
						<div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
							<p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
								Detected Location
							</p>
							<p className="font-medium text-orange-800 dark:text-orange-200">
								{details.nearbyEmbassy.name}
							</p>
							<p className="text-sm text-orange-700 dark:text-orange-300">
								{details.nearbyEmbassy.city}, {details.nearbyEmbassy.country}
							</p>
							{details.distanceToEmbassyKm !== undefined && (
								<p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
									{formatDistance(details.distanceToEmbassyKm)} from embassy
								</p>
							)}
						</div>
					)}

					<div className="bg-muted/50 rounded-lg p-4">
						<div className="flex items-start gap-3">
							<HugeiconsIcon
								icon={AlertCircleFreeIcons}
								className="text-muted-foreground mt-0.5 size-5 shrink-0"
								strokeWidth={2}
							/>
							<div className="space-y-1">
								<p className="text-sm font-medium">Location Requirements</p>
								<p className="text-muted-foreground text-sm">
									{getLocationRequirementMessage(userRole)}
								</p>
							</div>
						</div>
					</div>

					{errorReason === "permission_denied" && (
						<div className="text-muted-foreground space-y-2 text-sm">
							<p className="font-medium">How to enable location access:</p>
							<ol className="ml-4 list-decimal space-y-1">
								<li>Click the lock/info icon in your browser&apos;s address bar</li>
								<li>Find &quot;Location&quot; in the permissions list</li>
								<li>Change the setting to &quot;Allow&quot;</li>
								<li>Refresh the page and try again</li>
							</ol>
						</div>
					)}

					{isAccuracyLowState && debugInfo?.accuracyMeters !== undefined && (
						<div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950/30">
							<p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
								GPS accuracy: {debugInfo.accuracyMeters.toFixed(1)}m
							</p>
						</div>
					)}

					{debugInfo && (
						<div className="border-border/60 rounded-lg border">
							<button
								type="button"
								className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
								onClick={() => setShowTechnicalDetails(previous => !previous)}
							>
								<span>Technical Details</span>
								<HugeiconsIcon
									icon={ArrowDown01FreeIcons}
									className={`size-4 transition-transform ${shouldShowTechnicalDetails ? "rotate-180" : ""}`}
									strokeWidth={2}
								/>
							</button>
							{shouldShowTechnicalDetails && (
								<div className="border-border/60 space-y-3 border-t px-4 py-3">
									<div className="text-muted-foreground space-y-1 text-xs">
										{debugInfo.errorCode && <p>Error code: {debugInfo.errorCode}</p>}
										{debugInfo.errorMessage && <p>Error: {debugInfo.errorMessage}</p>}
										{debugInfo.apiStatusCode && <p>API status: {debugInfo.apiStatusCode}</p>}
										{debugInfo.accuracyMeters !== undefined && (
											<p>GPS accuracy: {debugInfo.accuracyMeters.toFixed(1)}m</p>
										)}
										{debugInfo.requestId && <p>Request ID: {debugInfo.requestId}</p>}
										{debugInfo.timestamp && <p>Timestamp: {debugInfo.timestamp}</p>}
										{debugInfo.suggestedAction && (
											<p>Suggested action: {debugInfo.suggestedAction}</p>
										)}
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={async () => {
											if (!technicalDetailsText) return
											await navigator.clipboard.writeText(technicalDetailsText)
										}}
									>
										Copy details
									</Button>
								</div>
							)}
						</div>
					)}
				</div>

				<DialogFooter className="flex-col gap-2 sm:flex-col">
					{config.showRetry && onRetry && (
						<Button onClick={onRetry} className="w-full" disabled={isRetrying}>
							{isRetrying ? (
								<>
									<HugeiconsIcon
										icon={Loading01FreeIcons}
										className="mr-2 size-4 animate-spin"
										strokeWidth={2}
									/>
									Retrying...
								</>
							) : (
								"Try Again"
							)}
						</Button>
					)}
					<Button
						variant={config.showRetry && onRetry ? "outline" : "default"}
						onClick={handleGoBack}
						className="w-full"
					>
						Go Back to Appointments
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
