"use client"

import * as React from "react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"

import type { Appointment, JoinTokenPayload, LobbyCheckResult, UserProfile } from "@repo/contracts"

import { Button, buttonVariants } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/core/components/ui/tooltip"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { cn } from "@/core/lib/utils"
import { authClient } from "@/services/better-auth/auth-client"
import { orpc, orpcClient } from "@/services/orpc/client"
import { subscribeQlegalEvent } from "@/services/ws/ws-client"
import {
	useAppointmentQuery,
	useAppointmentStatusMutation,
	useIssueJoinTokenMutation,
} from "@/features/appointments/api/appointments.hooks"
import {
	lobbyCheckErrorMessage,
	useIssueGuestJoinTokenMutation,
} from "@/features/appointments/api/session-guest.hooks"
import { buildGuestMeetingPath } from "@/features/appointments/lib/guest-session-url"
import { savePostLoginRedirect } from "@/features/auth/lib/post-login-redirect"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import { EnpCommissionBlockedDialog } from "@/features/dashboard/components/enp-commission-blocked-dialog"
import { isEnpCommissionBlocked } from "@/features/dashboard/lib/enp-commission-gate"
import { ProfileKycRequiredCard } from "@/features/kyc/components/profile-kyc-required-card"
import { isProfileKycVerified } from "@/features/kyc/lib/profile-kyc-gate"
import { LobbyLocationBlocker } from "@/features/sessions/components/lobby-location-blocker"

import { appointmentLobbyPath, usesAdminAppointmentShell } from "../lib/appointment-lobby-routes"
import { storeJoinPayload } from "../lib/livekit-join-storage"
import { canAccessMeetingLobby } from "../lib/meeting-access"
import { GuestMeetingPrejoinChecks } from "./guest-meeting-prejoin-checks"
import { LobbyHypervergeLivenessCheck } from "./lobby-hyperverge-liveness-check"

function useIsClient() {
	return React.useSyncExternalStore(
		() => () => {},
		() => true,
		() => false
	)
}

