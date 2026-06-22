"use client"

import * as React from "react"
import { toast } from "sonner"

import type { CommissionHearingOpposition } from "@repo/contracts"

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
import { Switch } from "@/core/components/ui/switch"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { useMarkCommissionOppositionOutcomeMutation } from "@/features/commission-hearing/api/commission-hearing.hooks"

type OppositionOutcome = "sustained" | "overruled" | "denied_no_show"

const OUTCOME_OPTIONS: Array<{ value: OppositionOutcome; label: string; description: string }> = [
	{
		value: "sustained",
		label: "Sustain opposition",
		description: "The opposition is meritorious and should block the application.",
	},
	{
		value: "overruled",
		label: "Overrule opposition",
		description: "The opposition is not meritorious and the application may proceed.",
	},
	{
		value: "denied_no_show",
		label: "Deny for non-appearance",
		description: "The oppositor failed to appear without sufficient cause.",
	},
]

export function CommissionOppositionOutcomeDialog({
	open,
	onOpenChange,
	hearingRoomId,
	applicationId,
	opposition,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	hearingRoomId: string
	applicationId: string
	opposition: CommissionHearingOpposition | null
}) {
	const decide = useMarkCommissionOppositionOutcomeMutation()
	const [outcome, setOutcome] = React.useState<OppositionOutcome>("overruled")
	const [excused, setExcused] = React.useState(false)

	React.useEffect(() => {
		if (!open) return
		setOutcome(
			opposition?.status === "sustained" ||
				opposition?.status === "overruled" ||
				opposition?.status === "denied_no_show"
				? opposition.status
				: "overruled"
		)
		setExcused(Boolean(opposition?.nonAppearanceExcused))
	}, [open, opposition])

	async function submit() {
		if (!opposition) return
		try {
			await decide.mutateAsync({
				id: hearingRoomId,
				oppositionId: opposition.id,
				applicationId,
				outcome,
				excused: outcome === "denied_no_show" ? excused : undefined,
			})
			toast.success("Opposition outcome recorded")
			onOpenChange(false)
		} catch (error) {
			toast.error(getOrpcMutationErrorMessage(error, "Could not mark opposition outcome."))
		}
	}

	const busy = decide.isPending

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Mark opposition outcome</DialogTitle>
					<DialogDescription>
						Record the ENA disposition for {opposition?.oppositorName ?? "this opposition"}.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-1">
					<RadioGroup
						value={outcome}
						onValueChange={value => setOutcome(value as OppositionOutcome)}
					>
						{OUTCOME_OPTIONS.map(option => (
							<label
								key={option.value}
								htmlFor={`opposition-outcome-${option.value}`}
								className="border-border/70 hover:bg-muted/40 flex cursor-pointer gap-3 rounded-md border p-3"
							>
								<RadioGroupItem
									id={`opposition-outcome-${option.value}`}
									value={option.value}
									disabled={busy}
									className="mt-0.5"
								/>
								<span className="min-w-0">
									<span className="block text-sm font-medium">{option.label}</span>
									<span className="text-muted-foreground block text-xs leading-relaxed">
										{option.description}
									</span>
								</span>
							</label>
						))}
					</RadioGroup>

					{outcome === "denied_no_show" ? (
						<div className="flex items-center justify-between gap-3 rounded-md border p-3">
							<div className="space-y-0.5">
								<Label htmlFor="non-appearance-excused">Excused non-appearance</Label>
								<p className="text-muted-foreground text-xs">
									Use this only when the ENA accepts a valid cause for absence.
								</p>
							</div>
							<Switch
								id="non-appearance-excused"
								checked={excused}
								disabled={busy}
								onCheckedChange={setExcused}
							/>
						</div>
					) : null}
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						disabled={busy}
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button type="button" disabled={busy} onClick={() => void submit()}>
						{busy ? "Saving..." : "Save outcome"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
