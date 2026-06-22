"use client"

import * as React from "react"
import type { Route } from "next"
import Link from "next/link"

import { Badge } from "@/core/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/core/components/ui/table"
import { subscribeQlegalEvent } from "@/services/ws/ws-client"
import { useEnpCommissionApplicationsReviewQueueQuery } from "@/features/enp-commission-application/api/enp-commission-application.hooks"

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
	submitted: "secondary",
	under_review: "default",
	hearing_scheduled: "default",
	approved: "default",
	rejected: "destructive",
}

export function AdminCommissionApplicationsContent() {
	const queueQ = useEnpCommissionApplicationsReviewQueueQuery()

	React.useEffect(() => {
		const offDecision = subscribeQlegalEvent("commission-hearing:decided", () => {
			void queueQ.refetch()
		})
		return () => offDecision()
	}, [queueQ])

	if (queueQ.isPending) {
		return <p className="text-muted-foreground text-sm">Loading applications…</p>
	}

	if (queueQ.isError) {
		return (
			<p className="text-destructive text-sm">
				{queueQ.error instanceof Error ? queueQ.error.message : "Could not load applications"}
			</p>
		)
	}

	const applications = queueQ.data ?? []

	return (
		<Card>
			<CardHeader>
				<CardTitle>Commission applications</CardTitle>
			</CardHeader>
			<CardContent>
				{applications.length === 0 ? (
					<p className="text-muted-foreground text-sm">No commission applications yet.</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Applicant</TableHead>
								<TableHead>Organization</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Outcome</TableHead>
								<TableHead>Submitted</TableHead>
								<TableHead>Hearing</TableHead>
								<TableHead className="text-right">Review</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{applications.map(app => (
								<TableRow key={app.id}>
									<TableCell>
										<div className="font-medium">{app.applicantName}</div>
										<div className="text-muted-foreground text-xs">{app.applicantEmail}</div>
									</TableCell>
									<TableCell className="text-sm">{app.subOrgName ?? "—"}</TableCell>
									<TableCell>
										<Badge variant={STATUS_VARIANT[app.status] ?? "outline"}>
											{app.status.replace(/_/g, " ")}
										</Badge>
									</TableCell>
									<TableCell>
										{app.status === "approved" ? (
											<Badge variant="default">Granted</Badge>
										) : app.status === "rejected" ? (
											<Badge variant="destructive">Denied</Badge>
										) : app.hearingStatus === "ended" ? (
											<Badge variant="outline">Pending decision</Badge>
										) : (
											<Badge variant="secondary">Pending hearing</Badge>
										)}
										{app.summaryHearing.roomId &&
										(app.hearingStatus === "ended" ||
											app.status === "approved" ||
											app.status === "rejected") ? (
											<div>
												<Link
													href={`/commission-hearings/${app.summaryHearing.roomId}/notice` as Route}
													className="text-primary text-xs hover:underline"
												>
													Notice
												</Link>
											</div>
										) : null}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{new Date(app.submittedAt).toLocaleString()}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{app.summaryHearing.scheduledAt
											? new Date(app.summaryHearing.scheduledAt).toLocaleString()
											: "—"}
									</TableCell>
									<TableCell className="text-right">
										<Link
											href={`/admin/commission-applications/${app.id}` as Route}
											className="text-primary text-sm font-medium hover:underline"
										>
											View package
										</Link>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	)
}
