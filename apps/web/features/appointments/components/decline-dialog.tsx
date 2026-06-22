"use client"

import * as React from "react"

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

interface DeclineDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	appointmentId: string
	onConfirm: (reason: string) => void
}

export function DeclineDialog({
	open,
	onOpenChange,
	appointmentId,
	onConfirm,
}: DeclineDialogProps) {
	const [reason, setReason] = React.useState("")

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!reason.trim()) return
		onConfirm(reason.trim())
		setReason("")
		onOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Decline Appointment</DialogTitle>
						<DialogDescription>
							Please provide a reason for declining appointment{" "}
							<span className="font-mono text-xs">{appointmentId}</span>. This will be shared with
							the requesting party.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-1.5 py-4">
						<Label htmlFor="decline-reason">Reason</Label>
						<Textarea
							id="decline-reason"
							placeholder="e.g. Schedule conflict, incomplete documents…"
							value={reason}
							onChange={e => setReason(e.target.value)}
							rows={3}
						/>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="submit" variant="destructive" disabled={!reason.trim()}>
							Decline
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
