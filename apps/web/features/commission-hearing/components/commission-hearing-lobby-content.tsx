"use client"

import * as React from "react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"

import type { CommissionHearingLobbyCheckResult } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button, buttonVariants } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { cn } from "@/core/lib/utils"
import { authClient } from "@/services/better-auth/auth-client"
import { LobbyHypervergeLivenessCheck } from "@/features/appointments/components/lobby-hyperverge-liveness-check"
import { savePostLoginRedirect } from "@/features/auth/lib/post-login-redirect"
import {
	useCommissionHearingLobbyCheckMutation,
	useCommissionHearingPaymentStatusQuery,
	useCommissionHearingQuery,
	useIssueHearingJoinTokenMutation,
	useOpenHearingMutation,
} from "@/features/commission-hearing/api/commission-hearing.hooks"
import { LobbyLocationBlocker } from "@/features/sessions/components/lobby-location-blocker"

import { storeCommissionHearingJoinPayload } from "./commission-hearing-join-storage"
import { CommissionHearingPaymentPanel } from "./commission-hearing-payment-panel"

function lobbyCheckMessage(result: CommissionHearingLobbyCheckResult | null): string | null {
	if (!result || result.kind === "ok") return null
	if (result.kind === "unauthenticated") return "Sign in to join this commission hearing."
	if (result.kind === "not_found") return "This commission hearing could not be found."
	if (result.kind === "forbidden") return "You are not a participant in this commission hearing."
	if (result.kind === "wrong_status") return "The ENA has not opened this hearing yet."
	if (result.kind === "session_ended") return "This commission hearing has ended."
	if (result.kind === "invite_invalid") return "This invite link is invalid."
	if (result.kind === "invite_expired") return "This invite link has expired."
	return "This commission hearing is not available."
}

