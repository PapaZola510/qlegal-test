"use client"

import * as React from "react"
import { toast } from "sonner"

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
	useRejectDocumentReviewRequestMutation,
	type DocumentReviewRequest,
} from "../api/document-review.hooks"

interface RejectReviewDialogProps {
	request: DocumentReviewRequest | null
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function RejectReviewDialog({ request, open, onOpenChange }: RejectReviewDialogProps) {
	const reject = useRejectDocumentReviewRequestMutation()
	const [reason, setReason] = React.useState("")

	React.useEffect(() => {
		if (open) setReason("")
	}, [open])

	const canSubmit = Boolean(request) && reason.trim().length > 0

	async function submit() {
		if (!request || !canSubmit) return
		try {
			await reject.mutateAsync({ id: request.id, rejectionReason: reason.trim() })
			toast.success("Request rejected — the client has been notified")
			onOpenChange(false)
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Rejection failed")
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Reject Review Request</DialogTitle>
					<DialogDescription>
						Tell the client why this document needs changes. They will see your reason in their
						inbox.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-1.5">
					<Label htmlFor="rej-reason">Reason</Label>
					<Textarea
						id="rej-reason"
						value={reason}
						onChange={e => setReason(e.target.value)}
						rows={4}
						placeholder="e.g. Document is missing the signer's signature on page 2."
					/>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)} disabled={reject.isPending}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={() => void submit()}
						disabled={!canSubmit || reject.isPending}
					>
						{reject.isPending ? "Rejecting…" : "Reject Request"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
