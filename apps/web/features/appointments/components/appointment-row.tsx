"use client"

import type { Appointment } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent } from "@/core/components/ui/card"

import { SESSION_MODE_LABELS, STATUS_LABELS, type AppointmentStatus } from "../lib/labels"
import { canAccessMeetingLobby } from "../lib/meeting-access"
import { AppointmentPaymentReceiptDisclosure } from "./appointment-payment-receipt-disclosure"
import type { AppointmentRowModel } from "./appointments-content"

type RowMode = AppointmentRowModel["mode"]

interface AppointmentRowProps {
	appointment: AppointmentRowModel
	onConfirm: (id: string) => void
	onSendQuote: (appointment: AppointmentRowModel) => void
	onDecline: (id: string) => void
	onJoinLobby: (id: string) => void
	kycVerified: boolean
	commissionBlocked: boolean
}

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

const MODE_LABELS_ROW: Record<RowMode, string> = {
	"remote": SESSION_MODE_LABELS.remote,
	"in-person": SESSION_MODE_LABELS.in_person,
	"hybrid": SESSION_MODE_LABELS.hybrid,
}

export function AppointmentRow({
	appointment: a,
	onConfirm,
	onSendQuote,
	onDecline,
	onJoinLobby,
	kycVerified,
	commissionBlocked,
}: AppointmentRowProps) {
	const needsQuote = a.status === "pending" && a.documentsCount > 0
	return (
		<Card size="sm" className="w-full">
			<CardContent className="flex flex-col gap-2.5">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div className="min-w-0 flex-1 space-y-0.5">
						<div className="flex flex-wrap items-center gap-2">
							<span className="truncate text-sm font-medium">{a.notaryName}</span>
							<Badge variant={STATUS_VARIANT[a.status]} className="text-[10px]">
								{STATUS_LABELS[a.status]}
							</Badge>
						</div>
						<p className="text-muted-foreground text-xs">
							{a.title} · {MODE_LABELS_ROW[a.mode]} · {a.scheduledDate} at {a.scheduledTime}
						</p>
						<p className="text-muted-foreground line-clamp-1 text-xs">{a.purpose}</p>
						{a.status === "declined" && a.declineReason && (
							<p className="text-destructive text-xs italic">Reason: {a.declineReason}</p>
						)}
					</div>
					<div className="flex shrink-0 gap-2">
						{a.status === "pending" && (
							<>
								{needsQuote ? (
									<Button size="sm" onClick={() => onSendQuote(a)}>
										Send quote
									</Button>
								) : (
									<Button size="sm" onClick={() => onConfirm(a.id)}>
										Confirm
									</Button>
								)}
								<Button size="sm" variant="destructive" onClick={() => onDecline(a.id)}>
									Decline
								</Button>
							</>
						)}
						{a.status === "quote_sent" && (
							<span className="text-muted-foreground text-xs">Awaiting client response</span>
						)}
						{canAccessMeetingLobby(a as Appointment) && kycVerified && (
							<Button
								size="sm"
								type="button"
								onClick={() => onJoinLobby(a.id)}
								title={
									commissionBlocked
										? "Your notarial commission must be active to start or join this session."
										: undefined
								}
							>
								{a.status === "confirmed" ? "Start meeting" : "Join meeting"}
							</Button>
						)}
						{canAccessMeetingLobby(a as Appointment) && !kycVerified && (
							<span
								className="text-muted-foreground text-xs"
								title="Complete identity verification on your Profile first."
							>
								Verify identity on Profile to join
							</span>
						)}
					</div>
				</div>
				<AppointmentPaymentReceiptDisclosure
					appointmentId={a.id}
					appointmentTitle={a.title}
					status={a.status}
				/>
			</CardContent>
		</Card>
	)
}
