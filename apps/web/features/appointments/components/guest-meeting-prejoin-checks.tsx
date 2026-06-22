"use client"

import * as React from "react"
import type { Route } from "next"

import type { LobbyCheckResult, UserProfile } from "@repo/contracts"

import { useLobbyCheckQuery } from "@/features/appointments/api/session-guest.hooks"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import { ProfileKycRequiredCard } from "@/features/kyc/components/profile-kyc-required-card"
import { LobbyLocationBlocker } from "@/features/sessions/components/lobby-location-blocker"

import { LobbyGuestKycCheck } from "./lobby-guest-kyc-check"
import { LobbyHypervergeLivenessCheck } from "./lobby-hyperverge-liveness-check"

interface GuestMeetingPrejoinChecksProps {
	appointmentId: string
	guestInviteToken: string
	geoOk: boolean
	errorMessage?: string | null
	onGeoVerifiedChange: (verified: boolean) => void
	onAllStepsReady: (ready: boolean) => void
}

function lobbyOk(result: LobbyCheckResult | undefined) {
	return result?.kind === "ok" ? result : null
}

export function GuestMeetingPrejoinChecks({
	appointmentId,
	guestInviteToken,
	geoOk,
	errorMessage,
	onGeoVerifiedChange,
	onAllStepsReady,
}: GuestMeetingPrejoinChecksProps) {
	const lobbyQ = useLobbyCheckQuery({
		appointmentId,
		guestInviteToken,
	})
	const profileQ = useAuthProfileMeQuery()
	const profile = profileQ.data as UserProfile | undefined
	const ok = lobbyOk(lobbyQ.data)
	const [localLivenessOk, setLocalLivenessOk] = React.useState(false)
	const [localKycOk, setLocalKycOk] = React.useState(false)

	const intendedRole = ok?.guestIntendedRole
	const witnessInvite = intendedRole === "witness" || intendedRole === undefined
	const kycComplete = ok?.guestKycComplete === true || localKycOk
	const livenessComplete = ok?.guestLivenessComplete === true || localLivenessOk

	const refreshLobby = React.useCallback(() => {
		void lobbyQ.refetch()
	}, [lobbyQ])

	React.useEffect(() => {
		if (ok?.guestKycComplete) setLocalKycOk(true)
		if (ok?.guestLivenessComplete) setLocalLivenessOk(true)
	}, [ok?.guestKycComplete, ok?.guestLivenessComplete])

	React.useEffect(() => {
		onAllStepsReady(kycComplete && livenessComplete && geoOk)
	}, [kycComplete, geoOk, livenessComplete, onAllStepsReady])

	if (lobbyQ.isLoading || profileQ.isLoading) {
		return <p className="text-muted-foreground text-sm">Loading session checks…</p>
	}

	if (!witnessInvite && !kycComplete && profile) {
		return (
			<div className="mx-auto max-w-lg space-y-4 px-4 py-8">
				<h1 className="text-lg font-semibold tracking-tight">Join live session</h1>
				<ProfileKycRequiredCard
					profile={profile}
					context="lobby"
					backHref={"/dashboard" as Route}
					backLabel="Back to dashboard"
				/>
			</div>
		)
	}

	return (
		<div className="mx-auto max-w-lg space-y-4 px-4 py-8">
			<h1 className="text-lg font-semibold tracking-tight">Join live session</h1>
			<p className="text-muted-foreground text-sm">
				{witnessInvite
					? "Complete identity verification, liveness, and location here — then you will enter the meeting automatically."
					: "Complete the checks below, then you will enter the meeting automatically."}
			</p>

			{witnessInvite && !kycComplete ? (
				<LobbyGuestKycCheck
					serverKycComplete={ok?.guestKycComplete}
					onVerifiedChange={verified => {
						setLocalKycOk(verified)
						if (verified) refreshLobby()
					}}
					onRefreshStatus={refreshLobby}
				/>
			) : null}

			{kycComplete && !livenessComplete ? (
				<LobbyHypervergeLivenessCheck
					appointmentId={appointmentId}
					guestInviteToken={guestInviteToken}
					onVerifiedChange={verified => {
						setLocalLivenessOk(verified)
						if (verified) refreshLobby()
					}}
				/>
			) : null}

			<LobbyLocationBlocker
				appointmentId={appointmentId}
				role="guest_signer"
				livenessVerified={kycComplete && livenessComplete}
				onVerifiedChange={onGeoVerifiedChange}
			/>

			{errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}

			{intendedRole === "witness" ? (
				<p className="text-muted-foreground text-xs">
					Invited as a witness. The notary will assign your signer role on documents after you join.
				</p>
			) : null}
		</div>
	)
}
