"use client"

import * as React from "react"
import { toast } from "sonner"

import type { UserProfile } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import { useHyperVergeSdk } from "@/features/kyc/hooks/use-hyperverge-sdk"
import { isProfileKycVerified } from "@/features/kyc/lib/profile-kyc-gate"

interface LobbyGuestKycCheckProps {
	/** From lobbyCheck.guestKycComplete — successful HyperVerge onboarding on file. */
	serverKycComplete?: boolean
	/** When true, parent enables the next step (session liveness). */
	onVerifiedChange: (verified: boolean) => void
	/** Called after HyperVerge SDK finishes so the parent can refresh lobby status. */
	onRefreshStatus?: () => void
}

export function LobbyGuestKycCheck({
	serverKycComplete,
	onVerifiedChange,
	onRefreshStatus,
}: LobbyGuestKycCheckProps) {
	const profileQ = useAuthProfileMeQuery()
	const hv = useHyperVergeSdk({
		workflow: "onboarding",
		skipExpiryGate: true,
		onComplete: () => {
			void profileQ.refetch().then(() => onRefreshStatus?.())
		},
	})

	const profile = profileQ.data as UserProfile | undefined
	const verified = serverKycComplete === true || isProfileKycVerified(profile?.identityStatus)

	React.useEffect(() => {
		onVerifiedChange(verified)
	}, [verified, onVerifiedChange])

	async function startVerification() {
		await hv.launch()
		await profileQ.refetch()
		onRefreshStatus?.()
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Identity verification (KYC)</CardTitle>
				<CardDescription>
					As an invited witness, verify your government ID here before the liveness and location
					checks. You do not need to leave for Profile settings.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
						KYC
					</span>
					<Badge variant="outline">
						{profileQ.isLoading ? "Checking…" : verified ? "Complete" : "Required"}
					</Badge>
				</div>
				{!verified ? (
					<Button
						type="button"
						size="sm"
						disabled={hv.isLoading || profileQ.isLoading}
						onClick={() =>
							void startVerification().catch(() => {
								toast.error("Could not open identity verification. Try again.")
							})
						}
					>
						{hv.isLoading ? "Opening verification…" : "Verify identity with HyperVerge"}
					</Button>
				) : (
					<p className="text-sm text-emerald-600 dark:text-emerald-400">
						Identity verification is on file. Continue with the liveness check below.
					</p>
				)}
				{hv.error ? <p className="text-destructive text-sm break-words">{hv.error}</p> : null}
			</CardContent>
		</Card>
	)
}
