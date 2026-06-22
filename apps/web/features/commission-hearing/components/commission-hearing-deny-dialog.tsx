"use client"

import * as React from "react"
import { toast } from "sonner"

import type { EnpCommissionApplication } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/core/components/ui/field"
import { Textarea } from "@/core/components/ui/textarea"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { useDenyCommissionMutation } from "@/features/enp-commission-application/api/enp-commission-application.hooks"

export function CommissionHearingDenyDialog({
	application,
	open,
	onOpenChange,
}: {
	application: EnpCommissionApplication
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	const deny = useDenyCommissionMutation()
	const [reason, setReason] = React.useState("")

	React.useEffect(() => {
		if (open) setReason("")
	}, [open])

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault()
		try {
			await deny.mutateAsync({
				id: application.id,
				reason: reason.trim() || undefined,
			})
			toast.success("Application denied.")
			onOpenChange(false)
		} catch (error) {
			toast.error(getOrpcMutationErrorMessage(error, "Could not deny this application."))
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form className="space-y-4" onSubmit={e => void onSubmit(e)}>
					<DialogHeader>
						<DialogTitle>Deny application</DialogTitle>
						<DialogDescription>
							Record the decision reason for the applicant and administrative file.
						</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor="decision-reason">Reason</FieldLabel>
						<Textarea
							id="decision-reason"
							rows={5}
							value={reason}
							onChange={e => setReason(e.target.value)}
							disabled={deny.isPending}
						/>
						<FieldDescription>Optional, maximum 2,000 characters.</FieldDescription>
					</Field>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={deny.isPending}
						>
							Cancel
						</Button>
						<Button type="submit" variant="destructive" disabled={deny.isPending}>
							{deny.isPending ? "Denying..." : "Deny application"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
