"use client"

import * as React from "react"
import type { Route } from "next"
import Link from "next/link"

import { Badge } from "@/core/components/ui/badge"
import { buttonVariants } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { cn } from "@/core/lib/utils"
import { authClient } from "@/services/better-auth/auth-client"
import { subscribeQlegalEvent } from "@/services/ws/ws-client"
import { useCommissionHearingQuery } from "@/features/commission-hearing/api/commission-hearing.hooks"
import {
	useCommissionApplicationCommissionQuery,
	useEnpCommissionApplicationQuery,
} from "@/features/enp-commission-application/api/enp-commission-application.hooks"

import { CommissionHearingCommissionCertificate } from "./commission-hearing-commission-certificate"
import { CommissionHearingDecisionPanel } from "./commission-hearing-decision-panel"
import { CommissionOppositionList } from "./commission-opposition-list"

export function CommissionHearingNoticeContent({ id }: { id: string }) {
	const { data: session } = authClient.useSession()
	const hearingQ = useCommissionHearingQuery(id)
	const applicationId = hearingQ.data?.applicationId ?? null
	const applicationQ = useEnpCommissionApplicationQuery(applicationId)
	const commissionQ = useCommissionApplicationCommissionQuery(
		applicationQ.data?.status === "approved" ? applicationId : null
	)

	React.useEffect(() => {
		const offDecision = subscribeQlegalEvent("commission-hearing:decided", event => {
			if (applicationId && event.applicationId !== applicationId) return
			void hearingQ.refetch()
			void applicationQ.refetch()
			void commissionQ.refetch()
		})
		return () => offDecision()
	}, [applicationId, applicationQ, commissionQ, hearingQ])

	if (hearingQ.isPending || (applicationId && applicationQ.isPending)) {
		return <p className="text-muted-foreground px-4 py-8 text-sm">Loading hearing outcome...</p>
	}

	if (hearingQ.isError || !hearingQ.data) {
		return (
			<div className="mx-auto max-w-xl space-y-4 px-4 py-8">
				<p className="text-destructive text-sm">We could not load this notice of hearing.</p>
				<Link href={"/dashboard" as Route} className={buttonVariants({ variant: "outline" })}>
					Back
				</Link>
			</div>
		)
	}

	const hearing = hearingQ.data
	const application = applicationQ.data
	const isEna = Boolean(session?.user?.id && session.user.id === hearing.enaUserId)
	const commission = application?.commission ?? commissionQ.data ?? null
	const denied = application?.status === "rejected"
	const granted = application?.status === "approved"
	const scheduledLabel = hearing.scheduledAt
		? new Date(hearing.scheduledAt).toLocaleString()
		: "No scheduled time"

	return (
		<div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
			<div>
				<Link
					href={(isEna ? "/admin/commission-applications" : "/dashboard") as Route}
					className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ms-2 mb-2")}
				>
					{isEna ? "Back to commission applications" : "Back to dashboard"}
				</Link>
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="text-xl font-semibold tracking-tight">Notice of Hearing</h1>
					<Badge variant={hearing.status === "ended" ? "outline" : "secondary"}>
						{hearing.status.replace("_", " ")}
					</Badge>
					{application ? (
						<Badge
							variant={
								application.status === "rejected"
									? "destructive"
									: application.status === "approved"
										? "default"
										: "secondary"
							}
						>
							{application.status.replace(/_/g, " ")}
						</Badge>
					) : null}
				</div>
				<p className="text-muted-foreground mt-1 text-sm">
					{hearing.applicantName} · {scheduledLabel}
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Outcome</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					{!application ? (
						<p className="text-muted-foreground">Application details are not available.</p>
					) : granted && commission ? (
						<p>
							The application has been granted and an electronic notarial commission has been
							issued.
						</p>
					) : denied ? (
						<div className="space-y-2">
							<p>The application has been denied.</p>
							{application.decisionReason ? (
								<p className="bg-muted/45 rounded-md p-3 text-sm leading-relaxed">
									{application.decisionReason}
								</p>
							) : null}
						</div>
					) : (
						<p className="text-muted-foreground">
							The hearing has ended and the application is pending final decision.
						</p>
					)}
				</CardContent>
			</Card>

			{application && isEna && hearing.status === "ended" ? (
				<CommissionHearingDecisionPanel application={application} />
			) : null}

			{commission ? <CommissionHearingCommissionCertificate commission={commission} /> : null}

			{isEna && application ? (
				<CommissionOppositionList applicationId={application.id} hearingRoomId={hearing.id} />
			) : null}
		</div>
	)
}
