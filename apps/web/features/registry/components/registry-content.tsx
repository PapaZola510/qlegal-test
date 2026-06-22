"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import type { EnbAccessRequest, RegistryAct as RegistryActApi, UserProfile } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import { orpc } from "@/services/orpc/client"
import { subscribeQlegalEvent } from "@/services/ws/ws-client"

import {
	useEnbAccessRequestsQuery,
	useRegistryActsQuery,
	useRegistryBulkScSyncMutation,
	useSubmitMonthlyNotarialBookMutation,
} from "../api/registry.hooks"
import {
	displayEntryNumber,
	generateCsvContent,
	type RegistryAct,
	type RegistryActType,
} from "../lib/fixtures"
import { mapApiRegistryActToRow } from "../lib/map-api-registry-act"
import {
	actMatchesSearch,
	bookYearKey,
	buildBookFilterOptions,
	compareActsByBookOrder,
	compareActsByNewest,
	currentBookYearKey,
	labelForBookYearKey,
	resolveBookFilterKey,
	type BookYearKey,
	type RegistryBookSort,
	type RegistryPageSize,
} from "../lib/notarial-book-filters"
import {
	buildNotarialRegisterHtml,
	openNotarialRegisterPrintWindow,
} from "../lib/notarial-register-export"
import { BulkSyncDialog } from "./bulk-sync-dialog"
import { EnbAccessRequestsPanel } from "./enb-access-requests-panel"
import { MonthlyBookNavigator } from "./monthly-book-navigator"
import { RecordIncompleteActDialog } from "./record-incomplete-act-dialog"
import { RegistryFiltersToolbar } from "./registry-filters-toolbar"
import { RegistryKpiTiles } from "./registry-kpi-tiles"
import { RegistryTable } from "./registry-table"
import { RegistryTablePagination } from "./registry-table-pagination"
import { RoleGate } from "./role-gate"
import { SubmitMonthlyNotarialBookDialog } from "./submit-monthly-notarial-book-dialog"

const DEFAULT_REGISTRY_PAGE_SIZE: RegistryPageSize = 10

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
const registryApi = orpc as any

