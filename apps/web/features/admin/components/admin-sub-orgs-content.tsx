"use client"

import type { SubOrg } from "@repo/contracts"

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
import { useAdminSubOrgsQuery } from "@/features/admin/api/admin.hooks"

const KIND_LABELS: Record<SubOrg["kind"], string> = {
	personal: "Personal",
	firm: "Law firm",
}

function formatCreatedAt(value: SubOrg["createdAt"]): string {
	const d = value instanceof Date ? value : new Date(value)
	if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
	return d.toISOString().slice(0, 10)
}

export function AdminSubOrgsContent() {
	const { data: orgs = [], isPending, isError, error, refetch } = useAdminSubOrgsQuery()

	return (
		<Card>
			<CardHeader>
				<CardTitle>Sub-Organizations</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{isError && (
					<div className="bg-destructive/10 text-destructive flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm">
						<span>
							{error instanceof Error ? error.message : "Failed to load sub-organizations"}
						</span>
						<Button variant="outline" size="sm" onClick={() => refetch()}>
							Retry
						</Button>
					</div>
				)}

				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>Owner</TableHead>
							<TableHead>Members</TableHead>
							<TableHead>Created</TableHead>
							<TableHead>Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isPending && (
							<TableRow>
								<TableCell colSpan={6} className="text-muted-foreground text-center">
									Loading sub-organizations…
								</TableCell>
							</TableRow>
						)}
						{!isPending &&
							orgs.map(org => (
								<TableRow key={org.id}>
									<TableCell className="font-medium">{org.name}</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{KIND_LABELS[org.kind]}
									</TableCell>
									<TableCell className="text-sm">{org.ownerName}</TableCell>
									<TableCell className="text-sm">{org.memberCount}</TableCell>
									<TableCell className="text-muted-foreground text-sm">
										{formatCreatedAt(org.createdAt)}
									</TableCell>
									<TableCell>
										<Badge variant={org.isActive ? "default" : "secondary"}>
											{org.isActive ? "active" : "inactive"}
										</Badge>
									</TableCell>
								</TableRow>
							))}
						{!isPending && !isError && orgs.length === 0 && (
							<TableRow>
								<TableCell colSpan={6} className="text-muted-foreground text-center">
									No sub-organizations yet.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	)
}
