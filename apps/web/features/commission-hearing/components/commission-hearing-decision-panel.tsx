"use client"

import * as React from "react"

import type { EnpCommissionApplication } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"

import { CommissionHearingDenyDialog } from "./commission-hearing-deny-dialog"
import { CommissionHearingGrantDialog } from "./commission-hearing-grant-dialog"

export function CommissionHearingDecisionPanel({
	application,
}: {
	application: EnpCommissionApplication
}) {
	const [grantOpen, setGrantOpen] = React.useState(false)
	const [denyOpen, setDenyOpen] = React.useState(false)
	const decided = application.status === "approved" || application.status === "rejected"

	if (decided) return null

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Decision</CardTitle>
				<p className="text-muted-foreground text-sm">
					Grant or deny the application after the summary hearing has ended.
				</p>
			</CardHeader>
			<CardContent>
				<div className="flex flex-wrap gap-2">
					<Button type="button" onClick={() => setGrantOpen(true)}>
						Grant commission
					</Button>
					<Button type="button" variant="destructive" onClick={() => setDenyOpen(true)}>
						Deny application
					</Button>
				</div>
			</CardContent>
			<CommissionHearingGrantDialog
				application={application}
				open={grantOpen}
				onOpenChange={setGrantOpen}
			/>
			<CommissionHearingDenyDialog
				application={application}
				open={denyOpen}
				onOpenChange={setDenyOpen}
			/>
		</Card>
	)
}