export function RegistryContent() {
	const profileQ = useAuthProfileMeQuery()
	const profile = profileQ.data as UserProfile | undefined
	const role = profile?.role
	const isEnp = role === "enp"

	const listQ = useRegistryActsQuery(Boolean(isEnp && !profileQ.isPending))
	const enbRequestsQ = useEnbAccessRequestsQuery(Boolean(isEnp && !profileQ.isPending))
	const queryClient = useQueryClient()
	const bulkMutation = useRegistryBulkScSyncMutation()
	const submitMonthlyMutation = useSubmitMonthlyNotarialBookMutation()
	const [decideRequestId, setDecideRequestId] = React.useState<string | null>(null)
	const [submitMonthlyOpen, setSubmitMonthlyOpen] = React.useState(false)

	const rawList = Array.isArray(listQ.data) ? (listQ.data as RegistryActApi[]) : []
	const acts = React.useMemo(() => rawList.map(mapApiRegistryActToRow), [rawList])
	const loadFailed = listQ.isError

	const [search, setSearch] = React.useState("")
	const [actTypeFilter, setActTypeFilter] = React.useState<RegistryActType | "all">("all")
	const activeBookKey = React.useMemo(() => currentBookYearKey(), [])
	const [bookFilter, setBookFilter] = React.useState<BookYearKey | "all">(activeBookKey)
	const [sortBy, setSortBy] = React.useState<RegistryBookSort>("newest")
	const [pageSize, setPageSize] = React.useState<RegistryPageSize>(DEFAULT_REGISTRY_PAGE_SIZE)
	const [page, setPage] = React.useState(1)
	const [bulkOpen, setBulkOpen] = React.useState(false)
	const [incompleteOpen, setIncompleteOpen] = React.useState(false)

	const bookFilterOptions = React.useMemo(
		() => buildBookFilterOptions(acts, { anchorKey: activeBookKey }),
		[acts, activeBookKey]
	)
	const resolvedBookKey = React.useMemo(() => resolveBookFilterKey(bookFilter), [bookFilter])

	const filtered = React.useMemo(() => {
		let result = acts
		if (actTypeFilter !== "all") {
			result = result.filter(a => a.actType === actTypeFilter)
		}
		if (resolvedBookKey) {
			result = result.filter(a => bookYearKey(a) === resolvedBookKey)
		}
		if (search.trim()) {
			const q = search.trim()
			result = result.filter(a => actMatchesSearch(a, q))
		}
		const sorted = [...result]
		sorted.sort(sortBy === "book" ? compareActsByBookOrder : compareActsByNewest)
		return sorted
	}, [acts, actTypeFilter, resolvedBookKey, search, sortBy])

	const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
	const safePage = Math.min(page, totalPages)
	const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

	React.useEffect(() => {
		if (!isEnp) return
		return subscribeQlegalEvent("signed:ctc-payment-updated", () => {
			void queryClient.invalidateQueries({
				queryKey: registryApi.registry.listEnbAccessRequests.key(),
			})
		})
	}, [isEnp, queryClient])

	React.useEffect(() => {
		setPage(1)
	}, [search, actTypeFilter, bookFilter, sortBy, pageSize])

	const kpis = React.useMemo(() => {
		const total = acts.length
		const currentBookCount = acts.filter(a => bookYearKey(a) === activeBookKey).length
		const pendingSync = acts.filter(
			a => a.scSync === "pending" || a.scSync === "not_started"
		).length
		return {
			total,
			currentBook: {
				label: labelForBookYearKey(activeBookKey),
				count: currentBookCount,
			},
			pendingSync,
		}
	}, [acts, activeBookKey])

	const enbRequestsFromActs = React.useMemo(() => {
		const map = new Map<string, EnbAccessRequest>()
		for (const act of acts) {
			for (const req of act.enbAccessRequests ?? []) {
				map.set(req.id, req)
			}
		}
		return [...map.values()]
	}, [acts])

	const enbRequestsFromQuery: EnbAccessRequest[] = Array.isArray(enbRequestsQ.data)
		? (enbRequestsQ.data as EnbAccessRequest[])
		: []

	const enbRequests = React.useMemo(() => {
		const map = new Map<string, EnbAccessRequest>()
		for (const req of enbRequestsFromActs) map.set(req.id, req)
		for (const req of enbRequestsFromQuery) map.set(req.id, req)
		return [...map.values()].sort(
			(a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
		)
	}, [enbRequestsFromActs, enbRequestsFromQuery])

	const pendingCtcCount = enbRequests.filter(
		r => r.certifiedTrueCopy && r.outcome === "pending"
	).length

	const reviewEnbRequest = React.useCallback((request: EnbAccessRequest) => {
		setDecideRequestId(request.id)
		document.getElementById("enb-access-requests")?.scrollIntoView({ behavior: "smooth" })
	}, [])

	const registryActOptions = React.useMemo(
		() =>
			acts.map(a => ({
				id: a.id,
				label: `${displayEntryNumber(a)} — ${a.documentTitle}`,
			})),
		[acts]
	)

	const pendingIds = React.useMemo(
		() => acts.filter(a => a.scSync === "pending" || a.scSync === "not_started").map(a => a.id),
		[acts]
	)

	const monthlyBookActs = React.useMemo(() => {
		if (!resolvedBookKey) return []
		return acts.filter(a => bookYearKey(a) === resolvedBookKey)
	}, [acts, resolvedBookKey])

	const monthlyBookPendingSync = React.useMemo(
		() => monthlyBookActs.filter(a => a.scSync === "pending" || a.scSync === "not_started").length,
		[monthlyBookActs]
	)

	const runSync = React.useCallback(
		async (id: string) => {
			await bulkMutation.mutateAsync([id])
		},
		[bulkMutation]
	)

	const handleExportCsv = React.useCallback(() => {
		const csv = generateCsvContent(filtered)
		const blob = new Blob([csv], { type: "text/csv" })
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = `registry-export-${new Date().toISOString().slice(0, 10)}.csv`
		a.click()
		URL.revokeObjectURL(url)
	}, [filtered])

	const handleExportPdf = React.useCallback(() => {
		if (!profile || filtered.length === 0) return
		try {
			const html = buildNotarialRegisterHtml(filtered, {
				profile,
				assetOrigin: window.location.origin,
			})
			openNotarialRegisterPrintWindow(html)
		} catch (e) {
			const message = e instanceof Error ? e.message : "Could not open PDF export"
			toast.error(message)
		}
	}, [filtered, profile])

	if (profileQ.isPending) {
		return <p className="text-muted-foreground text-sm">Loading…</p>
	}

	if (!isEnp) {
		return <RoleGate role={role ?? "client"} />
	}

	if (listQ.isLoading) {
		return <p className="text-muted-foreground text-sm">Loading notarial book…</p>
	}

	const tableEmptyMessage =
		acts.length === 0
			? "No registry entries yet. Acts are added when you end a meeting, after DocOnChain marks each document as completed."
			: "No registry acts match your search or filters."

	return (
		<div className="w-full min-w-0 space-y-4">
			{loadFailed ? (
				<div className="bg-destructive/10 text-destructive border-destructive/30 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
					<span>
						We couldn&apos;t load your notarial book. You can retry, or continue — new entries will
						appear once the API responds.
					</span>
					<Button
						size="sm"
						variant="outline"
						className="border-destructive/40 shrink-0"
						onClick={() => void listQ.refetch()}
					>
						Retry
					</Button>
				</div>
			) : null}

			<RegistryKpiTiles
				total={kpis.total}
				currentBook={kpis.currentBook}
				pendingSync={kpis.pendingSync}
			/>

			{pendingCtcCount > 0 ? (
				<div className="bg-primary/10 border-primary/30 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
					<p>
						<strong className="font-medium">{pendingCtcCount}</strong> principal certified true copy
						request{pendingCtcCount === 1 ? "" : "s"} need your review.
					</p>
					<Button
						size="sm"
						variant="secondary"
						onClick={() =>
							document.getElementById("enb-access-requests")?.scrollIntoView({ behavior: "smooth" })
						}
					>
						Review requests
					</Button>
				</div>
			) : null}

			<MonthlyBookNavigator
				bookKey={resolvedBookKey}
				activeBookKey={activeBookKey}
				entryCount={resolvedBookKey ? monthlyBookActs.length : acts.length}
				onSelectBook={key => setBookFilter(key)}
				onSubmitBook={resolvedBookKey ? () => setSubmitMonthlyOpen(true) : undefined}
				submitDisabled={submitMonthlyMutation.isPending}
			/>

			<RegistryFiltersToolbar
				search={search}
				onSearchChange={setSearch}
				bookFilter={bookFilter}
				onBookFilterChange={setBookFilter}
				bookOptions={bookFilterOptions}
				activeBookKey={activeBookKey}
				sortBy={sortBy}
				onSortChange={setSortBy}
				actTypeFilter={actTypeFilter}
				onActTypeFilterChange={setActTypeFilter}
				pendingSyncCount={pendingIds.length}
				onRecordIncomplete={() => setIncompleteOpen(true)}
				onBulkSync={() => setBulkOpen(true)}
				onExportCsv={handleExportCsv}
				onExportPdf={handleExportPdf}
				exportPdfDisabled={filtered.length === 0}
			/>

			<RegistryTable
				acts={paged}
				runSync={runSync}
				emptyMessage={tableEmptyMessage}
				enbAccessRequests={enbRequests}
				onReviewEnbRequest={reviewEnbRequest}
			/>

			<RegistryTablePagination
				page={safePage}
				totalPages={totalPages}
				pageSize={pageSize}
				totalItems={filtered.length}
				onPageChange={setPage}
				onPageSizeChange={size => {
					setPageSize(size)
					setPage(1)
				}}
			/>

			<BulkSyncDialog
				open={bulkOpen}
				onOpenChange={setBulkOpen}
				pendingIds={pendingIds}
				acts={acts}
				runBulkSync={ids => bulkMutation.mutateAsync(ids)}
			/>

			{resolvedBookKey ? (
				<SubmitMonthlyNotarialBookDialog
					open={submitMonthlyOpen}
					onOpenChange={setSubmitMonthlyOpen}
					bookYearKey={resolvedBookKey}
					entryCount={monthlyBookActs.length}
					pendingSyncCount={monthlyBookPendingSync}
					onSubmit={input => submitMonthlyMutation.mutateAsync(input)}
				/>
			) : null}

			<RecordIncompleteActDialog open={incompleteOpen} onOpenChange={setIncompleteOpen} />

			<div className="rounded-lg border p-4">
				<EnbAccessRequestsPanel
					registryActOptions={registryActOptions}
					registryActs={acts}
					requests={enbRequests}
					isLoading={enbRequestsQ.isLoading}
					isError={enbRequestsQ.isError}
					onRetry={() => void enbRequestsQ.refetch()}
					openDecideRequestId={decideRequestId}
					onOpenDecideRequestIdChange={setDecideRequestId}
				/>
			</div>
		</div>
	)
}
