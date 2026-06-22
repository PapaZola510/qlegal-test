"use client"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/core/components/ui/table"
import { FIXTURE_SC_SYNC_EVENTS } from "@/features/admin/lib/fixtures"

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
	synced: "default",
	pending: "secondary",
	failed: "destructive",
	retrying: "secondary",
}

export function AdminScSyncContent() {
	const failed = FIXTURE_SC_SYNC_EVENTS.filter(e => e.status === "failed").length
	const pending = FIXTURE_SC_SYNC_EVENTS.filter(
		e => e.status === "pending" || e.status === "retrying"
	).length

	return (
		<div className="space-y-6">
			<div className="grid gap-4 sm:grid-cols-3">
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-xs font-medium uppercase">Total Events</p>
						<p className="text-2xl font-bold">{FIXTURE_SC_SYNC_EVENTS.length}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-xs font-medium uppercase">
							Pending / Retrying
						</p>
						<p className="text-2xl font-bold">{pending}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-xs font-medium uppercase">Failed</p>
						<p className="text-destructive text-2xl font-bold">{failed}</p>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>SC Sync Events</CardTitle>
					<CardDescription>
						Monitor Supreme Court e-Notarial registry synchronization status.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Registry No.</TableHead>
								<TableHead>Notary</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Attempts</TableHead>
								<TableHead>Last Attempt</TableHead>
								<TableHead>Error</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{FIXTURE_SC_SYNC_EVENTS.map(event => (
								<TableRow key={event.id}>
									<TableCell className="font-medium">{event.registryNo}</TableCell>
									<TableCell className="text-sm">{event.notaryName}</TableCell>
									<TableCell>
										<Badge variant={STATUS_VARIANT[event.status]}>{event.status}</Badge>
									</TableCell>
									<TableCell className="text-sm">{event.attemptCount}</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{event.lastAttempt}
									</TableCell>
									<TableCell className="max-w-[200px] truncate text-xs text-red-600">
										{event.errorMessage ?? "—"}
									</TableCell>
									<TableCell className="text-right">
										{(event.status === "failed" || event.status === "retrying") && (
											<Button variant="outline" size="sm">
												Retry
											</Button>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	)
}
