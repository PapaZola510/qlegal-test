"use client"

import * as React from "react"
import { toast } from "sonner"

import type { SubmitMonthlyNotarialBookResult } from "@repo/contracts"

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
import { RadioGroup, RadioGroupItem } from "@/core/components/ui/radio-group"
import { Spinner } from "@/core/components/ui/spinner"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"

import { labelForBookYearKey, type BookYearKey } from "../lib/notarial-book-filters"

type MonthlyBookDestination = "scp" | "ena"

interface SubmitMonthlyNotarialBookDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	bookYearKey: BookYearKey
	entryCount: number
	pendingSyncCount: number
	onSubmit: (input: {
		bookYearKey: BookYearKey
		destination: MonthlyBookDestination
	}) => Promise<SubmitMonthlyNotarialBookResult>
}

export function SubmitMonthlyNotarialBookDialog({
	open,
	onOpenChange,
	bookYearKey,
	entryCount,
	pendingSyncCount,
	onSubmit,
}: SubmitMonthlyNotarialBookDialogProps) {
	const [destination, setDestination] = React.useState<MonthlyBookDestination>("scp")
	const [submitting, setSubmitting] = React.useState(false)

	React.useEffect(() => {
		if (open) {
			setDestination("scp")
			setSubmitting(false)
		}
	}, [open])

	const bookLabel = labelForBookYearKey(bookYearKey)

	async function handleSubmit() {
		setSubmitting(true)
		try {
			const result = await onSubmit({ bookYearKey, destination })
			toast.info(result.message, { duration: 8000 })
			onOpenChange(false)
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not submit monthly notarial book."))
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Submit monthly notarial book</DialogTitle>
					<DialogDescription>
						Submit <span className="text-foreground font-medium">{bookLabel}</span> ({entryCount}{" "}
						{entryCount === 1 ? "entry" : "entries"}) to the Supreme Court or ENA archive.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-1">
					{pendingSyncCount > 0 ? (
						<p className="bg-muted/60 text-muted-foreground rounded-md border px-3 py-2 text-sm">
							{pendingSyncCount} {pendingSyncCount === 1 ? "entry has" : "entries have"} not been
							synced to SCP individually yet. Monthly submission may require all acts to be synced
							first once integration is live.
						</p>
					) : null}

					<RadioGroup
						value={destination}
						onValueChange={value => setDestination(value as MonthlyBookDestination)}
						className="gap-3"
					>
						<div className="flex items-start gap-3 rounded-lg border p-3">
							<RadioGroupItem value="scp" id="monthly-book-scp" className="mt-0.5" />
							<div className="space-y-1">
								<Label htmlFor="monthly-book-scp" className="font-medium">
									Supreme Court Portal (SCP)
								</Label>
								<p className="text-muted-foreground text-xs">
									Official monthly notarial book filing with the Supreme Court.
								</p>
							</div>
						</div>
						<div className="flex items-start gap-3 rounded-lg border p-3">
							<RadioGroupItem value="ena" id="monthly-book-ena" className="mt-0.5" />
							<div className="space-y-1">
								<Label htmlFor="monthly-book-ena" className="font-medium">
									Electronic Notary Archive (ENA)
								</Label>
								<p className="text-muted-foreground text-xs">
									Backup archive copy of the monthly book for compliance retention.
								</p>
							</div>
						</div>
					</RadioGroup>

					<p className="text-muted-foreground text-xs">
						This action is a placeholder — the API acknowledges your request but does not transmit
						data to SCP or ENA yet.
					</p>
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={submitting}
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={() => void handleSubmit()}
						disabled={submitting || entryCount === 0}
					>
						{submitting ? (
							<>
								<Spinner className="mr-2 size-4" />
								Submitting…
							</>
						) : (
							"Submit monthly book"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
