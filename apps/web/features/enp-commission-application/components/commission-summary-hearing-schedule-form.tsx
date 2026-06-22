"use client"

import * as React from "react"
import type { Route } from "next"
import Link from "next/link"
import { toast } from "sonner"

import type { EnpCommissionApplication } from "@repo/contracts"

import { Button, buttonVariants } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/core/components/ui/field"
import { Input } from "@/core/components/ui/input"
import { Textarea } from "@/core/components/ui/textarea"
import { cn } from "@/core/lib/utils"
import { CommissionHearingCommissionCertificate } from "@/features/commission-hearing/components/commission-hearing-commission-certificate"
import { useScheduleEnpCommissionSummaryHearingMutation } from "@/features/enp-commission-application/api/enp-commission-application.hooks"

function toDatetimeLocalValue(iso: string | null | undefined): string {
	if (!iso) return ""
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return ""
	const pad = (n: number) => String(n).padStart(2, "0")
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function datetimeLocalToIso(value: string): string {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) {
		throw new Error("Enter a valid date and time")
	}
	return date.toISOString()
}

function hearingAction(application: EnpCommissionApplication): {
	href: Route | null
	label: string
} {
	const hearing = application.summaryHearing
	const showOutcome =
		application.hearingStatus === "ended" ||
		application.status === "approved" ||
		application.status === "rejected"
	if (showOutcome && hearing.roomId) {
		return {
			href: `/commission-hearings/${hearing.roomId}/notice` as Route,
			label: "View hearing outcome",
		}
	}
	if (hearing.roomId) {
		return {
			href: `/commission-hearings/${hearing.roomId}/lobby` as Route,
			label: "Open hearing lobby",
		}
	}
	if (hearing.lobbyPath) return { href: hearing.lobbyPath as Route, label: "Open hearing lobby" }
	return { href: null, label: "Open hearing lobby" }
}

export function CommissionSummaryHearingScheduleForm({
	application,
}: {
	application: EnpCommissionApplication
}) {
	const scheduleMutation = useScheduleEnpCommissionSummaryHearingMutation()
	const hearing = application.summaryHearing
	const hearingLink = hearingAction(application)

	const [scheduledAtLocal, setScheduledAtLocal] = React.useState(
		toDatetimeLocalValue(hearing.scheduledAt)
	)
	const [instructions, setInstructions] = React.useState(hearing.instructions ?? "")

	React.useEffect(() => {
		setScheduledAtLocal(toDatetimeLocalValue(hearing.scheduledAt))
		setInstructions(hearing.instructions ?? "")
	}, [hearing.scheduledAt, hearing.instructions])

	const isFinalized = application.status === "approved" || application.status === "rejected"

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault()
		if (!scheduledAtLocal.trim()) {
			toast.error("Select a date and time for the virtual summary hearing.")
			return
		}

		try {
			await scheduleMutation.mutateAsync({
				id: application.id,
				scheduledAt: datetimeLocalToIso(scheduledAtLocal),
				instructions: instructions.trim() || undefined,
			})
			toast.success(
				hearing.scheduledAt
					? "Virtual summary hearing updated."
					: "Virtual summary hearing scheduled. A secure qLegal meeting room was created."
			)
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not schedule hearing")
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Virtual summary hearing</CardTitle>
				<p className="text-muted-foreground text-sm leading-relaxed">
					Schedule a qLegal encrypted videoconference with the applicant under A.M. No. 20-12-01-SC.
					You will host the hearing from the session lobby; the ENP completes liveness and location
					checks before joining.
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				{isFinalized ? (
					<div className="space-y-4">
						<p className="text-muted-foreground text-sm">
							This application is {application.status}. Hearing scheduling is closed.
						</p>
						{hearingLink.href ? (
							<Link
								href={hearingLink.href}
								className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
							>
								{hearingLink.label}
							</Link>
						) : null}
						{application.status === "approved" && application.commission ? (
							<CommissionHearingCommissionCertificate commission={application.commission} />
						) : null}
					</div>
				) : (
					<form className="space-y-4" onSubmit={e => void onSubmit(e)}>
						<Field>
							<FieldLabel htmlFor="hearing-datetime">Hearing date & time</FieldLabel>
							<Input
								id="hearing-datetime"
								type="datetime-local"
								value={scheduledAtLocal}
								onChange={e => setScheduledAtLocal(e.target.value)}
								required
								disabled={scheduleMutation.isPending}
							/>
							<FieldDescription>Must be a future date and time.</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="hearing-instructions">Instructions for applicant</FieldLabel>
							<Textarea
								id="hearing-instructions"
								rows={3}
								placeholder="e.g. government ID ready, stable connection, ENF demo prepared"
								value={instructions}
								onChange={e => setInstructions(e.target.value)}
								disabled={scheduleMutation.isPending}
							/>
						</Field>
						<div className="flex flex-wrap items-center gap-2">
							<Button type="submit" size="sm" disabled={scheduleMutation.isPending}>
								{scheduleMutation.isPending
									? "Saving…"
									: hearing.scheduledAt
										? "Update hearing"
										: "Schedule hearing"}
							</Button>
							{hearingLink.href ? (
								<Link
									href={hearingLink.href}
									className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
								>
									{hearingLink.label}
								</Link>
							) : null}
						</div>
					</form>
				)}
			</CardContent>
		</Card>
	)
}