export function CommissionHearingLobbyContent({
	hearingRoomId,
	inviteToken,
	oppositionToken,
}: {
	hearingRoomId: string
	inviteToken?: string | null
	oppositionToken?: string | null
}) {
	const router = useRouter()
	const [hydrated, setHydrated] = React.useState(false)
	const { data: session, isPending: sessionPending } = authClient.useSession()
	const hasTokenAccess = Boolean(inviteToken || oppositionToken)
	const hearingQ = useCommissionHearingQuery(
		hydrated && session?.user?.id && !hasTokenAccess ? hearingRoomId : null
	)
	const lobbyCheck = useCommissionHearingLobbyCheckMutation()
	const issueJoinToken = useIssueHearingJoinTokenMutation()
	const openHearing = useOpenHearingMutation()
	const [checkResult, setCheckResult] = React.useState<CommissionHearingLobbyCheckResult | null>(
		null
	)
	const okCheckResult = checkResult?.kind === "ok" ? checkResult : null
	const isApplicantUser = Boolean(
		session?.user?.id && hearingQ.data?.applicantUserId === session.user.id
	)
	const isApplicantParticipant =
		isApplicantUser || (checkResult?.kind === "ok" && checkResult.participantRole === "applicant")
	const paymentStatusQ = useCommissionHearingPaymentStatusQuery(
		isApplicantParticipant ? hearingRoomId : null
	)
	const [error, setError] = React.useState<string | null>(null)
	const [geoOk, setGeoOk] = React.useState(false)
	const [identityOk, setIdentityOk] = React.useState(false)
	const redirectedRef = React.useRef(false)

	React.useEffect(() => {
		setHydrated(true)
	}, [])

	React.useEffect(() => {
		if (!hydrated || sessionPending || session?.user?.id) return
		if (redirectedRef.current) return
		redirectedRef.current = true
		const query = new URLSearchParams()
		if (inviteToken) query.set("invite", inviteToken)
		if (oppositionToken) query.set("oppositionToken", oppositionToken)
		const returnPath = `/commission-hearings/${hearingRoomId}/lobby${
			query.size > 0 ? `?${query.toString()}` : ""
		}`
		savePostLoginRedirect(returnPath)
		router.replace(`/login?redirect=${encodeURIComponent(returnPath)}` as Route)
	}, [
		hearingRoomId,
		hydrated,
		inviteToken,
		oppositionToken,
		router,
		session?.user?.id,
		sessionPending,
	])

	async function joinHearing() {
		try {
			setError(null)
			const input = {
				id: hearingRoomId,
				...(inviteToken ? { inviteToken } : {}),
				...(oppositionToken ? { oppositionToken } : {}),
			}
			let result = await lobbyCheck.mutateAsync(input)

			if (result.kind === "wrong_status" && hearingQ.data?.status === "scheduled") {
				await openHearing.mutateAsync({ id: hearingRoomId })
				result = await lobbyCheck.mutateAsync(input)
			}

			setCheckResult(result)
			if (result.kind === "session_ended") {
				router.replace(`/commission-hearings/${hearingRoomId}/notice` as Route)
				return
			}
			if (result.kind !== "ok") return
			if (!identityOk || !geoOk) return

			const join = await issueJoinToken.mutateAsync(input)
			storeCommissionHearingJoinPayload(hearingRoomId, join)
			router.push(`/commission-hearings/${hearingRoomId}/meeting` as Route)
		} catch (e) {
			setError(
				getOrpcMutationErrorMessage(
					e,
					"Could not join this hearing. Ask the ENA to confirm that the session is open."
				)
			)
		}
	}

	if (!hydrated || sessionPending) {
		return <p className="text-muted-foreground text-sm">Checking sign-in…</p>
	}

	if (!session?.user?.id) {
		return <p className="text-muted-foreground text-sm">Redirecting to sign in…</p>
	}

	if (!hasTokenAccess && hearingQ.isLoading) {
		return <p className="text-muted-foreground text-sm">Loading hearing…</p>
	}

	if (!hasTokenAccess && (hearingQ.isError || !hearingQ.data)) {
		return (
			<div className="mx-auto max-w-xl space-y-4 px-4 py-8">
				<p className="text-destructive text-sm">We could not load this commission hearing.</p>
				<Link href={"/dashboard" as Route} className={buttonVariants({ variant: "outline" })}>
					Back
				</Link>
			</div>
		)
	}

	const hearing = hearingQ.data
	const noticeHref = `/commission-hearings/${hearingRoomId}/notice` as Route
	const verificationAppointmentId =
		hearing?.verificationAppointmentId ?? okCheckResult?.verificationAppointmentId ?? null
	const scheduledAt = hearing?.scheduledAt ?? okCheckResult?.scheduledAt ?? null
	const hearingStatus = hearing?.status ?? okCheckResult?.status ?? null
	const checkMessage = lobbyCheckMessage(checkResult)
	const busy = lobbyCheck.isPending || issueJoinToken.isPending || openHearing.isPending
	const applicantPaymentPaid =
		(paymentStatusQ.data?.paid ?? hearing?.paymentStatus === "succeeded") ||
		(paymentStatusQ.data?.required === false && Boolean(paymentStatusQ.data))
	const applicantPaymentLoading =
		isApplicantParticipant && !paymentStatusQ.data && paymentStatusQ.isLoading
	const needsTokenAccessCheck = hasTokenAccess && !okCheckResult
	const joinBlockedReason = needsTokenAccessCheck
		? null
		: !verificationAppointmentId
			? "The hearing verification scope is not ready yet. Refresh the lobby and try again."
			: applicantPaymentLoading
				? "Loading hearing payment status."
				: isApplicantParticipant && !applicantPaymentPaid
					? "Pay the ₱50 hearing fee to continue."
					: !identityOk
						? "Complete the liveness check before joining this hearing."
						: !geoOk
							? "Complete the location verification before joining this hearing."
							: null
	const cta = needsTokenAccessCheck
		? busy
			? "Checking..."
			: "Check access"
		: hearing?.status === "scheduled"
			? "Open and join hearing"
			: busy
				? "Joining..."
				: "Join hearing"

	if (hearingStatus === "ended") {
		return (
			<div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
				<div>
					<h1 className="text-lg font-semibold tracking-tight">Commission hearing ended</h1>
					<p className="text-muted-foreground mt-1 text-sm">
						The summary hearing has ended. View the notice page for the application outcome.
					</p>
				</div>
				<Link href={noticeHref} className={cn(buttonVariants({ size: "sm" }))}>
					View hearing outcome
				</Link>
			</div>
		)
	}

	return (
		<div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
			<div>
				<Link
					href={"/dashboard" as Route}
					className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ms-2 mb-2")}
				>
					← Dashboard
				</Link>
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="text-lg font-semibold tracking-tight">Commission hearing lobby</h1>
					<Badge variant={hearingStatus === "in_session" ? "default" : "secondary"}>
						{(hearingStatus ?? "pending").replace("_", " ")}
					</Badge>
				</div>
				<p className="text-muted-foreground text-sm">
					Join the ENA-controlled summary hearing for this commission application.
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Hearing</CardTitle>
					<CardDescription>
						{scheduledAt
							? `Scheduled for ${new Date(scheduledAt).toLocaleString()}`
							: "No scheduled time was provided."}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					<div className="flex justify-between gap-4">
						<span className="text-muted-foreground">ENA</span>
						<span className="text-end font-medium">Electronic Notary Administrator</span>
					</div>
					<div className="flex justify-between gap-4">
						<span className="text-muted-foreground">Applicant</span>
						<span className="text-end font-medium">
							{hearing?.applicantName ?? okCheckResult?.applicantName ?? "Commission applicant"}
						</span>
					</div>
					<div className="flex justify-between gap-4">
						<span className="text-muted-foreground">Your display name</span>
						<span className="text-end font-medium">
							{checkResult?.kind === "ok" ? checkResult.displayName : session.user.name}
						</span>
					</div>
					{hearing?.instructions?.trim() ? (
						<p className="bg-muted/45 rounded-md p-3 text-sm leading-relaxed">
							{hearing.instructions.trim()}
						</p>
					) : null}
				</CardContent>
			</Card>

			{checkMessage ? <p className="text-destructive text-sm">{checkMessage}</p> : null}
			{error ? <p className="text-destructive text-sm">{error}</p> : null}

			{isApplicantParticipant ? (
				<CommissionHearingPaymentPanel hearingRoomId={hearingRoomId} />
			) : null}

			{verificationAppointmentId ? (
				<>
					<LobbyHypervergeLivenessCheck
						appointmentId={verificationAppointmentId}
						returnShell={isApplicantParticipant ? "site" : "admin"}
						returnPath={`/commission-hearings/${hearingRoomId}/lobby${
							inviteToken
								? `?invite=${encodeURIComponent(inviteToken)}`
								: oppositionToken
									? `?oppositionToken=${encodeURIComponent(oppositionToken)}`
									: ""
						}`}
						onVerifiedChange={setIdentityOk}
					/>
					<LobbyLocationBlocker
						appointmentId={verificationAppointmentId}
						role={isApplicantParticipant ? "enp" : oppositionToken ? "client" : "admin"}
						livenessVerified={identityOk}
						onVerifiedChange={setGeoOk}
					/>
				</>
			) : (
				<p className="text-muted-foreground bg-muted/40 rounded-md p-3 text-sm">
					Preparing lobby verification checks. Refresh the hearing status if this does not update.
				</p>
			)}

			{joinBlockedReason ? (
				<p className="text-muted-foreground bg-muted/40 rounded-md p-3 text-sm leading-snug">
					{joinBlockedReason}
				</p>
			) : null}

			<div className="flex flex-wrap gap-3">
				<Button
					type="button"
					disabled={busy || Boolean(joinBlockedReason)}
					onClick={() => void joinHearing()}
				>
					{cta}
				</Button>
				<Button type="button" variant="outline" onClick={() => void hearingQ.refetch()}>
					Refresh status
				</Button>
			</div>
		</div>
	)
}
