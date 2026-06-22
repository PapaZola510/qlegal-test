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

import { useRecordIncompleteActMutation } from "../api/registry.hooks"
import { REGISTRY_ACT_TYPE_LABELS, type RegistryActType } from "../lib/fixtures"

interface RecordIncompleteActDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function RecordIncompleteActDialog({ open, onOpenChange }: RecordIncompleteActDialogProps) {
	const mutation = useRecordIncompleteActMutation()
	const [title, setTitle] = React.useState("")
	const [actType, setActType] = React.useState<RegistryActType>("other")
	const [incompleteReason, setIncompleteReason] = React.useState("")
	const [incompleteCircumstances, setIncompleteCircumstances] = React.useState("")

	function reset() {
		setTitle("")
		setActType("other")
		setIncompleteReason("")
		setIncompleteCircumstances("")
	}

	async function submit() {
		if (!title.trim() || !incompleteReason.trim() || !incompleteCircumstances.trim()) {
			toast.error("Title, reason, and circumstances are required")
			return
		}
		try {
			await mutation.mutateAsync({
				title: title.trim(),
				actType,
				parties: [],
				incompleteReason: incompleteReason.trim(),
				incompleteCircumstances: incompleteCircumstances.trim(),
			})
			toast.success("Incomplete act recorded in the Electronic Notarial Book")
			reset()
			onOpenChange(false)
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not record incomplete act")
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Record incomplete notarial act</DialogTitle>
					<DialogDescription>
						Log reasons and circumstances when an electronic notarial act was not completed (ENB
						Rule b).
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="incomplete-title">Document / session title</Label>
						<Input
							id="incomplete-title"
							value={title}
							onChange={e => setTitle(e.target.value)}
							placeholder="e.g. Deed of Sale — session aborted"
						/>
					</div>
					<div className="space-y-2">
						<Label>Intended notarial act type</Label>
						<Select value={actType} onValueChange={v => setActType(v as RegistryActType)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{Object.entries(REGISTRY_ACT_TYPE_LABELS).map(([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label htmlFor="incomplete-reason">Reason not completed</Label>
						<Textarea
							id="incomplete-reason"
							value={incompleteReason}
							onChange={e => setIncompleteReason(e.target.value)}
							rows={3}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="incomplete-circumstances">Circumstances</Label>
						<Textarea
							id="incomplete-circumstances"
							value={incompleteCircumstances}
							onChange={e => setIncompleteCircumstances(e.target.value)}
							rows={4}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button disabled={mutation.isPending} onClick={() => void submit()}>
						{mutation.isPending ? "Saving…" : "Record in ENB"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
