"use client"

import * as React from "react"
import { toast } from "sonner"

import type { Appointment, AppointmentAttachment } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { Label } from "@/core/components/ui/label"
import { Textarea } from "@/core/components/ui/textarea"
import {
	useAcceptBookingQuoteMutation,
	useDeclineBookingQuoteMutation,
} from "@/features/appointments/api/appointments.hooks"
import { useAppointmentAttachmentsQuery } from "@/features/appointments/api/meeting.hooks"
import { NOTARIZATION_TYPE_LABELS } from "@/features/appointments/lib/labels"

interface BookingQuoteReviewDialogProps {
	appointment: Appointment | null
	open: boolean
	onOpenChange: (open: boolean) => void
	onResponded?: () => void
}

export function BookingQuoteReviewDialog({
	appointment,
	open,
	onOpenChange,
	onResponded,
}: BookingQuoteReviewDialogProps) {
	const acceptQuote = useAcceptBookingQuoteMutation()
	const declineQuote = useDeclineBookingQuoteMutation()
	const attachmentsQ = useAppointmentAttachmentsQuery(appointment?.id, { enabled: open })
	const [declineReason, setDeclineReason] = React.useState("")
	const [mode, setMode] = React.useState<"review" | "decline">("review")

	React.useEffect(() => {
		if (!open) {
			setDeclineReason("")
			setMode("review")
		}
	}, [open])

	function handleAccept() {
		if (!appointment || acceptQuote.isPending) return
		acceptQuote.mutate(appointment.id, {
			onSuccess: () => {
				toast.success("Quote accepted — appointment confirmed")
				onOpenChange(false)
				onResponded?.()
			},
			onError: err => {
				toast.error(err instanceof Error ? err.message : "Could not accept quote")
			},
		})
	}

	function handleDecline(e: React.FormEvent) {
		e.preventDefault()
		if (!appointment || declineQuote.isPending) return
		const reason = declineReason.trim()
		if (!reason) {
			toast.error("Please provide a reason for declining")
			return
		}
		declineQuote.mutate(
			{ id: appointment.id, declineReason: reason },
			{
				onSuccess: () => {
					toast.success("Quote declined")
					onOpenChange(false)
					onResponded?.()
				},
				onError: err => {
					toast.error(err instanceof Error ? err.message : "Could not decline quote")
				},
			}
		)
	}

	const attachments = attachmentsQ.data as AppointmentAttachment[] | undefined
	const quotedLines =
		attachments?.filter(
			(att: AppointmentAttachment) => typeof att.feePhp === "number" && att.feePhp > 0
		) ?? []

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[min(90vh,44rem)] w-full max-w-[calc(100%-2rem)] overflow-x-hidden overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{mode === "decline" ? "Decline quote" : "Review notary quote"}</DialogTitle>
					<DialogDescription>
						{mode === "decline"
							? "Tell your notary why you are declining this quote."
							: "Your notary proposed the following acts and fees for your documents."}
					</DialogDescription>
				</DialogHeader>

				{mode === "review" ? (
					<div className="space-y-4">
						{attachmentsQ.isLoading ? (
							<p className="text-muted-foreground text-sm">Loading quote…</p>
						) : (
							<ul className="space-y-2">
								{quotedLines.map(line => (
									<li
										key={line.fileObjectId}
										className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
									>
										<div className="min-w-0">
											<p className="truncate font-medium">{line.documentName ?? "Document"}</p>
											<p className="text-muted-foreground text-xs">
												{line.documentType
													? (NOTARIZATION_TYPE_LABELS[
															line.documentType as keyof typeof NOTARIZATION_TYPE_LABELS
														] ?? line.documentType)
													: "Notarial act"}
											</p>
										</div>
										<p className="shrink-0 font-medium">
											₱{(line.feePhp ?? 0).toLocaleString("en-PH")}
										</p>
									</li>
								))}
							</ul>
						)}

						{appointment?.quoteNotes ? (
							<div className="bg-muted/50 rounded-lg p-3 text-sm">
								<p className="text-muted-foreground mb-1 text-xs font-medium">Notary notes</p>
								<p>{appointment.quoteNotes}</p>
							</div>
						) : null}

						{typeof appointment?.quoteTotalPhp === "number" && appointment.quoteTotalPhp > 0 ? (
							<p className="text-sm font-semibold">
								Total: ₱{appointment.quoteTotalPhp.toLocaleString("en-PH")}
							</p>
						) : null}

						<DialogFooter className="gap-2 sm:justify-between">
							<Button type="button" variant="outline" onClick={() => setMode("decline")}>
								Decline
							</Button>
							<Button type="button" onClick={handleAccept} disabled={acceptQuote.isPending}>
								{acceptQuote.isPending ? "Accepting…" : "Accept quote"}
							</Button>
						</DialogFooter>
					</div>
				) : (
					<form onSubmit={handleDecline} className="space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="decline-quote-reason">Reason</Label>
							<Textarea
								id="decline-quote-reason"
								value={declineReason}
								onChange={e => setDeclineReason(e.target.value)}
								rows={3}
								placeholder="e.g. Fee too high, need a different act…"
							/>
						</div>
						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setMode("review")}>
								Back
							</Button>
							<Button type="submit" variant="destructive" disabled={declineQuote.isPending}>
								{declineQuote.isPending ? "Declining…" : "Decline quote"}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	)
}
