"use client"

import * as React from "react"
import type { Route } from "next"
import Link from "next/link"
import { toast } from "sonner"

import { Badge } from "@/core/components/ui/badge"
import { Button, buttonVariants } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Separator } from "@/core/components/ui/separator"
import { cn } from "@/core/lib/utils"
import { subscribeQlegalEvent } from "@/services/ws/ws-client"
import { CommissionHearingCommissionCertificate } from "@/features/commission-hearing/components/commission-hearing-commission-certificate"
import { CommissionHearingDecisionPanel } from "@/features/commission-hearing/components/commission-hearing-decision-panel"
import { CommissionOppositionList } from "@/features/commission-hearing/components/commission-opposition-list"
import { useEnpCommissionApplicationQuery } from "@/features/enp-commission-application/api/enp-commission-application.hooks"
import { CommissionSummaryHearingScheduleForm } from "@/features/enp-commission-application/components/commission-summary-hearing-schedule-form"
import {
	downloadCommissionApplicationFile,
	openCommissionApplicationFile,
} from "@/features/enp-commission-application/lib/commission-application-file-actions"

const REQUIREMENT_ORDER = [
	"good_moral",
	"passport_photo",
	"filing_fee",
	"enf_video_certification",
] as const

const REQUIREMENT_LABELS: Record<(typeof REQUIREMENT_ORDER)[number], string> = {
	good_moral: "Good moral character (OBC & IBP)",
	passport_photo: "Passport-size photograph",
	filing_fee: "Proof of filing fee payment",
	enf_video_certification: "ENF instructional video certification",
}

function hearingAction(app: {
	status: string
	hearingStatus?: string | null
	summaryHearing: { roomId?: string | null; lobbyPath?: string | null }
}): { href: Route | null; label: string } {
	if (
		app.summaryHearing.roomId &&
		(app.hearingStatus === "ended" || app.status === "approved" || app.status === "rejected")
	) {
		return {
			href: `/commission-hearings/${app.summaryHearing.roomId}/notice` as Route,
			label: "View hearing outcome",
		}
	}
	if (app.summaryHearing.roomId) {
		return {
			href: `/commission-hearings/${app.summaryHearing.roomId}/lobby` as Route,
			label: "Open hearing",
		}
	}
	return app.summaryHearing.lobbyPath?.trim()
		? { href: app.summaryHearing.lobbyPath as Route, label: "Open hearing" }
		: { href: null, label: "Open hearing" }
}

interface AdminCommissionApplicationDetailContentProps {
	applicationId: string
}

export function AdminCommissionApplicationDetailContent({
	applicationId,
}: AdminCommissionApplicationDetailContentProps) {
	const appQ = useEnpCommissionApplicationQuery(applicationId)

	React.useEffect(() => {
		const offDecision = subscribeQlegalEvent("commission-hearing:decided", event => {
			if (event.applicationId !== applicationId) return
			void appQ.refetch()
		})
		return () => offDecision()
	}, [appQ, applicationId])

	if (appQ.isPending) {
		return <p className="text-muted-foreground text-sm">Loading application…</p>
	}

	if (appQ.isError || !appQ.data) {
		return (
			<p className="text-destructive text-sm">
				{appQ.error instanceof Error ? appQ.error.message : "Application not found"}
			</p>
		)
	}

	const app = appQ.data
	const documentsByKey = new Map(app.documents.map(doc => [doc.requirementKey, doc]))
	const hearingLink = hearingAction(app)

	async function handleView(fileObjectId: string) {
		try {
			await openCommissionApplicationFile(fileObjectId)
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not open document")
		}
	}

	async function handleDownload(fileObjectId: string, label: string) {
		try {
			await downloadCommissionApplicationFile(fileObjectId, label)
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not download document")
		}
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Link
					href={"/admin/commission-applications" as Route}
					className="text-muted-foreground text-sm hover:underline"
				>
					← Back to queue
				</Link>
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="secondary">{app.status.replace(/_/g, " ")}</Badge>
					{hearingLink.href ? (
						<Link
							href={hearingLink.href}
							className={cn(buttonVariants({ variant: "default", size: "sm" }))}
						>
							{hearingLink.label}
						</Link>
					) : null}
				</div>
			</div>

			<CommissionSummaryHearingScheduleForm application={app} />

			{app.hearingStatus === "ended" && app.status !== "approved" && app.status !== "rejected" ? (
				<CommissionHearingDecisionPanel application={app} />
			) : null}

			{app.status === "approved" && app.commission ? (
				<CommissionHearingCommissionCertificate commission={app.commission} />
			) : null}

			{app.status === "rejected" ? (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Decision</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm">Application denied.</p>
						{app.decisionReason ? (
							<p className="bg-muted/45 mt-3 rounded-md p-3 text-sm leading-relaxed">
								{app.decisionReason}
							</p>
						) : null}
					</CardContent>
				</Card>
			) : null}

			<CommissionOppositionList applicationId={app.id} hearingRoomId={app.summaryHearing.roomId} />

			<Card>
				<CardHeader>
					<CardTitle>{app.applicantName}</CardTitle>
					<p className="text-muted-foreground text-sm">
						{app.applicantEmail} · Submitted {new Date(app.submittedAt).toLocaleString()}
						{app.subOrgName ? ` · ${app.subOrgName}` : null}
					</p>
				</CardHeader>
				<CardContent className="space-y-6">
					<div>
						<h3 className="text-sm font-semibold">Personal qualifications</h3>
						<dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
							<div>
								<dt className="text-muted-foreground">Citizenship</dt>
								<dd>{app.citizenship}</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">ULAS compliance no.</dt>
								<dd>{app.ulasComplianceNumber?.trim() || "—"}</dd>
							</div>
						</dl>
						<div className="mt-4">
							<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
								Qualifications statement
							</p>
							<pre className="bg-muted/40 mt-2 max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
								{app.qualificationsStatement}
							</pre>
						</div>
					</div>

					<Separator />

					<div>
						<h3 className="text-sm font-semibold">Supporting documents</h3>
						<ul className="mt-3 divide-y rounded-md border">
							{REQUIREMENT_ORDER.map(key => {
								const doc = documentsByKey.get(key)
								return (
									<li
										key={key}
										className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
									>
										<div>
											<p className="text-sm font-medium">{REQUIREMENT_LABELS[key]}</p>
											{doc ? (
												<p className="text-muted-foreground text-xs">
													{doc.mimeType} · {(doc.sizeBytes / 1024).toFixed(1)} KB
												</p>
											) : (
												<p className="text-destructive text-xs">Not uploaded</p>
											)}
										</div>
										{doc ? (
											<div className="flex gap-2">
												<Button
													type="button"
													variant="outline"
													size="sm"
													onClick={() => void handleView(doc.fileObjectId)}
												>
													View
												</Button>
												<Button
													type="button"
													variant="secondary"
													size="sm"
													onClick={() =>
														void handleDownload(doc.fileObjectId, REQUIREMENT_LABELS[key])
													}
												>
													Download
												</Button>
											</div>
										) : null}
									</li>
								)
							})}
						</ul>
					</div>

					<Separator />

					<div>
						<h3 className="text-sm font-semibold">Undertakings</h3>
						<ul className="text-muted-foreground mt-2 space-y-1 text-sm">
							<li>{app.undertakingRules ? "✓" : "✗"} Rules on Electronic Notarization</li>
							<li>
								{app.undertakingDataSharing ? "✓" : "✗"} Electronic Notarization Data Sharing
								Guidelines
							</li>
						</ul>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
