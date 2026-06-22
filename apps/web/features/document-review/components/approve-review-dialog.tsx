"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { DocumentReviewApprovalPath } from "@repo/contracts"

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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/core/components/ui/select"
import { Textarea } from "@/core/components/ui/textarea"
import { saveReviewQuicksignBootstrap } from "@/features/document-review/lib/review-quicksign-bootstrap"

import {
	useApproveDocumentReviewRequestMutation,
	type DocumentReviewRequest,
} from "../api/document-review.hooks"
import {
	formatSlotIso,
	NOTARIZATION_TYPE_OPTIONS,
	SESSION_MODE_OPTIONS,
	type WizardNotarizationType,
	type WizardSessionMode,
} from "../lib/constants"

interface ApproveReviewDialogProps {
	request: DocumentReviewRequest | null
	open: boolean
	onOpenChange: (open: boolean) => void
}

function isoToDateTime(iso: string): { date: string; time: string } | null {
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return null
	const yyyy = d.getFullYear()
	const mm = String(d.getMonth() + 1).padStart(2, "0")
	const dd = String(d.getDate()).padStart(2, "0")
	const hh = String(d.getHours()).padStart(2, "0")
	const mi = String(d.getMinutes()).padStart(2, "0")
	return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}` }
}

export function ApproveReviewDialog({ request, open, onOpenChange }: ApproveReviewDialogProps) {
	const router = useRouter()
	const approve = useApproveDocumentReviewRequestMutation()
	const [approvalPath, setApprovalPath] = React.useState<DocumentReviewApprovalPath>("meeting")
	const [date, setDate] = React.useState("")
	const [time, setTime] = React.useState("")
	const [duration, setDuration] = React.useState(60)
	const [notarizationType, setNotarizationType] =
		React.useState<WizardNotarizationType>("acknowledgment")
	const [sessionMode, setSessionMode] = React.useState<WizardSessionMode>("remote")
	const [location, setLocation] = React.useState("")
	const [meetingUrl, setMeetingUrl] = React.useState("")
	const [notes, setNotes] = React.useState("")

	React.useEffect(() => {
		if (!request) return
		if (request.notarizationType) setNotarizationType(request.notarizationType)
		else setNotarizationType("acknowledgment")
		setApprovalPath("meeting")
		setSessionMode("remote")
		setNotes("")
		setLocation("")
		setMeetingUrl("")
		setDuration(60)
		const first = request.proposedSlots[0]
		if (first) {
			const parts = isoToDateTime(first)
			if (parts) {
				setDate(parts.date)
				setTime(parts.time)
				return
			}
		}
		setDate("")
		setTime("")
	}, [request])

	function pickSlot(iso: string) {
		const parts = isoToDateTime(iso)
		if (!parts) return
		setDate(parts.date)
		setTime(parts.time)
	}

	const canSubmitMeeting =
		Boolean(request) && Boolean(date) && Boolean(time) && duration > 0 && approvalPath === "meeting"
	const canSubmitQuicksign = Boolean(request) && approvalPath === "quicksign"
	const canSubmit = canSubmitMeeting || canSubmitQuicksign

	async function submit() {
		if (!request || !canSubmit) return

		try {
			if (approvalPath === "quicksign") {
				const result = await approve.mutateAsync({
					id: request.id,
					approvalPath: "quicksign",
					notarizationType,
					notes: notes.trim() || undefined,
				})
				if (!result.quicksign) {
					throw new Error("QuickSign bootstrap was not returned")
				}
				saveReviewQuicksignBootstrap({ ...result.quicksign, fromReview: true })
				toast.success(
					result.quicksign.queue.totalDocuments > 1
						? `Approved — starting QuickSign (document 1 of ${result.quicksign.queue.totalDocuments})`
						: "Approved — opening QuickSign"
				)
				onOpenChange(false)
				router.push("/quicksign")
				return
			}

			const scheduledAt = new Date(`${date}T${time}:00`).toISOString()
			await approve.mutateAsync({
				id: request.id,
				approvalPath: "meeting",
				scheduledAt,
				durationMinutes: duration,
				notarizationType,
				sessionMode,
				location: location.trim() || undefined,
				meetingUrl: meetingUrl.trim() || undefined,
				notes: notes.trim() || undefined,
			})
			toast.success("Request approved — meeting scheduled")
			onOpenChange(false)
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Approval failed")
		}
	}

	const fileCount = request?.files.length ?? 0

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Approve Review Request</DialogTitle>
					<DialogDescription>
						Choose how to proceed after review. Remote notarization schedules a video meeting;
						in-person notarization uses QuickSign (no live meeting).
					</DialogDescription>
				</DialogHeader>

				{request && (
					<div className="space-y-4">
						<div className="space-y-1.5">
							<Label>Notarization path</Label>
							<div className="grid gap-2 sm:grid-cols-2">
								<Button
									type="button"
									variant={approvalPath === "meeting" ? "default" : "outline"}
									className="h-auto flex-col items-start gap-1 px-3 py-2.5 text-left"
									onClick={() => setApprovalPath("meeting")}
								>
									<span className="text-sm font-semibold">Meeting (REN)</span>
									<span className="text-muted-foreground text-xs font-normal">
										Remote video session
										{fileCount > 1 ? ` · ${fileCount} docs attached` : ""}
									</span>
								</Button>
								<Button
									type="button"
									variant={approvalPath === "quicksign" ? "default" : "outline"}
									className="h-auto flex-col items-start gap-1 px-3 py-2.5 text-left"
									onClick={() => setApprovalPath("quicksign")}
								>
									<span className="text-sm font-semibold">Quick Sign (IEN)</span>
									<span className="text-muted-foreground text-xs font-normal">
										In-person e-sign
										{fileCount > 1
											? ` · ${fileCount} docs queued`
											: fileCount === 1
												? " · 1 doc"
												: ""}
									</span>
								</Button>
							</div>
						</div>

						{approvalPath === "meeting" && request.proposedSlots.length > 0 && (
							<div className="space-y-1.5">
								<Label className="text-xs">Client&apos;s preferred times</Label>
								<div className="flex flex-wrap gap-1.5">
									{request.proposedSlots.map(slot => (
										<Button
											key={slot}
											type="button"
											size="sm"
											variant="outline"
											onClick={() => pickSlot(slot)}
										>
											{formatSlotIso(slot)}
										</Button>
									))}
								</div>
							</div>
						)}

						{approvalPath === "meeting" ? (
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-1.5">
									<Label htmlFor="ap-date">Date</Label>
									<Input
										id="ap-date"
										type="date"
										value={date}
										onChange={e => setDate(e.target.value)}
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="ap-time">Time</Label>
									<Input
										id="ap-time"
										type="time"
										value={time}
										onChange={e => setTime(e.target.value)}
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="ap-duration">Duration (minutes)</Label>
									<Input
										id="ap-duration"
										type="number"
										min={15}
										max={240}
										value={duration}
										onChange={e => setDuration(Number(e.target.value) || 60)}
									/>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="ap-mode">Session Mode</Label>
									<Select
										value={sessionMode}
										onValueChange={v => setSessionMode(v as WizardSessionMode)}
									>
										<SelectTrigger id="ap-mode" className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{SESSION_MODE_OPTIONS.map(m => (
												<SelectItem key={m.value} value={m.value}>
													{m.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						) : (
							<p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs leading-relaxed">
								{fileCount > 1
									? `All ${fileCount} reviewed documents will be processed one at a time in QuickSign. The principal signs each document — no new upload or review is needed.`
									: "The reviewed document will open in QuickSign. The principal only needs to sign — no video meeting."}
							</p>
						)}

						<div className="space-y-1.5">
							<Label htmlFor="ap-type">Notarization Type</Label>
							<Select
								value={notarizationType}
								onValueChange={v => setNotarizationType(v as WizardNotarizationType)}
							>
								<SelectTrigger id="ap-type" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{NOTARIZATION_TYPE_OPTIONS.map(t => (
										<SelectItem key={t.value} value={t.value}>
											{t.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{approvalPath === "meeting" &&
						(sessionMode === "in_person" || sessionMode === "hybrid") ? (
							<div className="space-y-1.5">
								<Label htmlFor="ap-location">Location (optional)</Label>
								<Input
									id="ap-location"
									value={location}
									onChange={e => setLocation(e.target.value)}
									placeholder="Office address or meeting place"
								/>
							</div>
						) : null}

						<div className="space-y-1.5">
							<Label htmlFor="ap-notes">Notes for the client (optional)</Label>
							<Textarea
								id="ap-notes"
								value={notes}
								onChange={e => setNotes(e.target.value)}
								rows={2}
							/>
						</div>
					</div>
				)}

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={approve.isPending}
					>
						Cancel
					</Button>
					<Button onClick={() => void submit()} disabled={!canSubmit || approve.isPending}>
						{approve.isPending
							? "Approving…"
							: approvalPath === "quicksign"
								? "Approve & Open QuickSign"
								: "Approve & Schedule Meeting"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
