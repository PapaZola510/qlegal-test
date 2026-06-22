"use client"

import * as React from "react"
import Link from "next/link"

import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/core/components/ui/table"
import { useEnbsQuery } from "@/features/compliance-audit/api/compliance-audit.hooks"

function fmt(iso: string | null): string {
	if (!iso) return "-"
	const d = new Date(iso)
	return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toISOString().slice(0, 10)
}

export function EnbsContent() {
	const [enpUserId, setEnpUserId] = React.useState("")
	const [bookNo, setBookNo] = React.useState("")
	const [offset, setOffset] = React.useState(0)
	const limit = 200
	const filter = React.useMemo(
		() => ({
			enpUserId: enpUserId.trim() || undefined,
			bookNo: bookNo.trim() || undefined,
			limit,
			offset,
		}),
		[bookNo, enpUserId, offset]
	)
	const { data: enbs = [], isPending, isError, error, refetch } = useEnbsQuery(filter)

	return (
		<Card>
			<CardHeader>
				<CardTitle>Electronic Notarial Books</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{isError && (
					<div className="bg-destructive/10 text-destructive flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm">
						<span>{error instanceof Error ? error.message : "Failed to load ENBs"}</span>
						<Button variant="outline" size="sm" onClick={() => refetch()}>
							Retry
						</Button>
					</div>
				)}
				<div className="flex flex-wrap gap-3">
					<Input
						placeholder="ENP user ID"
						aria-label="Filter by ENP user ID"
						value={enpUserId}
						onChange={e => setEnpUserId(e.target.value)}
						className="max-w-xs"
					/>
					<Input
						placeholder="Book no."
						aria-label="Filter by book number"
						value={bookNo}
						onChange={e => setBookNo(e.target.value)}
						className="max-w-xs"
					/>
				</div>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>ENP</TableHead>
							<TableHead>Book No.</TableHead>
							<TableHead>Acts</TableHead>
							<TableHead>First Act</TableHead>
							<TableHead>Last Act</TableHead>
							<TableHead className="text-right">Open</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isPending && (
							<TableRow>
								<TableCell colSpan={6} className="text-muted-foreground text-center">
									Loading ENBs…
								</TableCell>
							</TableRow>
						)}
						{!isPending &&
							enbs.map(enb => (
								<TableRow key={`${enb.enpUserId}-${enb.bookNo}`}>
									<TableCell className="font-medium">{enb.enpName}</TableCell>
									<TableCell>{enb.bookNo}</TableCell>
									<TableCell>{enb.actCount}</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{fmt(enb.firstActAt)}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{fmt(enb.lastActAt)}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-2">
											<Button
												variant="outline"
												size="sm"
												nativeButton={false}
												render={
													<Link
														href={`/compliance/enbs/inspect?enpUserId=${encodeURIComponent(enb.enpUserId)}&bookNo=${encodeURIComponent(enb.bookNo)}`}
													/>
												}
											>
												Inspect
											</Button>
											<Button
												variant="outline"
												size="sm"
												nativeButton={false}
												render={
													<Link
														href={`/compliance/documents?enpUserId=${encodeURIComponent(enb.enpUserId)}&bookNo=${encodeURIComponent(enb.bookNo)}`}
													/>
												}
											>
												Documents
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						{!isPending && !isError && enbs.length === 0 && (
							<TableRow>
								<TableCell
									colSpan={6}
									className="text-muted-foreground space-y-1 px-4 py-6 text-center text-sm"
								>
									<p>No ENBs match the current filters.</p>
									<p>
										New registry acts receive an ENB book and page automatically. If this list is
										empty, filter by ENP user ID from Admin → Users &amp; Roles, or wait until a
										meeting creates registry rows.
									</p>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
				<div className="flex justify-end gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={offset === 0 || isPending}
						onClick={() => setOffset(Math.max(0, offset - limit))}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={enbs.length < limit || isPending}
						onClick={() => setOffset(offset + limit)}
					>
						Next
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
