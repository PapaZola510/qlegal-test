"use client"

import type { AdminRegistryOversightEntry } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/core/components/ui/table"
import { useAdminRegistryOversightQuery } from "@/features/admin/api/admin.hooks"

const COMMISSION_BADGE: Record<
	AdminRegistryOversightEntry["commissionStatus"],
	"default" | "secondary" | "destructive"
> = {
	active: "default",
	expired: "destructive",
	suspended: "secondary",
}

function formatLastActivity(iso: string | null): string {
	if (!iso) return "—"
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
	return d.toISOString().slice(0, 10)
}

export function AdminRegistryOversightContent() {
	const {
		data: entries = [],
		isPending,
		isError,
		error,
		refetch,
	} = useAdminRegistryOversightQuery()

	return (
		<Card>
			<CardHeader>
				<CardTitle>Registry Oversight</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{isError && (
					<div className="bg-destructive/10 text-destructive flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm">
						<span>
							{error instanceof Error ? error.message : "Failed to load registry oversight"}
						</span>
						<Button variant="outline" size="sm" onClick={() => refetch()}>
							Retry
						</Button>
					</div>
				)}

				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Notary</TableHead>
							<TableHead>Total Acts</TableHead>
							<TableHead>Pending Sync</TableHead>
							<TableHead>Failed Sync</TableHead>
							<TableHead>Last Activity</TableHead>
							<TableHead>Commission</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isPending && (
							<TableRow>
								<TableCell colSpan={6} className="text-muted-foreground text-center">
									Loading registry oversight…
								</TableCell>
							</TableRow>
						)}
						{!isPending &&
							entries.map(entry => (
								<TableRow key={entry.enpUserId}>
									<TableCell className="font-medium">{entry.enpName}</TableCell>
									<TableCell className="text-sm">{entry.totalActs}</TableCell>
									<TableCell className="text-sm">{entry.pendingScActs}</TableCell>
									<TableCell className="text-sm">
										{entry.failedScActs > 0 ? (
											<span className="text-destructive font-medium">{entry.failedScActs}</span>
										) : (
											entry.failedScActs
										)}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{formatLastActivity(entry.lastActivityAt)}
									</TableCell>
									<TableCell>
										<Badge variant={COMMISSION_BADGE[entry.commissionStatus]}>
											{entry.commissionStatus}
										</Badge>
									</TableCell>
								</TableRow>
							))}
						{!isPending && !isError && entries.length === 0 && (
							<TableRow>
								<TableCell colSpan={6} className="text-muted-foreground text-center">
									No registry acts recorded yet.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	)
}
