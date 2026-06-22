"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"

interface RegistryKpiTilesProps {
	total: number
	currentBook: { label: string; count: number }
	pendingSync: number
}

export function RegistryKpiTiles({ total, currentBook, pendingSync }: RegistryKpiTilesProps) {
	const tiles = [
		{ label: "Total Acts", value: total },
		{ label: currentBook.label, value: currentBook.count },
		{ label: "Pending SC Sync", value: pendingSync },
	]

	return (
		<div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
			{tiles.map(t => (
				<Card key={t.label} size="sm">
					<CardHeader className="pb-1">
						<CardTitle className="text-muted-foreground text-xs font-medium">{t.label}</CardTitle>
					</CardHeader>
					<CardContent>
						<span className="text-2xl font-bold tabular-nums">{t.value}</span>
					</CardContent>
				</Card>
			))}
		</div>
	)
}
