"use client"

import * as React from "react"
import { toast } from "sonner"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { cn } from "@/core/lib/utils"
import {
	useSessionLivenessStatusQuery,
	useStartHostedLivenessMutation,
} from "@/features/appointments/api/session-liveness.hooks"

interface LobbyHypervergeLivenessCheckProps {
	appointmentId: string
	guestInviteToken?: string | null
	returnShell?: "site" | "admin"
	returnPath?: string
	/** When true, parent enables "Enter encrypted meeting". */
	onVerifiedChange: (verified: boolean) => void
	className?: string
}

export function LobbyHypervergeLivenessCheck({
	appointmentId,
	guestInviteToken,
	returnShell = "site",
	returnPath,
	onVerifiedChange,
	className,
}: LobbyHypervergeLivenessCheckProps) {
	const statusQ = useSessionLivenessStatusQuery(appointmentId, guestInviteToken)
	const startMut = useStartHostedLivenessMutation()
	const [lastError, setLastError] = React.useState<string | null>(null)

	const statusData = statusQ.data as { isVerified?: boolean } | undefined
	const isVerified = statusData?.isVerified === true
	const busy = startMut.isPending || statusQ.isFetching

	React.useEffect(() => {
		onVerifiedChange(isVerified)
	}, [isVerified, onVerifiedChange])

	async function runHostedLiveness() {
		setLastError(null)
		try {
			const startMutate = startMut.mutateAsync as unknown as (vars: {
				appointmentId: string
				returnShell?: "site" | "admin"
				returnPath?: string
				guestInviteToken?: string
			}) => Promise<{ redirectUrl?: string | null }>
			const result = await startMutate({
				appointmentId,
				returnShell,
				...(returnPath ? { returnPath } : {}),
				...(guestInviteToken ? { guestInviteToken } : {}),
			})
			if (!result.redirectUrl) {
				throw new Error("No redirect URL returned from HyperVerge")
			}
			toast.success("Opening HyperVerge liveness…")
			globalThis.location.href = result.redirectUrl
		} catch (e) {
			const msg = getOrpcMutationErrorMessage(
				e,
				"Could not start liveness verification. Complete Profile identity verification first if prompted."
			)
			setLastError(msg)
			toast.error(msg)
		}
	}

	return (
		<Card className={cn("h-full", className)}>
			<CardHeader>
				<CardTitle className="text-base">Identity liveness</CardTitle>
				<CardDescription>
					Complete a quick selfie liveness check so we can confirm you are the signed-in account
					holder before the encrypted meeting opens.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
						Liveness
					</span>
					<Badge variant="outline">
						{statusQ.isLoading ? "Checking…" : isVerified ? "Complete" : "Required"}
					</Badge>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button type="button" size="sm" disabled={busy} onClick={() => void runHostedLiveness()}>
						{busy ? "Starting…" : isVerified ? "Re-run liveness check" : "Run liveness check"}
					</Button>
				</div>
				{isVerified && (
					<p className="text-sm text-emerald-600 dark:text-emerald-400">
						Liveness check complete for this booking. Confirm your location below to continue.
					</p>
				)}
				{lastError ? <p className="text-destructive text-sm break-words">{lastError}</p> : null}
			</CardContent>
		</Card>
	)
}
