"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import type { EnbEntry, EnbInspectResult } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationNext,
	PaginationPrevious,
} from "@/core/components/ui/pagination"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/core/components/ui/table"
import { useInspectEnbQuery } from "@/features/compliance-audit/api/compliance-audit.hooks"

const ENB_PAGE_SIZE = 5

function partyNames(entry: EnbEntry): string {
	return entry.parties.length > 0 ? entry.parties.map(p => p.name).join(", ") : "—"
}

function fmt(iso: string | null): string {
	if (!iso) return "—"
	const d = new Date(iso)
	return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toISOString().slice(0, 10)
}

function BookSummary({ data }: { data: EnbInspectResult }) {
	return (
		<div className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
			<p>
				<span className="text-foreground font-medium">ENP:</span> {data.enpName}
			</p>
			<p>
				<span className="text-foreground font-medium">Book:</span> {data.bookNo}
			</p>
			<p>
				<span className="text-foreground font-medium">Entries:</span> {data.actCount}
			</p>
			<p>
				<span className="text-foreground font-medium">Period:</span> {fmt(data.firstActAt)} –{" "}
				{fmt(data.lastActAt)}
			</p>
		</div>
	)
}

export function EnbInspectContent() {
	const searchParams = useSearchParams()
	const [enpUserId, setEnpUserId] = React.useState("")
	const [bookNo, setBookNo] = React.useState("")
	const [page, setPage] = React.useState(1)

	React.useEffect(() => {
		const id = searchParams.get("enpUserId")?.trim()
		const book = searchParams.get("bookNo")?.trim()
		if (id) setEnpUserId(id)
		if (book) setBookNo(book)
	}, [searchParams])

	const filter = React.useMemo(
		() => ({
			enpUserId: enpUserId.trim(),
			bookNo: bookNo.trim(),
			limit: ENB_PAGE_SIZE,
			offset: (page - 1) * ENB_PAGE_SIZE,
		}),
		[bookNo, enpUserId, page]
	)

	const canQuery = Boolean(filter.enpUserId && filter.bookNo)
	const { data, isPending, isFetching, isError, error } = useInspectEnbQuery(filter, canQuery)

	const handleLocate = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setPage(1)
	}

	const totalEntries = data?.actCount ?? 0
	const totalPages = Math.max(1, Math.ceil(totalEntries / ENB_PAGE_SIZE))
	const rangeStart = data && totalEntries > 0 ? (page - 1) * ENB_PAGE_SIZE + 1 : 0
	const rangeEnd = data ? Math.min(page * ENB_PAGE_SIZE, totalEntries) : 0

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Locate book</CardTitle>
				</CardHeader>
				<CardContent>
					<form className="flex flex-wrap gap-3" onSubmit={handleLocate}>
						<Input
							placeholder="ENP user ID"
							aria-label="ENP user ID"
							value={enpUserId}
							onChange={e => {
								setEnpUserId(e.target.value)
								setPage(1)
							}}
							className="max-w-xs"
							required
						/>
						<Input
							placeholder="Book no."
							aria-label="Book number"
							value={bookNo}
							onChange={e => {
								setBookNo(e.target.value)
								setPage(1)
							}}
							className="max-w-xs"
							required
						/>
						<Button type="submit" disabled={!canQuery}>
							Apply
						</Button>
					</form>
					<p className="text-muted-foreground mt-3 text-sm">
						Select a book from{" "}
						<a href="/compliance/enbs" className="text-foreground font-medium underline">
							Electronic Notarial Books
						</a>{" "}
						or enter ENP user ID and book number. Entries load automatically and access is logged
						for the ENF.
					</p>
				</CardContent>
			</Card>

			{canQuery && (isPending || isFetching) && !data && (
				<p className="text-muted-foreground text-sm">Loading ENB entries…</p>
			)}

			{isError && (
				<div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
					{error instanceof Error ? error.message : "Failed to load ENB entries"}
				</div>
			)}

			{data && (
				<Card>
					<CardHeader className="space-y-2">
						<CardTitle>ENB entries (ENF read-only view)</CardTitle>
						<BookSummary data={data} />
						<p className="text-muted-foreground text-sm">
							Showing {rangeStart}–{rangeEnd} of {data.actCount} entries. Virtual inspect and copy
							request are recorded in the access log when this book is opened.
						</p>
					</CardHeader>
					<CardContent className="space-y-4">
						<Table className="min-w-[56rem] table-fixed">
							<TableHeader>
								<TableRow>
									<TableHead className="w-[7.5rem]">Act #</TableHead>
									<TableHead className="w-14">Page</TableHead>
									<TableHead className="w-28">Type</TableHead>
									<TableHead className="w-[22%]">Title</TableHead>
									<TableHead className="w-[26%]">Parties</TableHead>
									<TableHead className="w-28">Executed</TableHead>
									<TableHead className="w-16">Fee</TableHead>
									<TableHead className="w-24">SC</TableHead>
									<TableHead className="w-12">Doc</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.entries.map((entry: EnbEntry) => {
									const parties = partyNames(entry)
									return (
										<TableRow key={entry.id}>
											<TableCell className="max-w-0 truncate font-medium">
												{entry.actNumber}
											</TableCell>
											<TableCell>{entry.pageNo ?? "—"}</TableCell>
											<TableCell className="text-muted-foreground max-w-0 truncate text-xs">
												{entry.actType}
											</TableCell>
											<TableCell className="max-w-0 truncate" title={entry.title}>
												{entry.title}
											</TableCell>
											<TableCell
												className="text-muted-foreground max-w-0 truncate text-xs"
												title={parties}
											>
												{parties}
											</TableCell>
											<TableCell className="text-muted-foreground text-sm">
												{fmt(entry.executedAt)}
											</TableCell>
											<TableCell className="text-muted-foreground text-sm">
												{entry.feePhp !== null ? `₱${entry.feePhp}` : "—"}
											</TableCell>
											<TableCell className="text-muted-foreground max-w-0 truncate text-xs">
												{entry.scStatus}
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{entry.hasDocument ? "Yes" : "—"}
											</TableCell>
										</TableRow>
									)
								})}
								{data.entries.length === 0 && (
									<TableRow>
										<TableCell colSpan={9} className="text-muted-foreground text-center">
											No entries in this book.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
						{totalPages > 1 && (
							<div className="flex flex-col items-center gap-2 pt-2 sm:flex-row sm:justify-between">
								<p className="text-muted-foreground text-xs">
									Page {page} of {totalPages} ({ENB_PAGE_SIZE} per page)
								</p>
								<Pagination className="mx-0 w-auto">
									<PaginationContent>
										<PaginationItem>
											<PaginationPrevious
												href="#"
												text="Previous"
												className={
													page <= 1 || isFetching ? "pointer-events-none opacity-50" : undefined
												}
												onClick={e => {
													e.preventDefault()
													if (page > 1 && !isFetching) setPage(page - 1)
												}}
											/>
										</PaginationItem>
										<PaginationItem>
											<span className="text-muted-foreground px-2 text-xs tabular-nums">
												{rangeStart}–{rangeEnd} of {totalEntries}
											</span>
										</PaginationItem>
										<PaginationItem>
											<PaginationNext
												href="#"
												text="Next"
												className={
													page >= totalPages || isFetching
														? "pointer-events-none opacity-50"
														: undefined
												}
												onClick={e => {
													e.preventDefault()
													if (page < totalPages && !isFetching) setPage(page + 1)
												}}
											/>
										</PaginationItem>
									</PaginationContent>
								</Pagination>
							</div>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	)
}
