"use client"

import type { Route } from "next"
import { useRouter } from "next/navigation"
import { Alert02FreeIcons, ShieldFreeIcons } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"

interface VpnDetectedDialogProps {
	open: boolean
	ipInfo?: {
		isp?: string
		org?: string
		country?: string
	} | null
	onRetry?: () => void
	isRetrying?: boolean
	/** When VPN check could not complete (often VPN still on). */
	checkInconclusive?: boolean
}

export function VpnDetectedDialog({
	open,
	ipInfo,
	onRetry,
	isRetrying = false,
	checkInconclusive = false,
}: VpnDetectedDialogProps) {
	const router = useRouter()

	function handleGoBack() {
		router.push("/appointments" as Route)
	}

	const title = checkInconclusive ? "Turn off VPN or proxy" : "VPN/Proxy Detected"
	const lead = checkInconclusive
		? "We could not verify your network while VPN or proxy may be active. Turn it off completely, then try again."
		: "Turn off your VPN or proxy to continue. VPN and proxy connections are not allowed during notarization sessions."

	return (
		<Dialog open={open}>
			<DialogContent className="sm:max-w-md" showCloseButton={false}>
				<DialogHeader className="text-center sm:text-center">
					<div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
						<HugeiconsIcon
							icon={ShieldFreeIcons}
							className="size-8 text-red-600 dark:text-red-500"
							strokeWidth={2}
						/>
					</div>
					<DialogTitle className="text-xl">{title}</DialogTitle>
					<DialogDescription className="text-center">{lead}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
						<div className="flex items-start gap-3">
							<HugeiconsIcon
								icon={Alert02FreeIcons}
								className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-500"
								strokeWidth={2}
							/>
							<div className="space-y-1">
								<p className="text-sm font-medium text-red-800 dark:text-red-200">
									Why is this required?
								</p>
								<p className="text-sm text-red-700 dark:text-red-300">
									Philippine notarization laws require verification of your actual physical
									location. VPN and proxy services mask your real location. Location is checked only
									after VPN is turned off.
								</p>
							</div>
						</div>
					</div>

					{ipInfo && (ipInfo.isp ?? ipInfo.org) && (
						<div className="bg-muted/50 rounded-lg p-3">
							<p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
								Detected Network
							</p>
							<p className="text-sm font-medium">{ipInfo.org ?? ipInfo.isp}</p>
							{ipInfo.country && <p className="text-muted-foreground text-xs">{ipInfo.country}</p>}
						</div>
					)}

					<div className="text-muted-foreground space-y-2 text-sm">
						<p className="font-medium">To join this meeting, please:</p>
						<ol className="ml-4 list-decimal space-y-1">
							<li>Disconnect from your VPN or proxy service</li>
							<li>Disable any browser extensions that route traffic through proxies</li>
							<li>Tap &quot;Try again&quot; below once VPN is off</li>
						</ol>
					</div>
				</div>

				<DialogFooter className="flex-col gap-2 sm:flex-col">
					{onRetry ? (
						<Button type="button" className="w-full" disabled={isRetrying} onClick={onRetry}>
							{isRetrying ? "Checking connection…" : "Try again"}
						</Button>
					) : null}
					<Button
						type="button"
						variant={onRetry ? "outline" : "default"}
						className="w-full"
						onClick={handleGoBack}
					>
						Go Back to Appointments
					</Button>
					<p className="text-muted-foreground text-center text-xs">
						If you believe this is an error, please contact support.
					</p>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
