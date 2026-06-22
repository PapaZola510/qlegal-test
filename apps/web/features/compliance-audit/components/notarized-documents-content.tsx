"use client"

import * as React from "react"
import { toast } from "sonner"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/core/components/ui/dialog"
import { Input } from "@/core/components/ui/input"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/core/components/ui/table"
import {
	notarizedPdfOpenErrorMessage,
	openNotarizedPdfFromApiUrl,
} from "@/features/appointments/lib/open-notarized-pdf"
import {
	useNotarizedDocumentQuery,
	useNotarizedDocumentsQuery,
} from "@/features/compliance-audit/api/compliance-audit.hooks"
import { env } from "@/env"

function scStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" {
	if (status === "sync_failed") return "destructive"
	if (status === "synced") return "default"
	return "secondary"
}

function formatExecutedAt(iso: string): string {
	return new Date(iso).toISOString().slice(0, 10)
}

export function NotarizedDocumentsContent({
	initialEnpUserId,
	initialBookNo,
}: {
	initialEnpUserId?: string
	initialBookNo?: string
}) {
	const [enpUserId, setEnpUserId] = React.useState(initialEnpUserId ?? "")
	const [bookNo, setBookNo] = React.useState(initialBookNo ?? "")
	const [scStatus, setScStatus] = React.useState("")
	const [selectedId, setSelectedId] = React.useState<string | null>(null)
	const [offset, setOffset] = React.useState(0)
	const limit = 5
	const filter = React.useMemo(
		() => ({
			enpUserId: enpUserId.trim() || undefined,
			bookNo: bookNo.trim() || undefined,
			scStatus: scStatus.trim() ? (scStatus.trim() as never) : undefined,
			limit,
			offset,
		}),
		[bookNo, enpUserId, offset, scStatus]
	)
	const docs = useNotarizedDocumentsQuery(filter)
	const detail = useNotarizedDocumentQuery(selectedId)
	const rows = docs.data ?? []

	React.useEffect(() => {
		setOffset(0)
	}, [enpUserId, bookNo, scStatus])
	const apiBase = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
	const [openingId, setOpeningId] = React.useState<string | null>(null)

	async function handleViewPdf(actId: string) {
		const viewHref = `${apiBase}/v1/compliance/documents/${actId}/notarized-pdf`
		setOpeningId(actId)
		try {
			await openNotarizedPdfFromApiUrl(viewHref)
		} catch (e) {
			toast.error(notarizedPdfOpenErrorMessage(e))
		} finally {
			setOpeningId(null)
		}
	}

	return (
		<Card className="min-w-0 overflow-hidden">
			<CardHeader>
				<CardTitle>Notarized Documents</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
					<Input
						placeholder="ENP user ID"
						aria-label="Filter by ENP user ID"
						value={enpUserId}
						onChange={e => setEnpUserId(e.target.value)}
						className="min-w-0"
					/>
					<Input
						placeholder="Book no."
						aria-label="Filter by book number"
						value={bookNo}
						onChange={e => setBookNo(e.target.value)}
						className="min-w-0"
					/>
					<Input
						placeholder="SC status"
						aria-label="Filter by SC status"
						value={scStatus}
						onChange={e => setScStatus(e.target.value)}
						className="min-w-0 sm:col-span-2 xl:col-span-1"
					/>
				</div>

				{docs.isPending && (
					<p className="text-muted-foreground text-center text-sm">Loading documents…</p>
				)}

				{!docs.isPending && rows.length > 0 && (
					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="min-w-[9rem]">Act</TableHead>
									<TableHead className="min-w-[10rem]">Document</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Book / page</TableHead>
									<TableHead>Executed</TableHead>
									<TableHead>SC status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map(doc => (
									<TableRow key={doc.id} className="align-middle">
										<TableCell className="font-mono text-xs">{doc.actNumber}</TableCell>
										<TableCell className="max-w-[12rem] truncate text-xs" title={doc.title}>
											{doc.title}
										</TableCell>
										<TableCell className="text-xs capitalize">{doc.actType}</TableCell>
										<TableCell className="text-xs whitespace-nowrap">
											{doc.bookNo ?? "—"} / {doc.pageNo ?? "—"}
										</TableCell>
										<TableCell className="text-xs whitespace-nowrap">
											{formatExecutedAt(doc.executedAt)}
										</TableCell>
										<TableCell>
											<Badge
												variant={scStatusBadgeVariant(doc.scStatus)}
												className="text-[10px] capitalize"
											>
												{doc.scStatus}
											</Badge>
										</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-1.5">
												{doc.documentFileObjectId ? (
													<Button
														variant="outline"
														size="sm"
														className="h-7 px-2 text-xs"
														disabled={openingId === doc.id}
														onClick={() => void handleViewPdf(doc.id)}
													>
														{openingId === doc.id ? "…" : "View PDF"}
													</Button>
												) : (
													<span className="text-muted-foreground text-xs">No PDF</span>
												)}
												<Button
													variant="ghost"
													size="sm"
													className="h-7 px-2 text-xs"
													onClick={() => setSelectedId(doc.id)}
												>
													Details
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}

				{!docs.isPending && !docs.isError && rows.length === 0 && (
					<p className="text-muted-foreground py-6 text-center text-sm">
						No documents match the current filters.
					</p>
				)}

				{(rows.length > 0 || offset > 0) && (
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-muted-foreground text-xs">
							{rows.length > 0
								? `Showing ${offset + 1}–${offset + rows.length}`
								: "No more documents on this page"}
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={offset === 0 || docs.isPending}
								onClick={() => setOffset(Math.max(0, offset - limit))}
							>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={rows.length < limit || docs.isPending}
								onClick={() => setOffset(offset + limit)}
							>
								Next
							</Button>
						</div>
					</div>
				)}
			</CardContent>
			<Dialog open={Boolean(selectedId)} onOpenChange={open => !open && setSelectedId(null)}>
				<DialogContent className="max-h-[min(90vh,640px)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto sm:w-full">
					<DialogHeader>
						<DialogTitle>Document detail</DialogTitle>
					</DialogHeader>
					{detail.isPending && (
						<p className="text-muted-foreground text-sm">Loading logged detail…</p>
					)}
					{detail.data && (
						<div className="space-y-2 text-sm">
							<p className="font-medium break-words">{detail.data.title}</p>
							<p>
								Act {detail.data.actNumber} - {detail.data.actType}
							</p>
							<p className="text-muted-foreground">ENP: {detail.data.enpName}</p>
							<p className="text-muted-foreground break-all">
								Linked file: {detail.data.documentFileObjectId ?? "—"}
							</p>
							<p className="text-muted-foreground">
								Cached URL: {detail.data.hasDocument ? "Yes" : "No"}
							</p>
							{detail.data.documentFileObjectId && (
								<Button
									variant="outline"
									size="sm"
									className="mt-2 w-full sm:w-auto"
									disabled={openingId === detail.data.id}
									onClick={() => void handleViewPdf(detail.data!.id)}
								>
									{openingId === detail.data.id ? "Loading…" : "View notarized PDF"}
								</Button>
							)}
						</div>
					)}
				</DialogContent>
			</Dialog>
		</Card>
	)
}
