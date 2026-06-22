"use client"

import * as React from "react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"

import type { UserProfile } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button, buttonVariants } from "@/core/components/ui/button"
import { Card, CardContent } from "@/core/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/components/ui/tabs"
import { cn } from "@/core/lib/utils"
import { subscribeQlegalEvent } from "@/services/ws/ws-client"
import {
	APPOINTMENTS_PAGE_SIZE,
	selectAppointmentList,
	useAppointmentsQuery,
	useAppointmentStatusMutation,
	type Appointment,
} from "@/features/appointments/api/appointments.hooks"
import { AppointmentsListPagination } from "@/features/appointments/components/appointments-list-pagination"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import { EnpCommissionBlockedDialog } from "@/features/dashboard/components/enp-commission-blocked-dialog"
import {
	isEnpCommissionBlocked,
	type EnpCommissionGateContext,
} from "@/features/dashboard/lib/enp-commission-gate"
import { isProfileKycVerified, profileKycGateMessage } from "@/features/kyc/lib/profile-kyc-gate"
import { profilePath } from "@/features/profile/lib/profile-routes"
import { env } from "@/env"

import { SESSION_MODE_LABELS, STATUS_LABELS, type AppointmentStatus } from "../lib/labels"
import { canAccessMeetingLobby, MEETING_ENDED_BY_NOTARY_STORAGE_KEY } from "../lib/meeting-access"
import { AppointmentPaymentReceiptDisclosure } from "./appointment-payment-receipt-disclosure"
import { AppointmentRow } from "./appointment-row"
import { BookingQuoteReviewDialog } from "./booking-quote-review-dialog"
import { DeclineDialog } from "./decline-dialog"
import { SendBookingQuoteDialog } from "./send-booking-quote-dialog"

type TabKey = Appointment["status"] | "all"

const TAB_ORDER: { key: TabKey; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "pending", label: "Pending" },
	{ key: "quote_sent", label: "Quote sent" },
	{ key: "confirmed", label: "Confirmed" },
	{ key: "in_session", label: "In Session" },
	{ key: "ended", label: "Ended" },
	{ key: "declined", label: "Declined" },
	{ key: "cancelled", label: "Cancelled" },
]

const STATUS_VARIANT: Record<
	AppointmentStatus,
	"default" | "secondary" | "outline" | "destructive"
> = {
	pending: "outline",
	quote_sent: "secondary",
	confirmed: "default",
	in_session: "secondary",
	ended: "outline",
	declined: "destructive",
	cancelled: "outline",
}

/** Match `buttonVariants({ size: "sm" })` height, radius, and type — status chip beside Join meeting. */
const STATUS_BADGE_UI =
	"h-7 min-h-7 rounded-[min(var(--radius-md),12px)] px-2.5 py-0 text-[0.8rem] font-medium"

function scheduledParts(scheduledAt: string): { date: string; time: string } {
	try {
		const d = parseISO(scheduledAt)
		return { date: format(d, "yyyy-MM-dd"), time: format(d, "HH:mm") }
	} catch {
		return { date: "", time: "" }
	}
}

/** Map API appointment to row view model used by `AppointmentRow`. */
function toRowAppointment(a: Appointment) {
	const { date, time } = scheduledParts(a.scheduledAt)
	return {
		...a,
		notaryName: a.enpName,
		notaryId: a.enpId,
		scheduledDate: date,
		scheduledTime: time,
		purpose: a.description ?? a.title,
		mode: a.sessionMode === "in_person" ? ("in-person" as const) : a.sessionMode,
	}
}

export type AppointmentRowModel = ReturnType<typeof toRowAppointment>

