"use client"

import * as React from "react"

import type { CommissionRecord } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
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
import { useCommissionRecordsQuery } from "@/features/compliance-audit/api/compliance-audit.hooks"

const STATUS_BADGE: Record<
	CommissionRecord["commissionStatus"],
	"default" | "secondary" | "destructive"
> = {
	active: "default",
	expired: "destructive",
	suspended: "secondary",
}

function formatDate(iso: string | null): string {
	if (!iso) return "-"
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
	return d.toISOString().slice(0, 10)
}

export function CommissionRecordsContent() {
	const [enpUserId, setEnpUserId] = React.useState("")
	const [offset, setOffset] = React.useState(0)
	const limit = 50
	const filter = React.useMemo(
		() => ({ enpUserId: enpUserId.trim() || undefined, limit, offset }),
		[enpUserId, offset]
	)
	const {
		data: records = [],
		isPending,
		isError,
		error,
		refetch,
	} = useCommissionRecordsQuery(filter)

	return (
		<Card>
			<CardHeader>
				<CardTitle>Commission Records</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{isError && (
					<div className="bg-destructive/10 text-destructive flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm">
						<span>
							{error instanceof Error ? error.message : "Failed to load commission records"}
						</span>
						<Button variant="outline" size="sm" onClick={() => refetch()}>
							Retry
						</Button>
					</div>
				)}

				<div className="flex flex-wrap items-center gap-3">
					<Input
						placeholder="Filter by ENP user ID"
						aria-label="Filter by ENP user ID"
						value={enpUserId}
						onChange={event => {
							setEnpUserId(event.target.value)
							setOffset(0)
						}}
						className="max-w-sm"
					/>
				</div>

				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>ENP</TableHead>
							<TableHead>Email</TableHead>
							<TableHead>NPN</TableHead>
							<TableHead>Valid Until</TableHead>
							<TableHead>PTR / IBP</TableHead>
							<TableHead>Address</TableHead>
							<TableHead>SC Status</TableHead>
							<TableHead>Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isPending && (
							<TableRow>
								<TableCell colSpan={8} className="text-muted-foreground text-center">
									Loading commission records…
								</TableCell>
							</TableRow>
						)}
						{!isPending &&
							records.map(record => (
								<TableRow key={record.enpUserId}>
									<TableCell className="font-medium">{record.enpName}</TableCell>
									<TableCell className="text-muted-foreground text-sm">{record.email}</TableCell>
									<TableCell className="text-sm">{record.npnCommissionNo ?? "-"}</TableCell>
									<TableCell className="text-sm">
										{formatDate(record.commissionValidUntil)}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{record.ptrNo ?? "-"} / {record.ibpNo ?? "-"}
									</TableCell>
									<TableCell className="text-muted-foreground max-w-xs truncate text-sm">
										{record.notaryAddress ?? "-"}
									</TableCell>
									<TableCell className="text-sm capitalize">
										{record.scCommissionStatus ?? "—"}
									</TableCell>
									<TableCell>
										<Badge variant={STATUS_BADGE[record.commissionStatus]}>
											{record.commissionStatus}
										</Badge>
									</TableCell>
								</TableRow>
							))}
						{!isPending && !isError && records.length === 0 && (
							<TableRow>
								<TableCell colSpan={8} className="text-muted-foreground text-center">
									No commission records match the current filter.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>

				<div className="flex items-center justify-end gap-2">
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
						disabled={records.length < limit || isPending}
						onClick={() => setOffset(offset + limit)}
					>
						Next
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
