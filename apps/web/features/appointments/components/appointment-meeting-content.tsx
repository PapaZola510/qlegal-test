"use client"

import * as React from "react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ConnectionStateToast, LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
	notarialAttestationTextFor,
	requiresNotarialAttestation,
	type Appointment,
	type AppointmentAttachment,
	type JoinTokenPayload,
	type MeetingEnbSigningStatus,
	type MeetingPaymentStatus,
	type MeetingRecording,
	type SessionChatMessage,
} from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button, buttonVariants } from "@/core/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/components/ui/tabs"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { cn } from "@/core/lib/utils"
import { authClient } from "@/services/better-auth/auth-client"
import { orpc, orpcClient } from "@/services/orpc/client"
import { joinSessionRoom, leaveSessionRoom, subscribeQlegalEvent } from "@/services/ws/ws-client"
import {
	useAppointmentQuery,
	useAppointmentStatusMutation,
	useIssueJoinTokenMutation,
} from "@/features/appointments/api/appointments.hooks"
import { useRecordAppointmentIenAttestationMutation } from "@/features/appointments/api/ien-attestation.hooks"
import {
	useAppointmentAttachmentsQuery,
	useDeleteMeetingRecordingMutation,
	useMeetingEnbSigningStatusQuery,
	useMeetingPaymentStatusQuery,
	useMeetingRecordingsQuery,
	useSessionChatQuery,
	useSignMeetingEnbEntryMutation,
	useStartMeetingEnbSigningMutation,
} from "@/features/appointments/api/meeting.hooks"
import { useIssueGuestJoinTokenMutation } from "@/features/appointments/api/session-guest.hooks"
import { useDocumentSigning } from "@/features/appointments/api/use-document-signing"
import { buildGuestMeetingPath } from "@/features/appointments/lib/guest-session-url"
import { uploadMeetingRecordingFile } from "@/features/appointments/lib/upload-appointment-file"
import { savePostLoginRedirect } from "@/features/auth/lib/post-login-redirect"
import { env } from "@/env"

import { clearJoinPayload, readJoinPayload, storeJoinPayload } from "../lib/livekit-join-storage"
import { canAccessMeetingLobby, MEETING_ENDED_BY_NOTARY_STORAGE_KEY } from "../lib/meeting-access"
import { GuestMeetingPrejoinChecks } from "./guest-meeting-prejoin-checks"
import { EnbSigningModal } from "./meeting/dialogs/enb-signing-modal"
import { NotarialAttestationDialog } from "./meeting/dialogs/notarial-attestation-dialog"
import { MeetingLocalSigningModal } from "./meeting/document/meeting-local-signing-modal"
import { InviteGuestDialog } from "./meeting/invite-guest-dialog"
import { MeetingPaymentPanel } from "./meeting/meeting-payment-panel"
import { MeetingPaymentStatusStrip } from "./meeting/meeting-payment-status-strip"
import { MeetingRecorderButton } from "./meeting/meeting-recorder-button"
import { MeetingRecordingNoticeOverlay } from "./meeting/meeting-recording-notice-overlay"
import { MeetingRecordingStatusBanner } from "./meeting/meeting-recording-status-banner"
import { MeetingVideoStage } from "./meeting/meeting-video-stage"
import { SessionChatPanel } from "./meeting/session-chat-panel"
import { SessionDocumentsPanel } from "./meeting/session-documents-panel"
import { SessionParticipantsPanel } from "./meeting/session-participants-panel"
import { SessionRecordingsPanel } from "./meeting/session-recordings-panel"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client vs NestedClient inference gap
const api = orpc as any

