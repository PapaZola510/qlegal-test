"use client"

import * as React from "react"

import type { EnbAccessRequest } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/components/ui/table"
import { cn } from "@/core/lib/utils"

import {
	displayEntryNumber,
	SC_SYNC_LABELS,
	type RegistryAct,
	type SCSyncStatus,
} from "../lib/fixtures"
import { bookNoFromAct } from "../lib/notarial-book-filters"
import { scNotarialActLabel } from "../lib/sc-notarial-act-labels"
import { RegistryExpandPanel } from "./registry-expand-panel"
import { RegistryNotarizedPdfCell } from "./registry-notarized-pdf-cell"
import { ScSyncButton } from "./sc-sync-button"

interface RegistryTableProps {
	acts: RegistryAct[]
	runSync: (id: string) => Promise<void>
	/** Shown when `acts` is empty (e.g. no rows yet vs filters excluded everything). */
	emptyMessage?: string
	enbAccessRequests?: EnbAccessRequest[]
	onReviewEnbRequest?: (request: EnbAccessRequest) => void
}

const SC_VARIANT: Record<SCSyncStatus, "default" | "secondary" | "destructive" | "outline"> = {
	synced: "default",
	pending: "outline",
	failed: "destructive",
	not_started: "secondary",
}

export function RegistryTable({
	acts,
	runSync,
	emptyMessage,
	enbAccessRequests = [],
	onReviewEnbRequest,
}: RegistryTableProps) {
	const [expandedId, setExpandedId] = React.useState<string | null>(null)
	const scrollRef = React.useRef<HTMLDivElement>(null)
	const [panelWidth, setPanelWidth] = React.useState(0)

	React.useEffect(() => {
		const el = scrollRef.current
		if (!el) return

		const updateWidth = () => setPanelWidth(el.clientWidth)
		updateWidth()

		const observer = new ResizeObserver(updateWidth)
		observer.observe(el)
		return () => observer.disconnect()
	}, [])

	const toggleExpanded = React.useCallback((id: string) => {
		setExpandedId(current => {
			const next = current === id ? null : id
			if (next && scrollRef.current) {
				scrollRef.current.scrollLeft = 0
			}
			return next
		})
	}, [])

	if (acts.length === 0) {
		return (
			<div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
				{emptyMessage ?? "No registry acts match your filters."}
			</div>
		)
	}

	return (
		<div className="min-w-0 overflow-hidden rounded-lg border">
			<div ref={scrollRef} className="relative max-w-full min-w-0 overflow-x-auto">
				<table
					data-slot="table"
					className={cn("w-full min-w-[80rem] table-fixed caption-bottom text-sm")}
				>
					<TableHeader>
						<TableRow>
							<TableHead className="w-8" />
							<TableHead className="w-[8.5rem]">Entry no.</TableHead>
							<TableHead className="w-[4.5rem] text-center">Book</TableHead>
							<TableHead className="w-[4rem] text-center">Page</TableHead>
							<TableHead className="w-[6.5rem]">Date</TableHead>
							<TableHead className="w-[11rem]">Document</TableHead>
							<TableHead className="w-[7.5rem]">Notarial act</TableHead>
							<TableHead className="w-[4.5rem] text-right">Fee</TableHead>
							<TableHead className="w-[6.5rem]">SC Sync</TableHead>
							<TableHead className="w-[9rem]">NRID</TableHead>
							<TableHead className="w-[10rem]">Project UUID</TableHead>
							<TableHead className="w-[11rem]">Notarized PDF</TableHead>
							<TableHead className="w-[5.5rem]">Sync</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{acts.map(act => {
							const actAccessRequests =
								act.enbAccessRequests.length > 0
									? act.enbAccessRequests
									: enbAccessRequests.filter(
											r =>
												r.registryActId === act.id ||
												(Boolean(act.documentFileObjectId) &&
													r.documentFileObjectId === act.documentFileObjectId)
										)
							const pendingCtc = actAccessRequests.find(
								r => r.certifiedTrueCopy && r.outcome === "pending"
							)

							return (
								<React.Fragment key={act.id}>
									<TableRow
										className={cn(
											"cursor-pointer",
											expandedId === act.id && "bg-muted/40 hover:bg-muted/40"
										)}
										onClick={() => toggleExpanded(act.id)}
									>
										<TableCell className="text-muted-foreground text-xs">
											{expandedId === act.id ? "▾" : "▸"}
										</TableCell>
										<TableCell className="font-mono text-xs">
											<span className="block truncate" title={displayEntryNumber(act)}>
												{displayEntryNumber(act)}
											</span>
											{act.completionStatus === "incomplete" ? (
												<Badge variant="outline" className="mt-1 text-[9px]">
													Incomplete
												</Badge>
											) : null}
											{pendingCtc ? (
												<Badge variant="secondary" className="mt-1 text-[9px]">
													CTC pending
												</Badge>
											) : null}
										</TableCell>
										<TableCell className="text-center font-mono text-xs tabular-nums">
											{bookNoFromAct(act) ?? "—"}
										</TableCell>
										<TableCell className="text-center font-mono text-xs tabular-nums">
											{act.pageNo?.trim() || "—"}
										</TableCell>
										<TableCell className="text-xs">{act.date}</TableCell>
										<TableCell className="truncate text-xs" title={act.documentTitle}>
											{act.documentTitle}
										</TableCell>
										<TableCell className="truncate text-xs" title={scNotarialActLabel(act.actType)}>
											{scNotarialActLabel(act.actType)}
										</TableCell>
										<TableCell className="text-right text-xs tabular-nums">
											₱{act.fee.toLocaleString()}
										</TableCell>
										<TableCell>
											<Badge variant={SC_VARIANT[act.scSync]} className="text-[10px]">
												{SC_SYNC_LABELS[act.scSync]}
											</Badge>
										</TableCell>
										<TableCell className="truncate text-xs" title={act.nrid}>
											{act.nrid}
										</TableCell>
										<TableCell
											className="truncate font-mono text-xs"
											title={act.projectUuid ?? undefined}
										>
											{act.projectUuid ?? "—"}
										</TableCell>
										<TableCell
											onClick={e => e.stopPropagation()}
											className="align-top whitespace-normal"
										>
											<RegistryNotarizedPdfCell act={act} />
										</TableCell>
										<TableCell onClick={e => e.stopPropagation()} className="whitespace-normal">
											<ScSyncButton act={act} runSync={runSync} />
										</TableCell>
									</TableRow>
									{expandedId === act.id ? (
										<TableRow className="hover:bg-transparent">
											<TableCell colSpan={13} className="min-w-0 p-0 whitespace-normal">
												<div
													className="bg-muted/30 sticky left-0 border-t"
													style={panelWidth > 0 ? { width: panelWidth } : undefined}
												>
													<RegistryExpandPanel
														act={act}
														accessRequests={actAccessRequests}
														onReviewAccessRequest={onReviewEnbRequest}
													/>
												</div>
											</TableCell>
										</TableRow>
									) : null}
								</React.Fragment>
							)
						})}
					</TableBody>
				</table>
			</div>
		</div>
	)
}
