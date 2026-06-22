"use client"

import * as React from "react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ConnectionStateToast, LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react"
import { toast } from "sonner"

import type { CommissionHearingChatMessage, CommissionHearingJoinToken } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button, buttonVariants } from "@/core/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/components/ui/tabs"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { cn } from "@/core/lib/utils"
import { joinSessionRoom, leaveSessionRoom, subscribeQlegalEvent } from "@/services/ws/ws-client"
import { MeetingVideoStage } from "@/features/appointments/components/meeting/meeting-video-stage"
import { SessionParticipantsPanel } from "@/features/appointments/components/meeting/session-participants-panel"
import {
	useCommissionHearingQuery,
	useEndHearingMutation,
	useHearingChatQuery,
} from "@/features/commission-hearing/api/commission-hearing.hooks"
import { env } from "@/env"

import { CommissionHearingChatPanel } from "./commission-hearing-chat-panel"
import { CommissionHearingControlBar } from "./commission-hearing-control-bar"
import { CommissionHearingDocumentsPanel } from "./commission-hearing-documents-panel"
import { CommissionHearingInviteDialog } from "./commission-hearing-invite-dialog"
import {
	clearCommissionHearingJoinPayload,
	readCommissionHearingJoinPayload,
} from "./commission-hearing-join-storage"
import { CommissionHearingRecordingNoticeOverlay } from "./commission-hearing-recording-notice-overlay"

function returnHref(joinPayload: CommissionHearingJoinToken | null): Route {
	return joinPayload?.participantRole === "admin"
		? ("/admin/commission-applications" as Route)
		: ("/dashboard" as Route)
}

function roleLabel(role: CommissionHearingJoinToken["participantRole"]): string {
	if (role === "admin") return "Admin host"
	if (role === "hearing_oppositor") return "Oppositor"
	return "Applicant"
}