export function AppointmentMeetingContent({
	appointmentId,
	guestInviteToken,
}: {
	appointmentId: string
	guestInviteToken?: string | null
}) {
	const router = useRouter()
	const queryClient = useQueryClient()
	const isGuestInvite = Boolean(guestInviteToken)
	const { data: session, isPending: sessionPending } = authClient.useSession()
	const [payload, setPayload] = React.useState<JoinTokenPayload | null>(() =>
		readJoinPayload(appointmentId)
	)
	const isGuestParticipant = isGuestInvite || payload?.participantRole === "guest_signer"
	const aptQ = useAppointmentQuery(appointmentId)
	const issueJoin = useIssueJoinTokenMutation()
	const issueGuestJoin = useIssueGuestJoinTokenMutation()
	const startSession = useAppointmentStatusMutation()
	const recordingsQ = useMeetingRecordingsQuery(
		payload?.participantRole === "enp" ? appointmentId : undefined
	)
	const deleteRecording = useDeleteMeetingRecordingMutation(appointmentId)
	const [error, setError] = React.useState<string | null>(null)
	const [guestGeoOk, setGuestGeoOk] = React.useState(false)
	const [guestPrejoinReady, setGuestPrejoinReady] = React.useState(false)
	const authRedirectedRef = React.useRef(false)
	const guestPreparedRef = React.useRef(false)
	const endedLocallyRef = React.useRef(false)
	const sessionEndedRef = React.useRef(false)
	const [inviteOpen, setInviteOpen] = React.useState(false)
	const [meetingSidebarTab, setMeetingSidebarTab] = React.useState("participants")
	const [notarizedDocumentIds, setNotarizedDocumentIds] = React.useState(() => new Set<string>())
	const autoPaymentTabAppliedRef = React.useRef(false)

	const apt = aptQ.data as Appointment | undefined
	const isEnp = payload?.participantRole === "enp"
	const isClient = payload?.participantRole === "client"
	const paymentQ = useMeetingPaymentStatusQuery(appointmentId)
	const paymentStatus = paymentQ.data as MeetingPaymentStatus | undefined
	const paymentBlocked = Boolean(paymentStatus?.required && !paymentStatus.paid)
	const enbSigningQ = useMeetingEnbSigningStatusQuery(appointmentId, {
		enabled: Boolean(payload?.sessionRoomId),
	})
	const startEnbSigning = useStartMeetingEnbSigningMutation(appointmentId)
	const signEnbEntry = useSignMeetingEnbEntryMutation(appointmentId)
	const [enbModalOpen, setEnbModalOpen] = React.useState(false)
	const [signingEnbRequestId, setSigningEnbRequestId] = React.useState<string | null>(null)
	const [enpAttestationOpen, setEnpAttestationOpen] = React.useState(false)
	const [enpAttestationAcknowledged, setEnpAttestationAcknowledged] = React.useState(false)
	const [isSubmittingEnpAttestation, setIsSubmittingEnpAttestation] = React.useState(false)
	const recordEnpAttestation = useRecordAppointmentIenAttestationMutation()
	const attachmentsQ = useAppointmentAttachmentsQuery(appointmentId)
	const enbSigningData = enbSigningQ.data as MeetingEnbSigningStatus | undefined
	const enbSigningStatus = enbSigningData?.status ?? apt?.enbSigningStatus ?? "not_started"
	const enbSigningComplete = enbSigningStatus === "completed"
	const enbSigningBlocked = !enbSigningComplete
	const myEnbPending = enbSigningData?.myPending ?? []
	const recordings = (recordingsQ.data as MeetingRecording[] | undefined) ?? []
	const documentSigning = useDocumentSigning(appointmentId, isEnp)
	const reSign = useMutation({
		mutationFn: async (input: { meetingId: string; documentId: string }) =>
			(orpcClient as any).session.reSignNotarizedDocument(input) as Promise<{ ok: boolean }>,
		onSuccess: () => {
			setNotarizedDocumentIds(new Set())
			toast.success("Document reset. You can re-initiate signing.")
		},
		onError: (e: unknown) => toast.error(getOrpcMutationErrorMessage(e, "Could not reset document.")),
	})

	// DEV: seed notarized state from existing attachments so "Restart notarization" shows
	// for documents sealed before this code loaded. Remove when dev testing is complete.
	React.useEffect(() => {
		const attachments = attachmentsQ.data as AppointmentAttachment[] | undefined
		if (attachments) {
			const existing = new Set<string>()
			for (const a of attachments) {
				if (a.quicksignProjectId) existing.add(a.fileObjectId)
			}
			if (existing.size > 0) {
				setNotarizedDocumentIds(existing)
			}
		}
	}, [attachmentsQ.data])

	function handleDeleteRecording(fileObjectId: string) {
		void deleteRecording.mutateAsync({ fileObjectId }).then(
			() => toast.success("Recording deleted."),
			e => toast.error(getOrpcMutationErrorMessage(e, "Could not delete recording."))
		)
	}

	React.useEffect(() => {
		if (!payload?.sessionRoomId) return undefined
		const roomId = payload.sessionRoomId
		void joinSessionRoom(roomId).catch(error => {
			if (env.NODE_ENV === "development") {
				// eslint-disable-next-line no-console
				console.error("[qlegal-ws] Failed to join session room", { roomId, error })
				toast.warning("Could not join the realtime session room. Check the browser console.")
			}
		})
		return () => {
			leaveSessionRoom(roomId)
		}
	}, [payload?.sessionRoomId])

	const chatQ = useSessionChatQuery(payload?.sessionRoomId)

	React.useEffect(() => {
		if (!payload?.sessionRoomId) return undefined
		const roomId = payload.sessionRoomId
		const off = subscribeQlegalEvent("session:chat", event => {
			if (event.sessionRoomId !== roomId) return
			void chatQ.refetch()
		})
		return () => off()
	}, [payload?.sessionRoomId, chatQ.refetch])

	React.useEffect(() => {
		if (!payload?.sessionRoomId) return undefined
		const off = subscribeQlegalEvent("session:enb-signing", event => {
			if (event.appointmentId !== appointmentId) return
			void enbSigningQ.refetch()
			void aptQ.refetch()
			if (event.status === "active") {
				setEnbModalOpen(true)
			}
			if (event.status === "completed" && isEnp) {
				toast.success("All principals signed the ENB. You may end the session.")
			}
		})
		return () => off()
	}, [appointmentId, aptQ, enbSigningQ, isEnp, payload?.sessionRoomId])

	React.useEffect(() => {
		if (!payload?.sessionRoomId) return undefined
		const off = subscribeQlegalEvent("session:document-plotted", event => {
			if (event.appointmentId !== appointmentId) return
			void queryClient.invalidateQueries({
				queryKey: api.session.listMeetingDocumentSigners.key({}),
			})
			void queryClient.invalidateQueries({
				queryKey: api.appointment.listAttachments.key({ input: { id: appointmentId } }),
			})
		})
		return () => off()
	}, [appointmentId, payload?.sessionRoomId, queryClient])

	React.useEffect(() => {
		if (!payload?.sessionRoomId) return undefined
		const off = subscribeQlegalEvent("session:document-notarized", payload => {
			setNotarizedDocumentIds(prev => {
				const next = new Set(prev)
				next.add(payload.documentId)
				return next
			})
			void queryClient.invalidateQueries({
				queryKey: api.session.listMeetingDocumentSigners.key({}),
			})
			void queryClient.invalidateQueries({
				queryKey: api.appointment.listAttachments.key({ input: { id: appointmentId } }),
			})
			toast.success("Document fully notarized and ready for download.")
		})
		return () => off()
	}, [appointmentId, payload?.sessionRoomId, queryClient])

	const enbSignedCount = enbSigningData?.signedCount ?? 0
	const enbTotalRequests = enbSigningData?.totalRequests ?? 0
	const attestationRequired = apt
		? requiresNotarialAttestation({ kind: apt.kind, sessionMode: apt.sessionMode })
		: false
	const enpAttestationText = React.useMemo(() => {
		if (!apt) return ""
		return (
			notarialAttestationTextFor({
				notarizationType: apt.notarizationType,
				sessionMode: apt.sessionMode,
				role: "enp",
			}) ?? ""
		)
	}, [apt])

	React.useEffect(() => {
		const off = subscribeQlegalEvent("appointments:updated", p => {
			if (p.appointmentId !== appointmentId || p.status !== "ended") return
			if (endedLocallyRef.current) {
				endedLocallyRef.current = false
				return
			}
			sessionEndedRef.current = true
			try {
				sessionStorage.setItem(MEETING_ENDED_BY_NOTARY_STORAGE_KEY, "1")
			} catch {
				/* ignore quota / private mode */
			}
			clearJoinPayload(appointmentId)
			router.replace((isGuestParticipant ? "/dashboard" : "/appointments") as Route)
		})
		return () => off()
	}, [appointmentId, isGuestParticipant, router])

	React.useEffect(() => {
		const offPayment = subscribeQlegalEvent("appointments:payment-updated", p => {
			if (p.appointmentId !== appointmentId) return
			void paymentQ.refetch()
			if (p.status === "succeeded" && payload?.participantRole === "enp") {
				toast.success("Client payment received. You can end the session when ready.")
			}
			if (p.status === "succeeded" && isGuestParticipant) {
				toast.success("Session payment received. Notarized documents are now available.")
			}
		})
		return () => offPayment()
	}, [appointmentId, paymentQ, payload?.participantRole, isGuestParticipant])

	React.useEffect(() => {
		if (!isGuestInvite || sessionPending || session?.user?.id) return
		if (authRedirectedRef.current) return
		authRedirectedRef.current = true
		const returnPath = buildGuestMeetingPath(appointmentId, guestInviteToken!)
		savePostLoginRedirect(returnPath)
		router.replace(`/login?redirect=${encodeURIComponent(returnPath)}` as Route)
	}, [appointmentId, guestInviteToken, isGuestInvite, router, session?.user?.id, sessionPending])

	const preparedRef = React.useRef(false)
	React.useEffect(() => {
		preparedRef.current = false
		guestPreparedRef.current = false
		autoPaymentTabAppliedRef.current = false
		setMeetingSidebarTab("participants")
	}, [appointmentId])

	React.useEffect(() => {
		if (autoPaymentTabAppliedRef.current || !isClient || paymentQ.isPending) return
		autoPaymentTabAppliedRef.current = true
		if (paymentBlocked) {
			setMeetingSidebarTab("payment")
		}
	}, [isClient, paymentBlocked, paymentQ.isPending])

	async function prepareGuestJoin() {
		if (!guestInviteToken) return
		setError(null)
		const join = (await issueGuestJoin.mutateAsync({
			appointmentId,
			guestInviteToken,
		})) as JoinTokenPayload
		storeJoinPayload(appointmentId, join)
		setPayload(join)
	}

	React.useEffect(() => {
		let cancelled = false

		const cached = readJoinPayload(appointmentId)
		if (cached) {
			setPayload(cached)
			return undefined
		}

		if (isGuestInvite) {
			if (sessionPending || !session?.user?.id) return undefined
			if (!guestPrejoinReady) return undefined
			if (guestPreparedRef.current) return undefined
			guestPreparedRef.current = true
			;(async () => {
				try {
					await prepareGuestJoin()
				} catch (e) {
					guestPreparedRef.current = false
					if (cancelled) return
					setError(
						getOrpcMutationErrorMessage(
							e,
							"Could not join this meeting. Ask the notary to confirm the session is live."
						)
					)
				}
			})()
			return () => {
				cancelled = true
			}
		}

		if (!apt || !canAccessMeetingLobby(apt)) return undefined

		if (preparedRef.current) return undefined
		preparedRef.current = true
		;(async () => {
			try {
				setError(null)
				if (apt.status === "confirmed") {
					await startSession.mutateAsync({ id: appointmentId, status: "in_session" })
				}
				const join = (await issueJoin.mutateAsync(appointmentId)) as JoinTokenPayload
				if (cancelled) return
				storeJoinPayload(appointmentId, join)
				setPayload(join)
			} catch (e) {
				preparedRef.current = false
				if (!cancelled) {
					setError(
						getOrpcMutationErrorMessage(
							e,
							"Could not prepare the meeting connection. Confirm LiveKit env on the API and identity checks, or open the session lobby first."
						)
					)
				}
			}
		})()

		return () => {
			cancelled = true
		}
		// We intentionally key off appointment identity/status only.
		// Mutation objects can be unstable between renders and trigger update loops.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		appointmentId,
		apt?.id,
		apt?.status,
		guestInviteToken,
		guestPrejoinReady,
		isGuestInvite,
		session?.user?.id,
		sessionPending,
	])

	React.useEffect(() => {
		if (!isGuestInvite || !guestPrejoinReady || !session?.user?.id) return
		if (readJoinPayload(appointmentId)) return
		guestPreparedRef.current = false
	}, [appointmentId, guestPrejoinReady, isGuestInvite, session?.user?.id])

	function onLeave() {
		if (!isGuestParticipant && paymentBlocked && isClient) {
			toast.error("Complete QRPH payment in the Payment tab before leaving the meeting.")
			return
		}
		if (!isGuestParticipant && paymentBlocked && isEnp) {
			toast.error("The client must complete QRPH payment before you can leave the meeting.")
			return
		}
		clearJoinPayload(appointmentId)
		router.push((isGuestParticipant ? "/dashboard" : "/appointments") as Route)
	}

	function onDisconnected() {
		if (sessionEndedRef.current) return
		onLeave()
	}

	async function runStartEnbSigning() {
		const wasAlreadyActive = enbSigningStatus === "active"
		const result = await startEnbSigning.mutateAsync()
		if (result.status === "completed") {
			toast.success("ENB signing complete. You may end the session.")
		} else if (wasAlreadyActive) {
			toast.info("Signing prompts sent again to participants who have not signed yet.")
			if (myEnbPending.length > 0) setEnbModalOpen(true)
		} else {
			toast.success("Notarization complete. Principals will be prompted to sign the notarial book.")
		}
	}

	async function onCompleteNotarization() {
		if (attestationRequired && enbSigningStatus === "not_started") {
			setEnpAttestationAcknowledged(false)
			setEnpAttestationOpen(true)
			return
		}

		try {
			await runStartEnbSigning()
		} catch (e) {
			toast.error(
				getOrpcMutationErrorMessage(
					e,
					"Could not start ENB signing. Ensure every document is fully notarized."
				)
			)
		}
	}

	async function onConfirmEnpAttestation() {
		if (!enpAttestationAcknowledged) return

		const documentIds = ((attachmentsQ.data as AppointmentAttachment[] | undefined) ?? [])
			.filter(a => a.quicksignProjectId)
			.map(a => a.fileObjectId)
		if (!documentIds.length) {
			toast.error("No notarized documents found for this session.")
			return
		}

		setIsSubmittingEnpAttestation(true)
		try {
			for (const documentFileId of documentIds) {
				await recordEnpAttestation.mutateAsync({
					id: appointmentId,
					documentFileId,
					role: "enp",
					acknowledged: true,
				})
			}
			setEnpAttestationOpen(false)
			setEnpAttestationAcknowledged(false)
			await runStartEnbSigning()
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not record your acknowledgment."))
		} finally {
			setIsSubmittingEnpAttestation(false)
		}
	}

	async function onSignEnbEntry(
		requestId: string,
		acknowledgment: string,
		signatureImageData: string
	) {
		setSigningEnbRequestId(requestId)
		try {
			const result = await signEnbEntry.mutateAsync({
				requestId,
				signatureAcknowledgment: acknowledgment,
				signatureImageData,
			})
			if (result.status.pendingCount === 0) {
				setEnbModalOpen(false)
				toast.success("Thank you — your ENB entries are signed.")
			} else {
				toast.success("Entry signed. Please sign the remaining entries.")
			}
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not sign the ENB entry."))
		} finally {
			setSigningEnbRequestId(null)
		}
	}

	async function onEndSessionForEnp() {
		if (paymentBlocked) {
			toast.error("The client must complete QRPH payment before you can end the session.")
			return
		}
		if (enbSigningBlocked) {
			toast.error(
				enbSigningStatus === "active"
					? "All principals must sign the ENB before you can end the session."
					: "Use Complete notarization to open ENB signing before ending the session."
			)
			return
		}
		endedLocallyRef.current = true
		sessionEndedRef.current = true
		try {
			await startSession.mutateAsync({ id: appointmentId, status: "ended" })
			toast.success(
				"Meeting ended. Fully signed instruments are added to your notarial registry in signing order, with notarized PDFs when available."
			)
			clearJoinPayload(appointmentId)
			router.replace("/appointments" as Route)
		} catch (e) {
			endedLocallyRef.current = false
			sessionEndedRef.current = false
			toast.error(getOrpcMutationErrorMessage(e, "Could not end the meeting."))
		}
	}

	if (isGuestInvite && sessionPending) {
		return <p className="text-muted-foreground text-sm">Checking sign-in…</p>
	}

	if (isGuestInvite && !session?.user?.id) {
		return <p className="text-muted-foreground text-sm">Redirecting to sign in…</p>
	}

	if (isGuestInvite && guestInviteToken && !guestPrejoinReady) {
		return (
			<GuestMeetingPrejoinChecks
				appointmentId={appointmentId}
				guestInviteToken={guestInviteToken}
				geoOk={guestGeoOk}
				errorMessage={error}
				onGeoVerifiedChange={setGuestGeoOk}
				onAllStepsReady={setGuestPrejoinReady}
			/>
		)
	}

	if (!isGuestParticipant && aptQ.isLoading) {
		return <p className="text-muted-foreground text-sm">Loading meeting…</p>
	}
	if (!isGuestParticipant && (aptQ.isError || !apt)) {
		return (
			<div className="space-y-4">
				<p className="text-destructive text-sm">We could not load this appointment.</p>
				<Link href={"/appointments" as Route} className={buttonVariants({ variant: "outline" })}>
					Back
				</Link>
			</div>
		)
	}
	if (!isGuestParticipant && apt && !canAccessMeetingLobby(apt)) {
		return (
			<div className="space-y-4">
				<p className="text-muted-foreground text-sm">
					This meeting link is not active for the current time window.
				</p>
				<Link href={"/appointments" as Route} className={buttonVariants({ variant: "outline" })}>
					Back
				</Link>
			</div>
		)
	}
	if (
		(!payload?.token || !payload.livekitUrl?.trim()) &&
		(issueJoin.isPending || issueGuestJoin.isPending || startSession.isPending)
	) {
		return (
			<p className="text-muted-foreground px-4 py-8 text-sm">
				{isGuestInvite ? "Joining meeting…" : "Connecting…"}
			</p>
		)
	}
	if (error || !payload?.token || !payload.livekitUrl?.trim()) {
		return (
			<div className="mx-auto max-w-xl space-y-4 px-4 py-8">
				<p className="text-destructive text-sm">
					{error ??
						(isGuestInvite
							? "Could not join the meeting. Ask the notary for a new invite link."
							: "Missing join credentials. Open the session lobby first.")}
				</p>
				{!isGuestInvite ? (
					<>
						<p className="text-muted-foreground text-xs">
							Tips: set <span className="font-mono">LIVEKIT_URL</span>,{" "}
							<span className="font-mono">LIVEKIT_API_KEY</span>, and{" "}
							<span className="font-mono">LIVEKIT_API_SECRET</span> on the backend. For local dev
							without Hyperverge / ENP IDV gates, try{" "}
							<span className="font-mono">SESSION_DEV_RELAX_IDENTITY=true</span> (development only).
						</p>
						<Link
							href={`/appointments/${appointmentId}/lobby` as Route}
							className={buttonVariants({ variant: "outline" })}
						>
							Open session lobby
						</Link>
					</>
				) : (
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							guestPreparedRef.current = false
							setGuestPrejoinReady(false)
							setGuestGeoOk(false)
							setError(null)
							void prepareGuestJoin().catch(e => {
								setError(getOrpcMutationErrorMessage(e, "Could not join the meeting."))
							})
						}}
					>
						Try again
					</Button>
				)}
			</div>
		)
	}

	const roleLabel =
		payload.participantRole === "enp"
			? "ENP"
			: payload.participantRole === "guest_signer"
				? "Guest"
				: "Principal"

	return (
		<div className="mx-[calc(50%-50vw)] w-screen max-w-[100vw] min-w-0 shrink-0 overflow-x-hidden px-4 pt-4 pb-6 sm:px-6 sm:pt-5 lg:px-8 lg:pt-6">
			<div className="flex flex-col gap-4 sm:gap-5">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b pt-0.5 pb-4">
					<div className="flex min-w-0 flex-wrap items-center gap-3">
						<Link
							href={(isGuestParticipant ? "/dashboard" : "/appointments") as Route}
							className={cn(
								buttonVariants({ variant: "ghost", size: "sm" }),
								"-ms-2 inline-flex shrink-0"
							)}
							title={isGuestParticipant ? "Return to dashboard" : "Return to appointments list"}
						>
							{isGuestParticipant ? "← Dashboard" : "← Appointments"}
						</Link>
						<div className="min-w-0">
							<h1 className="truncate text-sm font-semibold">Live session</h1>
							<p className="text-muted-foreground truncate text-xs">
								{apt?.title ?? "Live session"}
							</p>
						</div>
						<Badge variant="secondary">{roleLabel}</Badge>
						{payload.sessionRoomId ? (
							<MeetingRecordingStatusBanner
								sessionRoomId={payload.sessionRoomId}
								selfUserId={session?.user?.id ?? null}
							/>
						) : null}
						<span className="text-muted-foreground truncate text-xs" title={payload.displayName}>
							{payload.displayName}
						</span>
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						{isEnp && notarizedDocumentIds.size > 0 ? (
							<Button
								variant="outline"
								size="sm"
								disabled={reSign.isPending}
								onClick={() => {
									const docId = notarizedDocumentIds.values().next().value
									if (docId) {
										void reSign.mutateAsync({
											meetingId: appointmentId,
											documentId: docId,
										})
									}
								}}
								title="Reset sealed document to re-generate the certification page"
							>
								Restart notarization
							</Button>
						) : null}
						{isEnp ? (
							<Button
								variant="secondary"
								size="sm"
								onClick={() => setInviteOpen(true)}
								title="Invite a principal or witness by email or link"
							>
								Invite guest
							</Button>
						) : null}
						{isEnp || isClient || isGuestParticipant ? (
							<MeetingRecorderButton
								appointmentId={appointmentId}
								sessionRoomId={payload.sessionRoomId}
								filenameSuffix={apt?.title ? apt.title.slice(0, 32) : undefined}
								onRecordingSaved={({ filename, blob }) => {
									void (async () => {
										try {
											const file = new File([blob], filename, {
												type: blob.type || "video/webm",
											})
											await uploadMeetingRecordingFile({
												file,
												appointmentId,
												fileName: filename,
											})
											await queryClient.invalidateQueries({
												queryKey: api.appointment.listMeetingRecordings.key({
													input: { id: appointmentId },
												}),
											})
											toast.success("Recording uploaded to storage.")
										} catch (e) {
											toast.error(
												getOrpcMutationErrorMessage(
													e,
													"Recording saved locally, but upload to storage failed."
												)
											)
										}
									})()
								}}
							/>
						) : null}
						{myEnbPending.length > 0 && enbSigningStatus === "active" ? (
							<Button
								variant="default"
								size="sm"
								onClick={() => setEnbModalOpen(true)}
								title="Open the notarial book signing pad"
							>
								Sign notarial book
								{myEnbPending.length > 1 ? ` (${myEnbPending.length})` : ""}
							</Button>
						) : null}
						{isEnp && !enbSigningComplete ? (
							<Button
								variant="default"
								size="sm"
								disabled={startEnbSigning.isPending}
								onClick={() => void onCompleteNotarization()}
								title={
									enbSigningStatus === "active"
										? "Re-send signing prompts to participants who have not signed"
										: "Create registry entries and prompt principals to sign the notarial book"
								}
							>
								{startEnbSigning.isPending
									? "Starting…"
									: enbSigningStatus === "active"
										? `ENB signing (${enbSignedCount}/${enbTotalRequests})`
										: "Complete notarization"}
							</Button>
						) : null}
						{isEnp ? (
							<Button
								variant="destructive"
								size="sm"
								disabled={startSession.isPending || paymentBlocked || enbSigningBlocked}
								onClick={() => void onEndSessionForEnp()}
								title={
									paymentBlocked
										? "Client must complete QRPH payment before ending the session"
										: enbSigningBlocked
											? "Complete ENB principal signing before ending the session"
											: "End the meeting for everyone and register completed acts"
								}
							>
								End session
							</Button>
						) : null}
						<Button
							variant="outline"
							size="sm"
							onClick={onLeave}
							title={
								!isGuestParticipant && paymentBlocked && (isClient || isEnp)
									? "Complete QRPH payment before leaving"
									: "Leave and clear join credentials"
							}
						>
							Leave meeting
						</Button>
					</div>
				</div>

				{/* <p className="text-muted-foreground text-xs">
					Camera/mic/screen and in-room controls use the LiveKit bar (tooltips appear on hover).
					Session chat below is persisted on the server.
					{isEnp ? (
						<>
							{" "}
							As the notary, use <span className="text-foreground font-medium">
								Record meeting
							</span>{" "}
							above to capture the session — the video file saves to your device for your notarial
							record.
						</>
					) : null}
				</p> */}

				{isEnp && paymentStatus?.required && paymentStatus.totalFeePhp > 0 ? (
					<MeetingPaymentStatusStrip paymentStatus={paymentStatus} role="enp" />
				) : null}

				<div className="border-border/60 bg-muted/40 text-muted-foreground rounded-md border px-3 py-2 text-xs leading-relaxed">
					<span className="text-foreground font-medium">Note:</span> A stable internet speed of at
					least <span className="text-foreground font-medium">2 Mbps</span> and{" "}
					<span className="text-foreground font-medium">HD (1280×720) video</span> is recommended
					for a smooth session and video recording.
				</div>

				<div className="ring-border bg-background h-[min(85vh,calc(100vh-10rem))] min-h-[380px] min-w-0 overflow-hidden rounded-xl border shadow-md lg:min-h-[420px]">
					<LiveKitRoom
						serverUrl={payload.livekitUrl}
						token={payload.token}
						connect
						audio
						video
						onDisconnected={onDisconnected}
						onError={e => setError(getOrpcMutationErrorMessage(e, "Meeting connection error."))}
						className="flex h-full min-h-0 min-w-0 flex-col [&_.lk-connection-state]:z-50"
					>
						<ConnectionStateToast />
						<RoomAudioRenderer />
						<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-x-hidden lg:flex-row">
							<div
								data-lk-theme="default"
								className="[&_.lk-control-bar]:bg-background/95 [&_.lk-track-toggle]:border-border [&_.lk-track-toggle]:bg-background relative flex min-h-[320px] min-w-0 flex-1 flex-col overflow-hidden bg-black lg:min-h-0 [&_.lk-chat-toggle]:rounded-md [&_.lk-chat-toggle]:text-xs [&_.lk-control-bar]:shrink-0 [&_.lk-control-bar]:gap-1 [&_.lk-control-bar]:border-t [&_.lk-control-bar]:border-white/10 [&_.lk-control-bar]:px-2 [&_.lk-control-bar]:py-2 [&_.lk-grid-layout]:h-full [&_.lk-grid-layout]:min-h-0 [&_.lk-grid-layout]:flex-1 [&_.lk-participant-tile]:h-full [&_.lk-participant-tile]:min-h-0 [&_.lk-participant-tile_video]:h-full [&_.lk-participant-tile_video]:w-full [&_.lk-participant-tile_video]:object-cover [&_.lk-track-toggle]:rounded-md [&_.lk-video-conference]:h-full [&_.lk-video-conference-inner]:h-full"
							>
								<div className="pointer-events-none absolute inset-x-3 top-2 z-[1] flex gap-2 text-[10px] text-white/70">
									<span title="Camera and screen share in a single grid">Conference view</span>
								</div>
								<MeetingVideoStage />
							</div>
							<div className="bg-background border-border flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden border-t px-3 py-3 lg:w-[22rem] lg:border-t-0 lg:border-l xl:w-[23rem]">
								<Tabs
									value={meetingSidebarTab}
									onValueChange={setMeetingSidebarTab}
									className="flex min-h-0 flex-1 flex-col gap-2"
								>
									<TabsList
										className={cn(
											"grid h-auto w-full shrink-0 gap-1 p-1",
											isGuestParticipant ? "grid-cols-4" : isClient ? "grid-cols-5" : "grid-cols-4"
										)}
									>
										<TabsTrigger value="participants" className="text-xs">
											Participants
										</TabsTrigger>
										<TabsTrigger value="chat" className="text-xs">
											Chat
										</TabsTrigger>
										<TabsTrigger value="docs" className="text-xs">
											<span className="inline-flex items-center gap-1">
												Docs
												{isEnp && paymentStatus?.required && paymentStatus.totalFeePhp > 0 ? (
													<span
														className={cn(
															"size-1.5 shrink-0 rounded-full",
															paymentStatus.paid ? "bg-emerald-500" : "bg-amber-500"
														)}
														title={
															paymentStatus.paid
																? "Client payment received"
																: "Awaiting client payment"
														}
														aria-hidden
													/>
												) : null}
											</span>
										</TabsTrigger>
										{isClient ? (
											<TabsTrigger value="payment" className="text-xs">
												Payment
											</TabsTrigger>
										) : null}
										<TabsTrigger value="recordings" className="text-xs">
											Recordings
										</TabsTrigger>
									</TabsList>
									<TabsContent
										value="participants"
										className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-1 pt-0.5 pb-2"
									>
										<div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
											<SessionParticipantsPanel selfDisplayName={payload.displayName} />
										</div>
									</TabsContent>
									<TabsContent
										value="chat"
										keepMounted
										className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-1 pt-0.5 pb-2"
									>
										<SessionChatPanel
											sessionRoomId={payload.sessionRoomId}
											selfDisplayHint={payload.displayName}
											messages={(chatQ.data as SessionChatMessage[] | undefined) ?? []}
											isLoading={chatQ.isLoading}
										/>
									</TabsContent>
									<TabsContent
										value="docs"
										className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 pt-0.5 pb-2"
									>
										<SessionDocumentsPanel
											appointmentId={appointmentId}
											isEnp={isEnp}
											isClient={isClient}
											isGuestParticipant={isGuestParticipant}
											paymentStatus={paymentStatus}
											documentSigning={documentSigning}
										/>
									</TabsContent>
									{isClient ? (
										<TabsContent
											value="payment"
											className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-1 pt-0.5 pb-2"
										>
											<div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
												<MeetingPaymentPanel
													appointmentId={appointmentId}
													isClient={isClient}
													isEnp={isEnp}
												/>
											</div>
										</TabsContent>
									) : null}
									<TabsContent
										value="recordings"
										className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-1 pt-0.5 pb-2"
									>
										<div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
											<SessionRecordingsPanel
												recordings={recordings}
												getRecordingHref={fileObjectId =>
													`${env.NEXT_PUBLIC_API_BASE_URL.replace(
														/\/$/,
														""
													)}/v1/files/${encodeURIComponent(fileObjectId)}`
												}
												onDeleteRecording={isEnp ? handleDeleteRecording : undefined}
												isDeletingRecording={fileObjectId =>
													deleteRecording.isPending &&
													deleteRecording.variables?.fileObjectId === fileObjectId
												}
											/>
										</div>
									</TabsContent>
								</Tabs>
							</div>
						</div>
					</LiveKitRoom>
				</div>
			</div>

			<MeetingLocalSigningModal
				open={Boolean(documentSigning.signingDocumentId)}
				onOpenChange={open => {
					if (!open) {
						documentSigning.setSigningDocumentId(null)
					}
				}}
				meetingId={appointmentId}
				documentId={documentSigning.signingDocumentId}
				onStamped={() => {
					if (documentSigning.signingDocumentId) {
						void documentSigning.handleLocalSignSuccess(documentSigning.signingDocumentId)
					}
				}}
			/>

			<NotarialAttestationDialog
				open={enpAttestationOpen}
				onOpenChange={open => {
					if (!open && !isSubmittingEnpAttestation) {
						setEnpAttestationOpen(false)
						setEnpAttestationAcknowledged(false)
					}
				}}
				role="enp"
				attestationText={enpAttestationText}
				documentName={null}
				acknowledged={enpAttestationAcknowledged}
				onAcknowledgedChange={setEnpAttestationAcknowledged}
				isSubmitting={isSubmittingEnpAttestation}
				confirmLabel="Complete notarization"
				description="Before completing notarization and opening ENB signing, read and confirm the legal statement below."
				onConfirm={() => void onConfirmEnpAttestation()}
			/>

			<EnbSigningModal
				open={enbModalOpen && myEnbPending.length > 0}
				onOpenChange={setEnbModalOpen}
				pending={myEnbPending}
				signingRequestId={signingEnbRequestId}
				attestationRequired={attestationRequired}
				notarizationType={apt?.notarizationType ?? "acknowledgment"}
				sessionMode={apt?.sessionMode ?? "remote"}
				onSign={(requestId, acknowledgment, signatureImageData) =>
					void onSignEnbEntry(requestId, acknowledgment, signatureImageData)
				}
			/>

			{isEnp ? (
				<InviteGuestDialog
					appointmentId={appointmentId}
					open={inviteOpen}
					onOpenChange={setInviteOpen}
				/>
			) : null}

			<MeetingRecordingNoticeOverlay
				sessionRoomId={payload.sessionRoomId}
				isEnp={isEnp}
				selfUserId={session?.user?.id ?? null}
				onLeave={onLeave}
			/>
		</div>
	)
}
