"use client"

import * as React from "react"
import { Download04FreeIcons, ViewFreeIcons } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import type { UserProfile } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent } from "@/core/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/components/ui/tabs"
import { subscribeQlegalEvent } from "@/services/ws/ws-client"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"

import {
	useCancelDocumentReviewRequestMutation,
	useDocumentReviewRequestsQuery,
	type DocumentReviewRequest,
} from "../api/document-review.hooks"
import { formatBytes, formatSlotIso, notarizationLabel, sessionModeLabel } from "../lib/constants"
import { downloadReviewFile, openReviewFile } from "../lib/review-file-actions"
import { ApproveReviewDialog } from "./approve-review-dialog"
import { RejectReviewDialog } from "./reject-review-dialog"

type StatusTab = DocumentReviewRequest["status"] | "all"

const TAB_ORDER: { key: StatusTab; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "pending", label: "Pending" },
	{ key: "approved", label: "Approved" },
	{ key: "rejected", label: "Rejected" },
	{ key: "cancelled", label: "Cancelled" },
]

const STATUS_VARIANT: Record<
	DocumentReviewRequest["status"],
	"default" | "secondary" | "outline" | "destructive"
> = {
	pending: "outline",
	approved: "default",
	rejected: "destructive",
	cancelled: "outline",
}