export function CommissionHearingMeetingContent({ hearingRoomId }: { hearingRoomId: string }) {
	const router = useRouter()
	const hearingQ = useCommissionHearingQuery(hearingRoomId)
	const chatQ = useHearingChatQuery(hearingRoomId)
	const endHearing = useEndHearingMutation()
	const [payload, setPayload] = React.useState<CommissionHearingJoinToken | null>(() =>
		readCommissionHearingJoinPayload(hearingRoomId)
	)
	const [sidebarTab, setSidebarTab] = React.useState("participants")
	const [hasUnreadChat, setHasUnreadChat] = React.useState(false)
	const [error, setError] = React.useState<string | null>(null)
	const [inviteOpen, setInviteOpen] = React.useState(false)
	const endedRef = React.useRef(false)
	const lobbyHref = React.useMemo(
		() => `/commission-hearings/${hearingRoomId}/lobby` as Route,
		[hearingRoomId]
	)
	const noticeHref = React.useMemo(
		() => `/commission-hearings/${hearingRoomId}/notice` as Route,
		[hearingRoomId]
	)

	const redirectToLobby = React.useCallback(() => {
		clearCommissionHearingJoinPayload(hearingRoomId)
		router.replace(lobbyHref)
	}, [hearingRoomId, lobbyHref, router])

	const redirectToNotice = React.useCallback(() => {
		clearCommissionHearingJoinPayload(hearingRoomId)
		router.replace(noticeHref)
	}, [hearingRoomId, noticeHref, router])

	React.useEffect(() => {
		if (payload) return
		const storedPayload = readCommissionHearingJoinPayload(hearingRoomId)
		if (storedPayload) {
			setPayload(storedPayload)
			return
		}
		if (hearingQ.data?.status === "ended") {
			redirectToNotice()
			return
		}
		if (hearingQ.isPending) return
		redirectToLobby()
	}, [
		hearingQ.data?.status,
		hearingQ.isPending,
		hearingRoomId,
		payload,
		redirectToLobby,
		redirectToNotice,
	])

	React.useEffect(() => {
		if (!payload) return
		void joinSessionRoom(hearingRoomId).catch(error => {
			if (env.NODE_ENV === "development") {
				// eslint-disable-next-line no-console
				console.error("[qlegal-ws] Failed to join commission hearing room", {
					hearingRoomId,
					error,
				})
			}
			redirectToLobby()
		})
		return () => {
			leaveSessionRoom(hearingRoomId)
		}
	}, [hearingRoomId, payload, redirectToLobby])

	React.useEffect(() => {
		const offOpened = subscribeQlegalEvent("commission-hearing:opened", event => {
			if (event.hearingRoomId !== hearingRoomId) return
			void hearingQ.refetch()
		})
		const offRecording = subscribeQlegalEvent("commission-hearing:recording", event => {
			if (event.hearingRoomId !== hearingRoomId) return
			void hearingQ.refetch()
		})
		const offChat = subscribeQlegalEvent("commission-hearing:chat", message => {
			if (message.hearingRoomId !== hearingRoomId) return
			void chatQ.refetch()
			if (sidebarTab !== "chat") setHasUnreadChat(true)
		})
		const offEnded = subscribeQlegalEvent("commission-hearing:ended", event => {
			if (event.hearingRoomId !== hearingRoomId) return
			endedRef.current = true
			clearCommissionHearingJoinPayload(hearingRoomId)
			toast.info("This commission hearing has ended.")
			router.replace(noticeHref)
		})
		return () => {
			offOpened()
			offRecording()
			offChat()
			offEnded()
		}
	}, [chatQ, hearingQ, hearingRoomId, noticeHref, router, sidebarTab])

	React.useEffect(() => {
		if (sidebarTab === "chat") setHasUnreadChat(false)
	}, [sidebarTab])

	function leaveMeeting() {
		clearCommissionHearingJoinPayload(hearingRoomId)
		router.push(returnHref(payload))
	}

	async function endSession() {
		try {
			endedRef.current = true
			await endHearing.mutateAsync({ id: hearingRoomId })
			clearCommissionHearingJoinPayload(hearingRoomId)
			toast.success("Commission hearing ended.")
			router.replace(noticeHref)
		} catch (e) {
			endedRef.current = false
			toast.error(getOrpcMutationErrorMessage(e, "Could not end this hearing."))
		}
	}

	if (!payload) {
		return (
			<div className="mx-auto max-w-xl space-y-4 px-4 py-8">
				<p className="text-destructive text-sm">
					Missing hearing join credentials. Redirecting to the hearing{" "}
					{hearingQ.data?.status === "ended" ? "outcome" : "lobby"}…
				</p>
				<Link
					href={hearingQ.data?.status === "ended" ? noticeHref : lobbyHref}
					className={buttonVariants({ variant: "outline" })}
				>
					{hearingQ.data?.status === "ended" ? "View hearing outcome" : "Open hearing lobby"}
				</Link>
			</div>
		)
	}

	if (error) {
		return (
			<div className="mx-auto max-w-xl space-y-4 px-4 py-8">
				<p className="text-destructive text-sm">{error}</p>
				<Button variant="outline" onClick={() => setError(null)}>
					Try again
				</Button>
			</div>
		)
	}

	const hearing = hearingQ.data
	const canViewDocuments =
		payload.participantRole === "admin" || payload.participantRole === "applicant"
	const isRecording = Boolean(hearing?.recordingActive) || hearing?.status === "in_session"

	return (
		<div className="w-full min-w-0 overflow-x-hidden px-3 pt-4 pb-6 sm:px-4 sm:pt-5 lg:px-6 lg:pt-6">
			<div className="flex flex-col gap-4 sm:gap-5">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b pt-0.5 pb-4">
					<div className="flex min-w-0 flex-wrap items-center gap-3">
						<Link
							href={returnHref(payload)}
							className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ms-2")}
						>
							{payload.participantRole === "admin" ? "← Commission applications" : "← Dashboard"}
						</Link>
						<div className="min-w-0">
							<h1 className="truncate text-sm font-semibold">Commission hearing</h1>
							<p className="text-muted-foreground truncate text-xs">
								{hearing?.applicantName ?? "Applicant summary hearing"}
							</p>
						</div>
						<Badge variant="secondary">{roleLabel(payload.participantRole)}</Badge>
						{isRecording ? <Badge variant="destructive">Recording</Badge> : null}
						<span className="text-muted-foreground truncate text-xs" title={payload.displayName}>
							{payload.displayName}
						</span>
					</div>
					<CommissionHearingControlBar
						participantRole={payload.participantRole}
						isEnding={endHearing.isPending}
						onInviteApplicant={() => setInviteOpen(true)}
						onEndSession={() => void endSession()}
						onLeave={leaveMeeting}
					/>
				</div>

				<div className="border-border/60 bg-muted/40 text-muted-foreground rounded-md border px-3 py-2 text-xs leading-relaxed">
					<span className="text-foreground font-medium">Note:</span> This room is only for the
					commission summary hearing. There are no payment, document signing, or notarization
					controls in this workspace.
				</div>

				<div className="ring-border bg-background h-[min(85vh,calc(100vh-10rem))] min-h-[460px] min-w-0 overflow-hidden rounded-xl border shadow-md lg:min-h-[520px]">
					<LiveKitRoom
						serverUrl={payload.livekitUrl}
						token={payload.token}
						connect
						audio
						video
						onDisconnected={() => {
							if (!endedRef.current) redirectToLobby()
						}}
						onError={e => setError(getOrpcMutationErrorMessage(e, "Hearing connection error."))}
						className="flex h-full min-h-0 min-w-0 flex-col [&_.lk-connection-state]:z-50"
					>
						<ConnectionStateToast />
						<RoomAudioRenderer />
						<div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(16rem,36vh)] gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(19rem,22rem)] lg:grid-rows-1 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,23rem)]">
							<div
								data-lk-theme="default"
								className="[&_.lk-control-bar]:bg-background/95 [&_.lk-track-toggle]:border-border [&_.lk-track-toggle]:bg-background relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-black [&_.lk-control-bar]:shrink-0 [&_.lk-control-bar]:gap-1 [&_.lk-control-bar]:border-t [&_.lk-control-bar]:border-white/10 [&_.lk-control-bar]:px-2 [&_.lk-control-bar]:py-2 [&_.lk-grid-layout]:h-full [&_.lk-grid-layout]:min-h-0 [&_.lk-grid-layout]:flex-1 [&_.lk-participant-tile]:h-full [&_.lk-participant-tile]:min-h-0 [&_.lk-participant-tile_video]:h-full [&_.lk-participant-tile_video]:w-full [&_.lk-participant-tile_video]:object-cover [&_.lk-track-toggle]:rounded-md [&_.lk-video-conference]:h-full [&_.lk-video-conference-inner]:h-full"
							>
								<div className="pointer-events-none absolute inset-x-3 top-2 z-[1] flex gap-2 text-[10px] text-white/70">
									<span>Conference view</span>
								</div>
								<MeetingVideoStage />
							</div>
							<div className="bg-background border-border flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-t px-3 py-3 lg:border-t-0 lg:border-l">
								<Tabs
									value={sidebarTab}
									onValueChange={setSidebarTab}
									className="flex min-h-0 flex-1 flex-col gap-2"
								>
									<TabsList
										className={cn(
											"grid h-auto w-full shrink-0 gap-1 p-1",
											canViewDocuments ? "grid-cols-3" : "grid-cols-2"
										)}
									>
										<TabsTrigger value="participants" className="text-xs">
											Participants
										</TabsTrigger>
										{canViewDocuments ? (
											<TabsTrigger value="documents" className="text-xs">
												Documents
											</TabsTrigger>
										) : null}
										<TabsTrigger value="chat" className="text-xs">
											<span className="inline-flex items-center gap-1">
												Chat
												{hasUnreadChat ? (
													<span
														className="size-1.5 shrink-0 rounded-full bg-amber-500"
														title="New chat message"
														aria-hidden
													/>
												) : null}
											</span>
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
									{canViewDocuments ? (
										<TabsContent
											value="documents"
											keepMounted
											className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-1 pt-0.5 pb-2"
										>
											<CommissionHearingDocumentsPanel applicationId={hearing?.applicationId} />
										</TabsContent>
									) : null}
									<TabsContent
										value="chat"
										keepMounted
										className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-1 pt-0.5 pb-2"
									>
										<CommissionHearingChatPanel
											hearingRoomId={hearingRoomId}
											selfDisplayHint={payload.displayName}
											messages={(chatQ.data as CommissionHearingChatMessage[] | undefined) ?? []}
											isLoading={chatQ.isLoading}
										/>
									</TabsContent>
								</Tabs>
							</div>
						</div>
					</LiveKitRoom>
				</div>
			</div>

			{payload.participantRole === "admin" ? (
				<CommissionHearingInviteDialog
					hearingRoomId={hearingRoomId}
					applicantEmail={hearing?.applicantEmail}
					open={inviteOpen}
					onOpenChange={setInviteOpen}
				/>
			) : null}
			<CommissionHearingRecordingNoticeOverlay isRecording={isRecording} onLeave={leaveMeeting} />
		</div>
	)
}