export function AppointmentsContent() {
	const router = useRouter()
	const queryClient = useQueryClient()
	const profileQ = useAuthProfileMeQuery()
	const profile = profileQ.data as UserProfile | undefined
	const isClientView = profile?.role === "client"
	const kycVerified = isProfileKycVerified(profile?.identityStatus)
	const updateStatus = useAppointmentStatusMutation()

	const [activeTab, setActiveTab] = React.useState<TabKey>("all")
	const [page, setPage] = React.useState(1)
	const [declineTarget, setDeclineTarget] = React.useState<string | null>(null)
	const [quoteTarget, setQuoteTarget] = React.useState<Appointment | null>(null)
	const [clientQuoteTarget, setClientQuoteTarget] = React.useState<Appointment | null>(null)
	const [kycGateOpen, setKycGateOpen] = React.useState(false)
	const [commissionGateOpen, setCommissionGateOpen] = React.useState(false)
	const [commissionGateContext, setCommissionGateContext] =
		React.useState<EnpCommissionGateContext>("generic")
	const commissionBlocked = isEnpCommissionBlocked(profile)

	const listStatus = activeTab === "all" ? undefined : activeTab
	const listQuery = useAppointmentsQuery({
		page,
		limit: APPOINTMENTS_PAGE_SIZE,
		status: isClientView ? undefined : listStatus,
	})
	const listResponse = selectAppointmentList(listQuery.data)
	const appointments: Appointment[] = listResponse?.items ?? []
	const meta = listResponse?.meta

	React.useEffect(() => {
		setPage(1)
	}, [activeTab, isClientView])

	React.useEffect(() => {
		try {
			if (sessionStorage.getItem(MEETING_ENDED_BY_NOTARY_STORAGE_KEY) === "1") {
				sessionStorage.removeItem(MEETING_ENDED_BY_NOTARY_STORAGE_KEY)
				toast.info("The notary ended this meeting.")
			}
		} catch {
			/* ignore */
		}
	}, [])

	React.useEffect(() => {
		const offPending = subscribeQlegalEvent("appointments:pending", () => {
			void queryClient.invalidateQueries()
		})
		const offUpdated = subscribeQlegalEvent("appointments:updated", () => {
			void queryClient.invalidateQueries()
		})
		return () => {
			offPending()
			offUpdated()
		}
	}, [queryClient])

	const sc = listResponse?.statusCounts
	const counts: Record<TabKey, number> = sc
		? {
				pending: sc.pending,
				quote_sent: sc.quote_sent,
				confirmed: sc.confirmed,
				in_session: sc.in_session,
				ended: sc.ended,
				declined: sc.declined,
				cancelled: sc.cancelled,
				all: sc.all,
			}
		: {
				pending: 0,
				quote_sent: 0,
				confirmed: 0,
				in_session: 0,
				ended: 0,
				declined: 0,
				cancelled: 0,
				all: 0,
			}

	function openCommissionGate(context: EnpCommissionGateContext) {
		setCommissionGateContext(context)
		setCommissionGateOpen(true)
	}

	function handleConfirm(id: string) {
		if (!isClientView && commissionBlocked) {
			openCommissionGate("confirm")
			return
		}
		if (!isClientView && !kycVerified) {
			setKycGateOpen(true)
			return
		}
		updateStatus.mutate(
			{ id, status: "confirmed" },
			{
				onSuccess: () => setActiveTab("confirmed"),
			}
		)
	}

	function handleSendQuote(appointment: AppointmentRowModel) {
		if (commissionBlocked) {
			openCommissionGate("confirm")
			return
		}
		if (!kycVerified) {
			setKycGateOpen(true)
			return
		}
		setQuoteTarget(appointment)
	}

	function handleDeclineRequest(id: string) {
		if (!isClientView && !kycVerified) {
			setKycGateOpen(true)
			return
		}
		setDeclineTarget(id)
	}

	function handleJoinLobby(id: string) {
		if (commissionBlocked) {
			openCommissionGate("join")
			return
		}
		router.push(`/appointments/${id}/lobby` as Route)
	}

	function handleDeclineConfirm(reason: string) {
		if (!declineTarget) return
		updateStatus.mutate({ id: declineTarget, status: "declined", declineReason: reason })
		setDeclineTarget(null)
	}

	if (isClientView) {
		return (
			<div className="mx-auto w-full max-w-3xl space-y-3">
				{listQuery.isError && (
					<p className="text-destructive mb-2 text-sm">
						Could not load appointments. Is the API running at {env.NEXT_PUBLIC_API_BASE_URL}?
					</p>
				)}
				{listQuery.isLoading ? (
					<div className="text-muted-foreground text-sm">Loading...</div>
				) : appointments.length === 0 ? (
					<div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
						No appointments yet.
					</div>
				) : (
					<>
						{appointments.map(a => {
							const meetingStarted = a.status === "in_session" && a.canRejoin
							const meetingConfirmed = a.status === "confirmed"
							const showJoinSlot = (meetingStarted || meetingConfirmed) && kycVerified
							const showKycHint = canAccessMeetingLobby(a) && !kycVerified
							return (
								<Card key={a.id}>
									<CardContent className="space-y-3 py-4">
										<div className="flex items-center justify-between gap-3">
											<div>
												<p className="text-sm font-semibold">{a.enpName}</p>
												<p className="text-muted-foreground text-xs">
													{a.title} ·{" "}
													{a.sessionMode === "in_person"
														? SESSION_MODE_LABELS.in_person
														: SESSION_MODE_LABELS[a.sessionMode]}
												</p>
											</div>
											<div className="flex shrink-0 items-center gap-2">
												<Badge variant={STATUS_VARIANT[a.status]} className={STATUS_BADGE_UI}>
													{STATUS_LABELS[a.status]}
												</Badge>
												{showJoinSlot &&
													(meetingStarted ? (
														<Link
															href={`/appointments/${a.id}/lobby` as Route}
															className={cn(
																buttonVariants({ size: "sm", variant: "default" }),
																"inline-flex"
															)}
														>
															Join meeting
														</Link>
													) : (
														<button
															type="button"
															disabled
															aria-disabled="true"
															title="The notary hasn't started this meeting yet"
															className={cn(
																buttonVariants({ size: "sm", variant: "default" }),
																"inline-flex cursor-not-allowed opacity-50"
															)}
														>
															Join meeting
														</button>
													))}
												{showKycHint && (
													<span
														className="text-muted-foreground text-xs"
														title="Complete identity verification on your Profile first."
													>
														Verify identity on Profile to join
													</span>
												)}
											</div>
										</div>
										<p className="text-muted-foreground text-xs">
											{format(parseISO(a.scheduledAt), "MMM d, yyyy · h:mm a")}
										</p>
										{a.status === "pending" ? (
											<p className="text-muted-foreground text-xs leading-snug">
												Your notary will review your documents and send a quote. Join appears after
												you accept the quote and they start the meeting.
											</p>
										) : a.status === "quote_sent" ? (
											<div className="flex flex-wrap items-center gap-2">
												<p className="text-muted-foreground text-xs leading-snug">
													Review the proposed acts and fees, then accept or decline.
												</p>
												<Button size="sm" type="button" onClick={() => setClientQuoteTarget(a)}>
													Review quote
												</Button>
											</div>
										) : meetingConfirmed && kycVerified ? (
											<p className="text-muted-foreground text-xs leading-snug">
												Join will be enabled once the notary starts this meeting.
											</p>
										) : null}
										<AppointmentPaymentReceiptDisclosure
											appointmentId={a.id}
											appointmentTitle={a.title}
											status={a.status}
										/>
									</CardContent>
								</Card>
							)
						})}
						<AppointmentsListPagination
							page={page}
							limit={meta?.limit ?? APPOINTMENTS_PAGE_SIZE}
							total={meta?.total ?? 0}
							totalPages={meta?.totalPages ?? 0}
							onPageChange={setPage}
							disabled={listQuery.isFetching}
						/>
					</>
				)}

				<BookingQuoteReviewDialog
					appointment={clientQuoteTarget}
					open={clientQuoteTarget !== null}
					onOpenChange={open => {
						if (!open) setClientQuoteTarget(null)
					}}
				/>
			</div>
		)
	}

	return (
		<>
			{listQuery.isError && (
				<p className="text-destructive mb-2 text-sm">
					Could not load appointments. Is the API running at {env.NEXT_PUBLIC_API_BASE_URL}?
				</p>
			)}
			<Tabs
				value={activeTab}
				onValueChange={v => {
					setActiveTab(v as TabKey)
					setPage(1)
				}}
				className="w-full"
			>
				<TabsList className="h-auto w-full max-w-full flex-wrap justify-start gap-1">
					{TAB_ORDER.map(t => (
						<TabsTrigger key={t.key} value={t.key} className="shrink-0">
							{t.label}
							<Badge variant="secondary" className="ml-1.5 text-[10px]">
								{counts[t.key]}
							</Badge>
						</TabsTrigger>
					))}
				</TabsList>

				<TabsContent value={activeTab} className="w-full space-y-2.5 pt-3">
					{listQuery.isLoading ? (
						<div className="text-muted-foreground text-sm">Loading…</div>
					) : appointments.length === 0 ? (
						<div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
							No {TAB_ORDER.find(t => t.key === activeTab)?.label.toLowerCase() ?? activeTab}{" "}
							appointments.
						</div>
					) : (
						<>
							{appointments.map(a => (
								<AppointmentRow
									key={a.id}
									appointment={toRowAppointment(a)}
									onConfirm={handleConfirm}
									onSendQuote={handleSendQuote}
									onDecline={handleDeclineRequest}
									onJoinLobby={handleJoinLobby}
									kycVerified={kycVerified}
									commissionBlocked={commissionBlocked}
								/>
							))}
							<AppointmentsListPagination
								page={page}
								limit={meta?.limit ?? APPOINTMENTS_PAGE_SIZE}
								total={meta?.total ?? 0}
								totalPages={meta?.totalPages ?? 0}
								onPageChange={setPage}
								disabled={listQuery.isFetching}
							/>
						</>
					)}
				</TabsContent>
			</Tabs>

			<DeclineDialog
				open={declineTarget !== null}
				onOpenChange={open => {
					if (!open) setDeclineTarget(null)
				}}
				appointmentId={declineTarget ?? ""}
				onConfirm={handleDeclineConfirm}
			/>

			<SendBookingQuoteDialog
				appointment={quoteTarget}
				open={quoteTarget !== null}
				onOpenChange={open => {
					if (!open) setQuoteTarget(null)
				}}
				onSent={() => setActiveTab("quote_sent")}
			/>

			<BookingQuoteReviewDialog
				appointment={clientQuoteTarget}
				open={clientQuoteTarget !== null}
				onOpenChange={open => {
					if (!open) setClientQuoteTarget(null)
				}}
			/>

			<Dialog open={kycGateOpen} onOpenChange={setKycGateOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Identity verification required</DialogTitle>
						<DialogDescription>
							{profile ? profileKycGateMessage(profile.role, "respond") : ""}
						</DialogDescription>
					</DialogHeader>
					<Link
						href={
							profile
								? profilePath(profile.role, { hashKyc: true })
								: ("/profile#profile-kyc-verification" as Route)
						}
						onClick={() => setKycGateOpen(false)}
						className={cn(buttonVariants({ variant: "default" }), "self-start")}
					>
						Go to Profile verification
					</Link>
				</DialogContent>
			</Dialog>

			{profile ? (
				<EnpCommissionBlockedDialog
					open={commissionGateOpen}
					onOpenChange={setCommissionGateOpen}
					profile={profile}
					context={commissionGateContext}
				/>
			) : null}
		</>
	)
}
