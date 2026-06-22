"use client"

import type { Route } from "next"
import Link from "next/link"

import type { EnpCommissionSummaryHearing } from "@repo/contracts"

import { buttonVariants } from "@/core/components/ui/button"
import { cn } from "@/core/lib/utils"

export function CommissionSummaryHearingNotice({
	hearing,
	hearingStatus,
	applicationStatus,
}: {
	hearing: EnpCommissionSummaryHearing
	hearingStatus?: string | null
	applicationStatus?: string | null
}) {
	if (!hearing.scheduledAt) return null

	const scheduledLabel = new Date(hearing.scheduledAt).toLocaleString()
	const lobbyPath = hearing.roomId
		? `/commission-hearings/${hearing.roomId}/lobby`
		: hearing.lobbyPath?.trim()
	const noticePath = hearing.roomId ? `/commission-hearings/${hearing.roomId}/notice` : null
	const showOutcome =
		hearingStatus === "ended" ||
		applicationStatus === "approved" ||
		applicationStatus === "rejected"
	const actionPath = showOutcome ? noticePath : lobbyPath

	return (
		<div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-sm">
			<p className="font-medium text-sky-900 dark:text-sky-200">
				{showOutcome ? "Virtual summary hearing completed" : "Virtual summary hearing scheduled"}
			</p>
			<p className="text-muted-foreground mt-1 text-xs leading-relaxed">
				Your Electronic Notary Administrator has scheduled your virtual summary hearing on{" "}
				<span className="text-foreground font-medium">{scheduledLabel}</span>.{" "}
				{showOutcome
					? "View the hearing outcome and decision notice."
					: "Open the hearing lobby, then join when the ENA starts the hearing."}
			</p>
			{hearing.instructions?.trim() ? (
				<p className="text-muted-foreground mt-2 text-xs leading-relaxed">
					<span className="text-foreground font-medium">ENA instructions:</span>{" "}
					{hearing.instructions.trim()}
				</p>
			) : null}
			{actionPath ? (
				<div className="mt-3">
					<Link href={actionPath as Route} className={cn(buttonVariants({ size: "sm" }))}>
						{showOutcome ? "View hearing outcome" : "Open hearing lobby"}
					</Link>
				</div>
			) : null}
		</div>
	)
}
