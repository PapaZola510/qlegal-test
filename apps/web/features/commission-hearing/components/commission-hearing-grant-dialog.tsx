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
import { Input } from "@/core/components/ui/input"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { useGrantCommissionMutation } from "@/features/enp-commission-application/api/enp-commission-application.hooks"

function todayInputValue(): string {
	const now = new Date()
	const pad = (n: number) => String(n).padStart(2, "0")
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function dateInputToIso(value: string): string {
	const date = new Date(`${value}T00:00:00`)
	if (Number.isNaN(date.getTime())) throw new Error("Enter a valid commission date")
	return date.toISOString()
}

function termEndLabel(value: string): string {
	const date = new Date(`${value}T00:00:00`)
	if (Number.isNaN(date.getTime())) return "Select a valid commission date"
	const end = new Date(Date.UTC(date.getUTCFullYear() + 1, 11, 31, 23, 59, 59, 999))
	return new Intl.DateTimeFormat("en-PH", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "Asia/Manila",
	}).format(end)
}

export function CommissionHearingGrantDialog({
	application,
	open,
	onOpenChange,
}: {
	application: EnpCommissionApplication
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	const grant = useGrantCommissionMutation()
	const [commissionedName, setCommissionedName] = React.useState(application.applicantName)
	const [placeOfWork, setPlaceOfWork] = React.useState(application.subOrgName ?? "")
	const [commissionDate, setCommissionDate] = React.useState(todayInputValue())

	React.useEffect(() => {
		if (!open) return
		setCommissionedName(application.applicantName)
		setPlaceOfWork(application.subOrgName ?? "")
		setCommissionDate(todayInputValue())
	}, [application.applicantName, application.subOrgName, open])

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault()
		try {
			await grant.mutateAsync({
				id: application.id,
				commissionedName: commissionedName.trim(),
				placeOfWork: placeOfWork.trim(),
				commissionDate: dateInputToIso(commissionDate),
			})
			toast.success("Commission granted.")
			onOpenChange(false)
		} catch (error) {
			toast.error(getOrpcMutationErrorMessage(error, "Could not grant this application."))
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form className="space-y-4" onSubmit={e => void onSubmit(e)}>
					<DialogHeader>
						<DialogTitle>Grant commission</DialogTitle>
						<DialogDescription>
							Issue the electronic notarial commission after the summary hearing.
						</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor="commissioned-name">Commissioned name</FieldLabel>
						<Input
							id="commissioned-name"
							value={commissionedName}
							onChange={e => setCommissionedName(e.target.value)}
							required
							disabled={grant.isPending}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="place-of-work">Place of work</FieldLabel>
						<Input
							id="place-of-work"
							value={placeOfWork}
							onChange={e => setPlaceOfWork(e.target.value)}
							required
							disabled={grant.isPending}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="commission-date">Commission date</FieldLabel>
						<Input
							id="commission-date"
							type="date"
							value={commissionDate}
							onChange={e => setCommissionDate(e.target.value)}
							required
							disabled={grant.isPending}
						/>
						<FieldDescription>Term ends {termEndLabel(commissionDate)}.</FieldDescription>
					</Field>
					<p className="text-muted-foreground rounded-md border px-3 py-2 text-xs">
						A.M. No. 24-10-14-SC
					</p>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={grant.isPending}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={grant.isPending}>
							{grant.isPending ? "Granting..." : "Grant commission"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