function LobbyReadinessStep({ label, done }: { label: string; done: boolean }) {
	return (
		<div
			className={cn(
				"flex items-center gap-2.5 rounded-lg border px-3 py-2.5",
				done ? "border-emerald-500/30 bg-emerald-500/5" : "bg-background/70"
			)}
		>
			<span
				className={cn(
					"size-2 shrink-0 rounded-full",
					done ? "bg-emerald-500" : "bg-muted-foreground/35"
				)}
				aria-hidden
			/>
			<span className="text-xs font-medium">{label}</span>
		</div>
	)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap vs contract router
const api = orpc as any

export function AppointmentLobbyContent({
	appointmentId,
	guestInviteToken,
	adminShell = false,
}: {
	appointmentId: string
	guestInviteToken?: string | null
	adminShell?: boolean
}) {
	const isGuestInvite = Boolean(guestInviteToken)
	const queryClient = useQueryClient()
	const router = useRouter()
	const { data: session, isPending: sessionPending } = authClient.useSession()
	const q = useAppointmentQuery(isGuestInvite ? undefined : appointmentId)
	const profileQ = useAuthProfileMeQuery()
	const profile = profileQ.data as UserProfile | undefined
	const kycVerified = isProfileKycVerified(profile?.identityStatus)
	const startSession = useAppointmentStatusMutation()
	const issueJoin = useIssueJoinTokenMutation()
	const issueGuestJoin = useIssueGuestJoinTokenMutation()
	const [geoOk, setGeoOk] = React.useState(false)
	const [identityOk, setIdentityOk] = React.useState(false)
	const [guestPrejoinReady, setGuestPrejoinReady] = React.useState(false)
	const [meetErr, setMeetErr] = React.useState<string | null>(null)
	const [commissionGateOpen, setCommissionGateOpen] = React.useState(false)
	const commissionBlocked = isEnpCommissionBlocked(profile)
	const [lobbyCheck, setLobbyCheck] = React.useState<LobbyCheckResult | null>(null)
	const [lobbyCheckPending, setLobbyCheckPending] = React.useState(isGuestInvite)
	const [lobbyCheckErr, setLobbyCheckErr] = React.useState<string | null>(null)
	const authRedirectedRef = React.useRef(false)
	const lobbyCheckedRef = React.useRef(false)
	const isClient = useIsClient()

	const apt = q.data as Appointment | undefined
	const lobbyOk = lobbyCheck?.kind === "ok" ? lobbyCheck : null
	const lobbyReturnShell = adminShell ? "admin" : "site"

	const meetingAptEarly = apt
	// Legacy-only compatibility: dedicated ENA commission hearings now use
	// /commission-hearings/[id]/lobby. This redirect is for old appointment-backed rows.
	const isCommissionHearingEarly = meetingAptEarly?.kind === "commission_hearing"
	const currentUserIdEarly = session?.user?.id
	const isEnaHostEarly =
		isCommissionHearingEarly &&
		Boolean(
			meetingAptEarly && currentUserIdEarly && meetingAptEarly.clientId === currentUserIdEarly
		)

	React.useEffect(() => {
		if (adminShell || isGuestInvite || !profile || !meetingAptEarly) return
		if (!usesAdminAppointmentShell(profile.role) || !isEnaHostEarly) return
		router.replace(appointmentLobbyPath(appointmentId, profile.role, { adminShell: true }))
	}, [adminShell, appointmentId, isEnaHostEarly, isGuestInvite, meetingAptEarly, profile, router])

	const enterGuestMeeting = React.useCallback(async () => {
		if (!guestInviteToken) return
		try {
			setMeetErr(null)
			const join = (await issueGuestJoin.mutateAsync({
				appointmentId,
				guestInviteToken,
			})) as JoinTokenPayload
			storeJoinPayload(appointmentId, join)
			router.push(`/appointments/${appointmentId}/meeting` as Route)
		} catch (e) {
			setMeetErr(
				getOrpcMutationErrorMessage(
					e,
					"Could not open the meeting. Check identity, liveness, and location, then try again."
				)
			)
			setGuestPrejoinReady(false)
		}
	}, [appointmentId, guestInviteToken, issueGuestJoin, router])

	React.useEffect(() => {
		if (!isGuestInvite || !guestPrejoinReady) return
		void enterGuestMeeting()
	}, [enterGuestMeeting, guestPrejoinReady, isGuestInvite])

	React.useEffect(() => {
		if (isGuestInvite) return
		const off = subscribeQlegalEvent("appointments:updated", payload => {
			if (payload.appointmentId !== appointmentId) return
			void queryClient.invalidateQueries({
				queryKey: api.appointment.get.key({ input: { id: appointmentId } }),
			})
		})
		return off
	}, [isGuestInvite, appointmentId, queryClient])

	React.useEffect(() => {
		if (sessionPending || session?.user?.id) return
		if (authRedirectedRef.current) return
		authRedirectedRef.current = true
		const returnPath = isGuestInvite
			? buildGuestMeetingPath(appointmentId, guestInviteToken!)
			: (`/appointments/${appointmentId}/lobby` as const)
		savePostLoginRedirect(returnPath)
		const loginUrl = `/login?redirect=${encodeURIComponent(returnPath)}` as Route
		router.replace(loginUrl)
	}, [isGuestInvite, sessionPending, session?.user?.id, appointmentId, guestInviteToken, router])

	React.useEffect(() => {
		if (!isGuestInvite || !session?.user?.id || !guestInviteToken) return
		if (lobbyCheckedRef.current) return
		lobbyCheckedRef.current = true
		let cancelled = false
		setLobbyCheckPending(true)
		setLobbyCheckErr(null)
		void (async () => {
			try {
				const result = (await (
					orpcClient as { session: { lobbyCheck: (p: unknown) => Promise<LobbyCheckResult> } }
				).session.lobbyCheck({
					appointmentId,
					guestInviteToken,
				})) as LobbyCheckResult
				if (!cancelled) setLobbyCheck(result)
			} catch (e) {
				if (!cancelled) {
					setLobbyCheckErr(getOrpcMutationErrorMessage(e, "Could not verify your invite."))
				}
			} finally {
				if (!cancelled) setLobbyCheckPending(false)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [isGuestInvite, session?.user?.id, appointmentId, guestInviteToken])

	if (!isClient) {
		return <p className="text-muted-foreground text-sm">Loading…</p>
	}

	if (sessionPending) {
		return <p className="text-muted-foreground text-sm">Checking sign-in…</p>
	}

	if (!session?.user?.id) {
		return <p className="text-muted-foreground text-sm">Redirecting to sign in…</p>
	}

	if (isGuestInvite && lobbyCheckPending) {
		return <p className="text-muted-foreground text-sm">Verifying your invite…</p>
	}

	if (isGuestInvite && guestInviteToken && !guestPrejoinReady) {
		return (
			<GuestMeetingPrejoinChecks
				appointmentId={appointmentId}
				guestInviteToken={guestInviteToken}
				geoOk={geoOk}
				errorMessage={meetErr}
				onGeoVerifiedChange={setGeoOk}
				onAllStepsReady={setGuestPrejoinReady}
			/>
		)
	}

	if (isGuestInvite && (lobbyCheckErr || lobbyCheckErrorMessage(lobbyCheck ?? undefined))) {
		return (
			<div className="space-y-4">
				<p className="text-destructive text-sm">
					{lobbyCheckErr ?? lobbyCheckErrorMessage(lobbyCheck ?? undefined)}
				</p>
				<Link href={"/login" as Route} className={buttonVariants({ variant: "outline" })}>
					Sign in
				</Link>
			</div>
		)
	}

	if (!isGuestInvite && q.isLoading) {
		return <p className="text-muted-foreground text-sm">Loading appointment…</p>
	}
	if (!isGuestInvite && (q.isError || !apt)) {
		return (
			<div className="space-y-4">
				<p className="text-destructive text-sm">We could not load this appointment.</p>
				<Link href={"/appointments" as Route} className={buttonVariants({ variant: "outline" })}>
					Back
				</Link>
			</div>
		)
	}

	if (!isGuestInvite && apt && !canAccessMeetingLobby(apt)) {
		return (
			<div className="space-y-4">
				<p className="text-muted-foreground text-sm">
					The lobby is only available once this booking is confirmed, or while the session is in
					progress.
				</p>
				<Link href={"/appointments" as Route} className={buttonVariants({ variant: "outline" })}>
					Back
				</Link>
			</div>
		)
	}

	if (!isGuestInvite && profileQ.isLoading) {
		return <p className="text-muted-foreground text-sm">Loading your profile…</p>
	}

	if (!isGuestInvite && profile && !kycVerified) {
		return (
			<div className="mx-auto flex max-w-2xl flex-col gap-6">
				<ProfileKycRequiredCard
					profile={profile}
					context="lobby"
					backHref={
						isEnaHostEarly
							? ("/admin/commission-applications" as Route)
							: ("/appointments" as Route)
					}
					backLabel={isEnaHostEarly ? "Back to commission applications" : "Back to appointments"}
				/>
			</div>
		)
	}

	const meetingApt = apt
	// Legacy-only compatibility for pre-dedicated ENA hearing appointment rows.
	const isCommissionHearing = meetingApt?.kind === "commission_hearing"
	const title = isGuestInvite
		? (lobbyOk?.appointmentTitle ?? "Session")
		: (meetingApt?.title ?? "Session")
	const enpLabel = isGuestInvite
		? (lobbyOk?.enpName ?? "Electronic Notary Public")
		: (meetingApt?.enpName ?? "Electronic Notary Public")
	const clientLabel = isGuestInvite
		? "Invited guest (you)"
		: isCommissionHearing
			? (meetingApt?.clientName ?? "Electronic Notary Administrator")
			: (meetingApt?.clientName ?? "Client")
	const busy = startSession.isPending || issueJoin.isPending || issueGuestJoin.isPending
	const currentUserId = session?.user?.id
	const isEnpForAppointment = Boolean(
		!isGuestInvite && meetingApt && currentUserId && meetingApt.enpId === currentUserId
	)
	const isClientForAppointment = Boolean(
		!isGuestInvite && meetingApt && currentUserId && meetingApt.clientId === currentUserId
	)
	const isEnaHost = isCommissionHearing && isClientForAppointment
	const lobbyBackHref = isEnaHost
		? ("/admin/commission-applications" as Route)
		: ("/appointments" as Route)
	const lobbyBackLabel = isEnaHost ? "← Commission applications" : "← Appointments"
	const meetingNotStartedYet =
		!isGuestInvite &&
		meetingApt?.status === "confirmed" &&
		(isCommissionHearing ? isEnpForAppointment : isClientForAppointment)
	const hearingOutsideStartWindow =
		isEnaHost && meetingApt?.status === "confirmed" && meetingApt.canStart === false
	const canEnterMeeting =
		isGuestInvite ||
		(isEnaHost &&
			(meetingApt?.status === "confirmed" ||
				(meetingApt?.status === "in_session" && meetingApt.canRejoin))) ||
		(isCommissionHearing &&
			isEnpForAppointment &&
			meetingApt?.status === "in_session" &&
			meetingApt.canRejoin) ||
		(!isCommissionHearing &&
			(isEnpForAppointment ||
				(isClientForAppointment && meetingApt?.status === "in_session" && meetingApt.canRejoin)))
	const enterButtonLabel = busy
		? "Preparing meeting…"
		: isEnaHost && meetingApt?.status === "confirmed"
			? "Start hearing"
			: isEnaHost && meetingApt?.status === "in_session"
				? "Enter hearing"
				: isEnpForAppointment && meetingApt?.status === "confirmed" && !isCommissionHearing
					? "Start encrypted meeting"
					: "Enter encrypted meeting"
	const enterBlockedReason = !identityOk
		? "Complete the liveness check before entering this session."
		: !geoOk
			? "Complete the location verification before entering this session."
			: hearingOutsideStartWindow
				? "This hearing is not open yet. The Start hearing button activates shortly before the scheduled start time."
				: isGuestInvite && !guestPrejoinReady
					? "Complete the guest pre-join checks before entering this session."
					: isEnpForAppointment && commissionBlocked && !isCommissionHearing
						? "Your notarial commission must be active to start this session."
						: !canEnterMeeting && meetingNotStartedYet
							? isCommissionHearing
								? "The ENA has not started this hearing yet."
								: "The notary has not started this meeting yet."
							: !canEnterMeeting
								? "You cannot enter this session from the lobby yet."
								: null
	const enterButtonBlocked = Boolean(enterBlockedReason)

	async function enterMeeting() {
		if (!isGuestInvite && isEnpForAppointment && commissionBlocked && !isCommissionHearing) {
			setCommissionGateOpen(true)
			return
		}
		try {
			setMeetErr(null)
			if (isGuestInvite && guestInviteToken) {
				const join = (await issueGuestJoin.mutateAsync({
					appointmentId,
					guestInviteToken,
				})) as JoinTokenPayload
				storeJoinPayload(appointmentId, join)
				router.push(`/appointments/${appointmentId}/meeting` as Route)
				return
			}
			if (!meetingApt) return
			if (meetingApt.status === "confirmed") {
				const canStartSession = isCommissionHearing ? isEnaHost : isEnpForAppointment
				if (!canStartSession) {
					setMeetErr(
						isCommissionHearing
							? "The ENA has not started this hearing yet. Please wait."
							: "The notary hasn't started this meeting yet. Please wait."
					)
					return
				}
				await startSession.mutateAsync({ id: appointmentId, status: "in_session" })
				await queryClient.fetchQuery({
					...api.appointment.get.queryOptions({ input: { id: appointmentId } }),
				})
			}
			const join = (await issueJoin.mutateAsync(appointmentId)) as JoinTokenPayload
			storeJoinPayload(appointmentId, join)
			router.push(`/appointments/${appointmentId}/meeting` as Route)
		} catch (e) {
			setMeetErr(
				getOrpcMutationErrorMessage(
					e,
					"Could not open the meeting. Check API LiveKit settings, identity requirements, and try again."
				)
			)
		}
	}

	const sessionOpen = canEnterMeeting && !meetingNotStartedYet && !hearingOutsideStartWindow

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<header className="space-y-1">
				<Link
					href={isGuestInvite ? ("/login" as Route) : lobbyBackHref}
					className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ms-2 inline-flex")}
				>
					{isGuestInvite ? "← Account" : lobbyBackLabel}
				</Link>
				<h1 className="text-xl font-semibold tracking-tight">Session lobby</h1>
				<p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
					{isGuestInvite
						? "You were invited to join a live notarization. Complete the checks below, then enter the meeting."
						: isCommissionHearing
							? isEnaHost
								? "Complete liveness and location verification, then start the virtual summary hearing when it is time."
								: "Complete liveness and location verification, then join when the ENA opens the hearing."
							: "Confirm each step below before opening the encrypted meeting room."}
				</p>
			</header>

			<div className="grid auto-rows-min gap-4 md:grid-cols-2 lg:grid-cols-12">
				<Card className="h-full lg:col-span-4">
					<CardHeader>
						<CardTitle className="text-base">Title</CardTitle>
						<CardDescription>Subject of this booking.</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-base leading-snug font-semibold">{title}</p>
					</CardContent>
				</Card>

				<Card className="h-full lg:col-span-8">
					<CardHeader>
						<CardTitle className="text-base">Participants</CardTitle>
						<CardDescription>Parties joining this booking.</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-3 sm:grid-cols-2">
						<div className="bg-muted/40 rounded-lg px-3 py-2.5">
							<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
								{isGuestInvite ? "You" : isCommissionHearing ? "ENA" : "Client"}
							</p>
							<p className="mt-1 text-sm font-medium">{clientLabel}</p>
						</div>
						<div className="bg-muted/40 rounded-lg px-3 py-2.5">
							<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
								{isCommissionHearing ? "Applicant (ENP)" : "Electronic Notary Public"}
							</p>
							<p className="mt-1 text-sm font-medium">{enpLabel}</p>
						</div>
					</CardContent>
				</Card>

				{!isGuestInvite ? (
					<LobbyHypervergeLivenessCheck
						className="lg:col-span-6"
						appointmentId={appointmentId}
						guestInviteToken={guestInviteToken}
						returnShell={lobbyReturnShell}
						onVerifiedChange={setIdentityOk}
					/>
				) : null}

				{!isGuestInvite ? (
					<LobbyLocationBlocker
						className="lg:col-span-6"
						appointmentId={appointmentId}
						role={profile?.role ?? "client"}
						livenessVerified={identityOk}
						onVerifiedChange={setGeoOk}
					/>
				) : null}

				<Card className="bg-muted/20 lg:col-span-12">
					<CardHeader className="border-b">
						<CardTitle className="text-base">Ready to join</CardTitle>
						<CardDescription>
							Complete verification, then enter the encrypted{" "}
							{isCommissionHearing ? "hearing" : "meeting"} room.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4 pt-4">
						{!isGuestInvite ? (
							<div className="grid gap-2 sm:grid-cols-3">
								<LobbyReadinessStep label="Identity liveness" done={identityOk} />
								<LobbyReadinessStep label="Location verified" done={geoOk} />
								<LobbyReadinessStep
									label={isCommissionHearing ? "Hearing open" : "Session open"}
									done={sessionOpen}
								/>
							</div>
						) : null}

						{isEnaHost ? (
							<p className="text-muted-foreground bg-background/60 rounded-lg border p-3 text-sm leading-snug">
								You are hosting this virtual summary hearing. Complete the identity and location
								checks above, then start the session when the scheduled time arrives. The applicant
								will join from their lobby after completing the same checks.
							</p>
						) : null}

						{hearingOutsideStartWindow ? (
							<p className="text-muted-foreground bg-background/60 rounded-lg border p-3 text-sm leading-snug">
								This hearing opens shortly before the scheduled start time. The Start button will
								activate when the session window opens.
							</p>
						) : null}

						{meetingNotStartedYet ? (
							<p className="text-muted-foreground bg-background/60 rounded-lg border p-3 text-sm leading-snug">
								Waiting for {isCommissionHearing ? "the ENA" : enpLabel} to start this{" "}
								{isCommissionHearing ? "hearing" : "meeting"}. The Enter button will activate once
								the session is open.
							</p>
						) : null}

						{meetErr ? <p className="text-destructive text-sm">{meetErr}</p> : null}

						{isEnpForAppointment && commissionBlocked && !isCommissionHearing ? (
							<p className="text-destructive bg-destructive/5 border-destructive/30 rounded-lg border p-3 text-sm leading-snug">
								Your notarial commission is not active. Update your profile before starting this
								session.
							</p>
						) : null}

						<div className="flex flex-wrap items-center gap-3 pt-1">
							<TooltipProvider delay={100}>
								<Tooltip>
									<TooltipTrigger
										render={
											<Button
												size="lg"
												disabled={busy}
												aria-disabled={enterButtonBlocked}
												type="button"
												className={cn(
													"min-w-[12rem]",
													enterButtonBlocked &&
														!busy &&
														"hover:bg-primary cursor-not-allowed opacity-70"
												)}
												onClick={() => {
													if (enterButtonBlocked) return
													void enterMeeting()
												}}
											>
												{enterButtonLabel}
											</Button>
										}
									/>
									{enterBlockedReason ? (
										<TooltipContent className="max-w-80 text-left">
											{enterBlockedReason}
										</TooltipContent>
									) : null}
								</Tooltip>
							</TooltipProvider>
						</div>
					</CardContent>
				</Card>
			</div>

			{profile ? (
				<EnpCommissionBlockedDialog
					open={commissionGateOpen}
					onOpenChange={setCommissionGateOpen}
					profile={profile}
					context="join"
				/>
			) : null}
		</div>
	)
}