function formatTimestamp(iso: string | Date): string {
	const d = typeof iso === "string" ? new Date(iso) : iso
	if (Number.isNaN(d.getTime())) return ""
	return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export function DocumentReviewsContent() {
	const queryClient = useQueryClient()
	const profileQ = useAuthProfileMeQuery()
	const profile = profileQ.data as UserProfile | undefined
	const isEnp = profile?.role === "enp"

	const listQuery = useDocumentReviewRequestsQuery()
	const requests = React.useMemo(() => listQuery.data ?? [], [listQuery.data])

	const cancelMutation = useCancelDocumentReviewRequestMutation()

	const [activeTab, setActiveTab] = React.useState<StatusTab>("all")
	const [approveTarget, setApproveTarget] = React.useState<DocumentReviewRequest | null>(null)
	const [rejectTarget, setRejectTarget] = React.useState<DocumentReviewRequest | null>(null)
	const [fileBusy, setFileBusy] = React.useState<{
		id: string
		action: "view" | "download"
	} | null>(null)

	React.useEffect(() => {
		const offPending = subscribeQlegalEvent("document-review:pending", () => {
			void queryClient.invalidateQueries()
		})
		const offUpdated = subscribeQlegalEvent("document-review:updated", () => {
			void queryClient.invalidateQueries()
		})
		return () => {
			offPending()
			offUpdated()
		}
	}, [queryClient])

	const counts = React.useMemo(() => {
		const c: Record<StatusTab, number> = {
			all: requests.length,
			pending: 0,
			approved: 0,
			rejected: 0,
			cancelled: 0,
		}
		for (const r of requests) c[r.status]++
		return c
	}, [requests])

	const filtered = React.useMemo(
		() => (activeTab === "all" ? requests : requests.filter(r => r.status === activeTab)),
		[requests, activeTab]
	)

	async function cancelRequest(id: string) {
		try {
			await cancelMutation.mutateAsync(id)
			toast.success("Request cancelled")
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Cancellation failed")
		}
	}

	async function viewFile(fileObjectId: string) {
		setFileBusy({ id: fileObjectId, action: "view" })
		try {
			await openReviewFile(fileObjectId)
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not open document")
		} finally {
			setFileBusy(null)
		}
	}

	async function downloadFile(fileObjectId: string, name: string | null) {
		setFileBusy({ id: fileObjectId, action: "download" })
		try {
			await downloadReviewFile(fileObjectId, name ?? "document.pdf")
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not download document")
		} finally {
			setFileBusy(null)
		}
	}

	return (
		<>
			<Tabs value={activeTab} onValueChange={v => setActiveTab(v as StatusTab)} className="w-full">
				<TabsList className="h-auto w-full max-w-full flex-wrap justify-start gap-1">
					{TAB_ORDER.map(t => (
						<TabsTrigger key={t.key} value={t.key} className="shrink-0">
							{t.label}
							<Badge variant="secondary" className="ml-1.5 text-[10px]">
								{counts[t.key]}
							</Badge>
						</TabsTrigger>
					))}
				</TabsList>

				<TabsContent value={activeTab} className="space-y-3 pt-4">
					{listQuery.isLoading ? (
						<div className="text-muted-foreground text-sm">Loading…</div>
					) : listQuery.isError ? (
						<div className="text-destructive text-sm">
							Could not load review requests. Please try again.
						</div>
					) : filtered.length === 0 ? (
						<div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
							No {activeTab === "all" ? "" : `${activeTab} `}review requests yet.
						</div>
					) : (
						filtered.map(r => (
							<Card key={r.id}>
								<CardContent className="space-y-3 py-4">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold">{r.title}</p>
											<p className="text-muted-foreground text-xs">
												{isEnp ? `From ${r.clientName}` : `To ${r.enpName}`} ·{" "}
												{formatTimestamp(r.createdAt)}
											</p>
										</div>
										<div className="flex shrink-0 items-center gap-2">
											<Badge variant={STATUS_VARIANT[r.status]} className="text-[10px]">
												{r.status}
											</Badge>
											{!isEnp && r.status === "pending" && (
												<Button
													size="sm"
													variant="outline"
													onClick={() => void cancelRequest(r.id)}
													disabled={cancelMutation.isPending}
												>
													Cancel
												</Button>
											)}
											{isEnp && r.status === "pending" && (
												<>
													<Button size="sm" variant="outline" onClick={() => setRejectTarget(r)}>
														Reject
													</Button>
													<Button size="sm" onClick={() => setApproveTarget(r)}>
														Approve
													</Button>
												</>
											)}
										</div>
									</div>

									<div className="grid gap-2 text-xs sm:grid-cols-3">
										<div>
											<p className="text-muted-foreground uppercase">Session Mode</p>
											<p className="mt-0.5">{sessionModeLabel(r.sessionMode)}</p>
										</div>
										<div>
											<p className="text-muted-foreground uppercase">Notarization</p>
											<p className="mt-0.5">
												{r.notarizationType
													? notarizationLabel(r.notarizationType)
													: "Notary decides"}
											</p>
										</div>
										<div>
											<p className="text-muted-foreground uppercase">Files</p>
											<p className="mt-0.5">{r.files.length}</p>
										</div>
									</div>

									{r.files.length > 0 && (
										<div className="space-y-1.5">
											{r.files.map(f => {
												const isViewBusy =
													fileBusy?.id === f.fileObjectId && fileBusy.action === "view"
												const isDownloadBusy =
													fileBusy?.id === f.fileObjectId && fileBusy.action === "download"
												const anyBusy = fileBusy !== null
												return (
													<div
														key={f.fileObjectId}
														className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs"
													>
														<div className="min-w-0 flex-1">
															<p className="truncate font-medium">{f.displayName ?? "Document"}</p>
															<p className="text-muted-foreground">{formatBytes(f.sizeBytes)}</p>
														</div>
														{isEnp && (
															<div className="flex shrink-0 items-center gap-1">
																<Button
																	type="button"
																	size="sm"
																	variant="ghost"
																	className="h-7 px-2"
																	onClick={() => void viewFile(f.fileObjectId)}
																	disabled={anyBusy}
																	aria-label={`View ${f.displayName ?? "document"}`}
																>
																	<HugeiconsIcon
																		icon={ViewFreeIcons}
																		className="size-3.5"
																		strokeWidth={2}
																	/>
																	<span className="ml-1">{isViewBusy ? "Opening…" : "View"}</span>
																</Button>
																<Button
																	type="button"
																	size="sm"
																	variant="ghost"
																	className="h-7 px-2"
																	onClick={() => void downloadFile(f.fileObjectId, f.displayName)}
																	disabled={anyBusy}
																	aria-label={`Download ${f.displayName ?? "document"}`}
																>
																	<HugeiconsIcon
																		icon={Download04FreeIcons}
																		className="size-3.5"
																		strokeWidth={2}
																	/>
																	<span className="ml-1">
																		{isDownloadBusy ? "Saving…" : "Download"}
																	</span>
																</Button>
															</div>
														)}
													</div>
												)
											})}
										</div>
									)}

									{r.proposedSlots.length > 0 && r.status === "pending" && (
										<div>
											<p className="text-muted-foreground text-xs uppercase">
												Client preferred times
											</p>
											<div className="mt-1 flex flex-wrap gap-1.5">
												{r.proposedSlots.map(s => (
													<Badge key={s} variant="secondary" className="text-[10px]">
														{formatSlotIso(s)}
													</Badge>
												))}
											</div>
										</div>
									)}

									{r.note && (
										<div>
											<p className="text-muted-foreground text-xs uppercase">Notes</p>
											<p className="mt-0.5 text-xs whitespace-pre-wrap">{r.note}</p>
										</div>
									)}

									{r.status === "rejected" && r.rejectionReason && (
										<div className="bg-destructive/10 text-destructive rounded-md p-2 text-xs">
											<p className="font-semibold uppercase">Rejected</p>
											<p className="mt-0.5">{r.rejectionReason}</p>
										</div>
									)}

									{r.status === "approved" &&
										r.approvedPath === "meeting" &&
										r.approvedAppointmentId && (
											<div className="bg-primary/10 text-foreground rounded-md p-2 text-xs">
												Meeting scheduled. See it on the{" "}
												<a className="underline underline-offset-2" href="/appointments">
													Appointments
												</a>{" "}
												page.
											</div>
										)}

									{r.status === "approved" && r.approvedPath === "quicksign" && isEnp && (
										<div className="bg-primary/10 text-foreground rounded-md p-2 text-xs">
											QuickSign (in-person) queue
											{r.quicksignQueue
												? ` — document ${r.quicksignQueue.currentIndex} of ${r.quicksignQueue.totalDocuments}`
												: ""}
											.{" "}
											<a className="underline underline-offset-2" href="/quicksign">
												Continue in QuickSign
											</a>
										</div>
									)}
								</CardContent>
							</Card>
						))
					)}
				</TabsContent>
			</Tabs>

			<ApproveReviewDialog
				request={approveTarget}
				open={approveTarget !== null}
				onOpenChange={open => !open && setApproveTarget(null)}
			/>
			<RejectReviewDialog
				request={rejectTarget}
				open={rejectTarget !== null}
				onOpenChange={open => !open && setRejectTarget(null)}
			/>
		</>
	)
}
