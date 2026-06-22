"use client"

import * as React from "react"
import { Download04FreeIcons, ViewFreeIcons } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import type {
	Appointment,
	AppointmentAttachment,
	AppointmentBookedDocumentType,
} from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/core/components/ui/select"
import { Textarea } from "@/core/components/ui/textarea"
import { useSendBookingQuoteMutation } from "@/features/appointments/api/appointments.hooks"
import {
	useAppointmentAttachmentsQuery,
	useAppointmentBookedDocumentTypesQuery,
} from "@/features/appointments/api/meeting.hooks"
import { NOTARIZATION_TYPE_LABELS } from "@/features/appointments/lib/labels"
import { resolveEnpNotarialActOptions } from "@/features/appointments/lib/resolve-enp-notarial-act-options"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import {
	downloadReviewFile,
	openReviewFile,
} from "@/features/document-review/lib/review-file-actions"

type NotarizationType = Appointment["notarizationType"]

interface QuoteLineDraft {
	fileObjectId: string
	label: string
	notarizationType: NotarizationType
	feePhp: string
	enpDocumentTypeId: string
}

interface SendBookingQuoteDialogProps {
	appointment: Appointment | null
	open: boolean
	onOpenChange: (open: boolean) => void
	onSent?: () => void
}

export function SendBookingQuoteDialog({
	appointment,
	open,
	onOpenChange,
	onSent,
}: SendBookingQuoteDialogProps) {
	const sendQuote = useSendBookingQuoteMutation()
	const profileQ = useAuthProfileMeQuery()
	const attachmentsQ = useAppointmentAttachmentsQuery(appointment?.id, { enabled: open })
	const bookedTypesQ = useAppointmentBookedDocumentTypesQuery(appointment?.id)
	const [notes, setNotes] = React.useState("")
	const [lines, setLines] = React.useState<QuoteLineDraft[]>([])
	const [fileBusy, setFileBusy] = React.useState<{
		id: string
		action: "view" | "download"
	} | null>(null)

	const actOptions = React.useMemo(
		() => resolveEnpNotarialActOptions(profileQ.data?.directorySpecializations),
		[profileQ.data?.directorySpecializations]
	)
	const defaultAct = actOptions[0] ?? "acknowledgment"

	React.useEffect(() => {
		const attachments = attachmentsQ.data as AppointmentAttachment[] | undefined
		const bookedTypes = bookedTypesQ.data as AppointmentBookedDocumentType[] | undefined
		if (!open || !attachments) return
		const defaultType = bookedTypes?.[0]
		setLines(
			attachments.map(att => ({
				fileObjectId: att.fileObjectId,
				label: att.documentName ?? att.fileObjectId.slice(0, 8),
				notarizationType: defaultAct,
				feePhp: defaultType ? String(defaultType.pricePhpSnapshot) : "",
				enpDocumentTypeId: defaultType?.id ?? "",
			}))
		)
		setNotes("")
	}, [open, attachmentsQ.data, bookedTypesQ.data, defaultAct])

	const bookedTypes = bookedTypesQ.data as AppointmentBookedDocumentType[] | undefined

	function patchLine(fileObjectId: string, patch: Partial<QuoteLineDraft>) {
		setLines(prev =>
			prev.map(line => (line.fileObjectId === fileObjectId ? { ...line, ...patch } : line))
		)
	}

	function selectBookedType(fileObjectId: string, typeId: string) {
		const match = bookedTypes?.find(t => t.id === typeId)
		const line = lines.find(l => l.fileObjectId === fileObjectId)
		patchLine(fileObjectId, {
			enpDocumentTypeId: typeId,
			feePhp: match ? String(match.pricePhpSnapshot) : (line?.feePhp ?? ""),
		})
	}

	async function handleView(fileObjectId: string) {
		setFileBusy({ id: fileObjectId, action: "view" })
		try {
			await openReviewFile(fileObjectId)
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not open document")
		} finally {
			setFileBusy(null)
		}
	}

	async function handleDownload(fileObjectId: string, filename: string) {
		setFileBusy({ id: fileObjectId, action: "download" })
		try {
			await downloadReviewFile(fileObjectId, filename)
			toast.success("Download started")
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not download document")
		} finally {
			setFileBusy(null)
		}
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!appointment || sendQuote.isPending) return

		const lineItems = []
		for (const line of lines) {
			const fee = Number.parseInt(line.feePhp, 10)
			if (!Number.isFinite(fee) || fee <= 0) {
				toast.error(`Enter a valid fee for ${line.label}`)
				return
			}
			lineItems.push({
				fileObjectId: line.fileObjectId,
				notarizationType: line.notarizationType,
				feePhp: fee,
				...(line.enpDocumentTypeId ? { enpDocumentTypeId: line.enpDocumentTypeId } : {}),
			})
		}

		sendQuote.mutate(
			{
				id: appointment.id,
				notes: notes.trim() || undefined,
				lineItems,
			},
			{
				onSuccess: () => {
					toast.success("Quote sent to client")
					onOpenChange(false)
					onSent?.()
				},
				onError: err => {
					const msg = err instanceof Error ? err.message : "Failed to send quote"
					toast.error(msg)
				},
			}
		)
	}

	const totalPhp = lines.reduce((sum, line) => {
		const fee = Number.parseInt(line.feePhp, 10)
		return sum + (Number.isFinite(fee) && fee > 0 ? fee : 0)
	}, 0)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[min(90vh,44rem)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
				<div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pt-4">
					<DialogHeader>
						<DialogTitle>Send booking quote</DialogTitle>
						<DialogDescription>
							Review each uploaded document, assign a notarial act from your profile, and set the
							fee. The client must accept before the appointment is confirmed.
						</DialogDescription>
					</DialogHeader>

					{attachmentsQ.isLoading ? (
						<p className="text-muted-foreground py-4 text-sm">Loading documents…</p>
					) : lines.length === 0 ? (
						<p className="text-muted-foreground py-4 text-sm">No booking documents found.</p>
					) : (
						<form id="send-booking-quote-form" onSubmit={handleSubmit} className="space-y-4 pb-4">
							<div className="space-y-3">
								{lines.map(line => {
									const selectedBookedType = bookedTypes?.find(t => t.id === line.enpDocumentTypeId)
									const isViewBusy =
										fileBusy?.id === line.fileObjectId && fileBusy.action === "view"
									const isDownloadBusy =
										fileBusy?.id === line.fileObjectId && fileBusy.action === "download"
									const anyFileBusy = fileBusy !== null
									return (
										<div
											key={line.fileObjectId}
											className="min-w-0 space-y-3 rounded-lg border p-3"
										>
											<div className="space-y-2">
												<p className="text-sm leading-snug font-medium break-all">{line.label}</p>
												<div className="flex flex-wrap gap-2">
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="h-8"
														disabled={anyFileBusy}
														onClick={() => void handleView(line.fileObjectId)}
													>
														<HugeiconsIcon
															icon={ViewFreeIcons}
															className="size-3.5 shrink-0"
															strokeWidth={2}
														/>
														<span className="ml-1.5">{isViewBusy ? "Opening…" : "View"}</span>
													</Button>
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="h-8"
														disabled={anyFileBusy}
														onClick={() => void handleDownload(line.fileObjectId, line.label)}
													>
														<HugeiconsIcon
															icon={Download04FreeIcons}
															className="size-3.5 shrink-0"
															strokeWidth={2}
														/>
														<span className="ml-1.5">
															{isDownloadBusy ? "Saving…" : "Download"}
														</span>
													</Button>
												</div>
											</div>
											<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
												<div className="space-y-1">
													<Label className="text-xs">Notarial act</Label>
													<Select
														value={line.notarizationType}
														onValueChange={v =>
															patchLine(line.fileObjectId, {
																notarizationType: v as NotarizationType,
															})
														}
													>
														<SelectTrigger className="w-full min-w-0">
															<span className="truncate text-left">
																{NOTARIZATION_TYPE_LABELS[line.notarizationType]}
															</span>
														</SelectTrigger>
														<SelectContent>
															{actOptions.map(opt => (
																<SelectItem key={opt} value={opt}>
																	{NOTARIZATION_TYPE_LABELS[opt]}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
												<div className="space-y-1">
													<Label className="text-xs">Fee (PHP)</Label>
													<Input
														type="number"
														min={1}
														step={1}
														inputMode="numeric"
														placeholder="e.g. 500"
														value={line.feePhp}
														onChange={e => patchLine(line.fileObjectId, { feePhp: e.target.value })}
													/>
												</div>
											</div>
											{(bookedTypes?.length ?? 0) > 0 && (
												<div className="space-y-1">
													<Label className="text-xs">Booked service type</Label>
													<Select
														value={line.enpDocumentTypeId || undefined}
														onValueChange={v => selectBookedType(line.fileObjectId, v ?? "")}
													>
														<SelectTrigger className="w-full min-w-0">
															<span className="truncate text-left">
																{selectedBookedType
																	? `${selectedBookedType.name} (₱${selectedBookedType.pricePhpSnapshot.toLocaleString("en-PH")})`
																	: "Select type"}
															</span>
														</SelectTrigger>
														<SelectContent>
															{bookedTypes?.map(type => (
																<SelectItem key={type.id} value={type.id}>
																	{type.name} (₱{type.pricePhpSnapshot.toLocaleString("en-PH")})
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
											)}
										</div>
									)
								})}
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="quote-notes">Notes for client (optional)</Label>
								<Textarea
									id="quote-notes"
									value={notes}
									onChange={e => setNotes(e.target.value)}
									rows={2}
									placeholder="Any clarifications about acts or fees…"
								/>
							</div>

							<p className="text-sm font-medium">
								Total quoted: ₱{totalPhp.toLocaleString("en-PH")}
							</p>
						</form>
					)}
				</div>

				{!attachmentsQ.isLoading && lines.length > 0 ? (
					<DialogFooter className="shrink-0 flex-wrap gap-2 sm:flex-row sm:justify-end">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" form="send-booking-quote-form" disabled={sendQuote.isPending}>
							{sendQuote.isPending ? "Sending…" : "Send quote"}
						</Button>
					</DialogFooter>
				) : null}
			</DialogContent>
		</Dialog>
	)
}
