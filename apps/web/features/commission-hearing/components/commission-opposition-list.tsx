"use client"

import * as React from "react"
import { toast } from "sonner"

import type { CommissionHearingOpposition } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Separator } from "@/core/components/ui/separator"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import {
	useCommissionOppositionsQuery,
	useForwardCommissionOppositionMutation,
} from "@/features/commission-hearing/api/commission-hearing.hooks"
import {
	downloadCommissionApplicationFile,
	openCommissionApplicationFile,
} from "@/features/enp-commission-application/lib/commission-application-file-actions"

import { CommissionOppositionAccessDialog } from "./commission-opposition-access-dialog"
import { CommissionOppositionOutcomeDialog } from "./commission-opposition-outcome-dialog"

const STATUS_LABELS: Record<CommissionHearingOpposition["status"], string> = {
	filed: "Filed",
	forwarded: "Forwarded",
	access_granted: "Access granted",
	appeared: "Appeared",
	denied_no_show: "Denied: no-show",
	sustained: "Sustained",
	overruled: "Overruled",
}

function statusVariant(status: CommissionHearingOpposition["status"]) {
	if (status === "sustained") return "default"
	if (status === "denied_no_show" || status === "overruled") return "secondary"
	return "outline"
}

async function viewFile(fileObjectId: string) {
	try {
		await openCommissionApplicationFile(fileObjectId)
	} catch (error) {
		toast.error(error instanceof Error ? error.message : "Could not open document")
	}
}

async function downloadFile(fileObjectId: string, filename: string) {
	try {
		await downloadCommissionApplicationFile(fileObjectId, filename)
	} catch (error) {
		toast.error(error instanceof Error ? error.message : "Could not download document")
	}
}

export function CommissionOppositionList({
	applicationId,
	hearingRoomId,
}: {
	applicationId: string
	hearingRoomId?: string | null
}) {
	const oppositionsQ = useCommissionOppositionsQuery(applicationId)
	const forwardOpposition = useForwardCommissionOppositionMutation()
	const [accessOpposition, setAccessOpposition] =
		React.useState<CommissionHearingOpposition | null>(null)
	const [outcomeOpposition, setOutcomeOpposition] =
		React.useState<CommissionHearingOpposition | null>(null)

	async function forward(row: CommissionHearingOpposition) {
		const roomId = hearingRoomId ?? row.hearingRoomId
		if (!roomId) {
			toast.error("Schedule the hearing before forwarding this opposition.")
			return
		}
		try {
			await forwardOpposition.mutateAsync({ id: roomId, oppositionId: row.id })
			toast.success("Opposition forwarded to applicant")
		} catch (error) {
			toast.error(getOrpcMutationErrorMessage(error, "Could not forward opposition."))
		}
	}

	const roomIdForDialogs =
		hearingRoomId ?? accessOpposition?.hearingRoomId ?? outcomeOpposition?.hearingRoomId
	const rows = oppositionsQ.data ?? []

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Oppositions</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{oppositionsQ.isPending ? (
					<p className="text-muted-foreground text-sm">Loading oppositions...</p>
				) : oppositionsQ.isError ? (
					<p className="text-destructive text-sm">
						{oppositionsQ.error instanceof Error
							? oppositionsQ.error.message
							: "Could not load oppositions"}
					</p>
				) : rows.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No verified written oppositions have been filed for this application.
					</p>
				) : (
					<ul className="divide-y rounded-md border">
						{rows.map(row => {
							const roomId = hearingRoomId ?? row.hearingRoomId
							const forwardingThis =
								forwardOpposition.isPending && forwardOpposition.variables?.oppositionId === row.id
							return (
								<li key={row.id} className="space-y-4 px-4 py-4">
									<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
										<div className="min-w-0 space-y-1">
											<div className="flex flex-wrap items-center gap-2">
												<p className="text-sm font-medium">{row.oppositorName}</p>
												<Badge variant={statusVariant(row.status)}>
													{STATUS_LABELS[row.status]}
												</Badge>
											</div>
											<p className="text-muted-foreground text-xs">{row.oppositorEmail}</p>
											<p className="text-muted-foreground text-xs">
												Filed {new Date(row.createdAt).toLocaleString()}
											</p>
										</div>
										<div className="flex flex-wrap gap-2">
											<Button
												type="button"
												size="sm"
												variant="outline"
												disabled={forwardingThis || !roomId}
												onClick={() => void forward(row)}
											>
												{forwardingThis ? "Forwarding..." : "Forward to applicant"}
											</Button>
											<Button
												type="button"
												size="sm"
												variant="secondary"
												disabled={!roomId}
												onClick={() => setAccessOpposition(row)}
											>
												Grant hearing access
											</Button>
											<Button
												type="button"
												size="sm"
												disabled={!roomId}
												onClick={() => setOutcomeOpposition(row)}
											>
												Mark outcome
											</Button>
										</div>
									</div>

									<p className="bg-muted/40 rounded-md border p-3 text-sm leading-relaxed whitespace-pre-wrap">
										{row.grounds}
									</p>

									<div className="grid gap-3 sm:grid-cols-2">
										<div className="rounded-md border p-3">
											<p className="text-sm font-medium">Verified opposition</p>
											<div className="mt-2 flex flex-wrap gap-2">
												<Button
													type="button"
													size="sm"
													variant="outline"
													onClick={() => void viewFile(row.verifiedDocumentFileObjectId)}
												>
													View
												</Button>
												<Button
													type="button"
													size="sm"
													variant="secondary"
													onClick={() =>
														void downloadFile(
															row.verifiedDocumentFileObjectId,
															"verified-opposition"
														)
													}
												>
													Download
												</Button>
											</div>
										</div>
										<div className="rounded-md border p-3">
											<p className="text-sm font-medium">Representative authority</p>
											{row.representativeDocumentFileObjectId ? (
												<div className="mt-2 flex flex-wrap gap-2">
													<Button
														type="button"
														size="sm"
														variant="outline"
														onClick={() => void viewFile(row.representativeDocumentFileObjectId!)}
													>
														View
													</Button>
													<Button
														type="button"
														size="sm"
														variant="secondary"
														onClick={() =>
															void downloadFile(
																row.representativeDocumentFileObjectId!,
																"representative-authority"
															)
														}
													>
														Download
													</Button>
												</div>
											) : (
												<p className="text-muted-foreground mt-2 text-xs">Not provided</p>
											)}
										</div>
									</div>

									{row.status === "denied_no_show" && row.nonAppearanceExcused ? (
										<>
											<Separator />
											<p className="text-muted-foreground text-xs">
												Non-appearance was marked excused.
											</p>
										</>
									) : null}
								</li>
							)
						})}
					</ul>
				)}
			</CardContent>

			{roomIdForDialogs ? (
				<>
					<CommissionOppositionAccessDialog
						open={Boolean(accessOpposition)}
						onOpenChange={open => {
							if (!open) setAccessOpposition(null)
						}}
						hearingRoomId={roomIdForDialogs}
						applicationId={applicationId}
						opposition={accessOpposition}
					/>
					<CommissionOppositionOutcomeDialog
						open={Boolean(outcomeOpposition)}
						onOpenChange={open => {
							if (!open) setOutcomeOpposition(null)
						}}
						hearingRoomId={roomIdForDialogs}
						applicationId={applicationId}
						opposition={outcomeOpposition}
					/>
				</>
			) : null}
		</Card>
	)
}
