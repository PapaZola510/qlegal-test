"use client"

import * as React from "react"

import type { NotaryDirectoryEntry } from "@repo/contracts"

import { ErrorState, LoadingState } from "@/core/components/shared-states"
import { Avatar, AvatarFallback } from "@/core/components/ui/avatar"
import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card } from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { cn } from "@/core/lib/utils"
import { useNotaryDirectoryQuery } from "@/features/appointments/api/appointments.hooks"

import { notarizationLabel } from "../lib/constants"

interface NotaryPickerStepProps {
	selectedId: string | null
	onSelect: (notary: NotaryDirectoryEntry) => void
}

function getInitials(first: string, last: string) {
	return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()
}

export function NotaryPickerStep({ selectedId, onSelect }: NotaryPickerStepProps) {
	const [query, setQuery] = React.useState("")
	const directoryQuery = useNotaryDirectoryQuery({})

	const entries = React.useMemo(() => {
		const raw = directoryQuery.data ?? []
		if (!query.trim()) return raw
		const q = query.trim().toLowerCase()
		return raw.filter(n => {
			const name = `${n.firstName} ${n.lastName}`.toLowerCase()
			return (
				name.includes(q) ||
				n.city.toLowerCase().includes(q) ||
				n.province.toLowerCase().includes(q) ||
				n.specializations.some(s => s.toLowerCase().includes(q))
			)
		})
	}, [directoryQuery.data, query])

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<p className="text-sm font-medium">Choose a notary to review your document</p>
				<Input
					value={query}
					onChange={e => setQuery(e.target.value)}
					placeholder="Search by name, city, or specialty..."
				/>
			</div>

			{directoryQuery.isPending ? (
				<LoadingState message="Loading registered ENPs..." />
			) : directoryQuery.isError ? (
				<ErrorState
					message="Could not load notaries right now."
					onRetry={() => void directoryQuery.refetch()}
				/>
			) : entries.length === 0 ? (
				<div className="text-muted-foreground rounded-lg border border-dashed p-10 text-center text-sm">
					No notaries match that search.
				</div>
			) : (
				<div className="grid max-h-[420px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
					{entries.map(n => {
						const isSelected = n.id === selectedId
						return (
							<Card
								key={n.id}
								className={cn(
									"hover:border-primary/60 cursor-pointer p-3 transition-colors",
									isSelected && "border-primary ring-primary/30 ring-2"
								)}
								onClick={() => onSelect(n)}
							>
								<div className="flex items-start gap-3">
									<Avatar className="size-9 shrink-0">
										<AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
											{getInitials(n.firstName, n.lastName)}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0 flex-1">
										<div className="flex items-center justify-between gap-2">
											<p className="truncate text-sm font-medium">
												{n.firstName} {n.lastName}
											</p>
											<span className="text-muted-foreground shrink-0 text-xs">
												₱{n.baseFee.toLocaleString()}
											</span>
										</div>
										<p className="text-muted-foreground truncate text-xs">
											{n.city}
											{n.province ? `, ${n.province}` : ""}
										</p>
										<div className="mt-1.5 flex flex-wrap gap-1">
											{n.specializations.slice(0, 3).map(s => (
												<Badge key={s} variant="outline" className="text-[10px] font-normal">
													{notarizationLabel(s)}
												</Badge>
											))}
											{n.specializations.length > 3 && (
												<Badge variant="outline" className="text-[10px] font-normal">
													+{n.specializations.length - 3}
												</Badge>
											)}
										</div>
									</div>
								</div>
							</Card>
						)
					})}
				</div>
			)}

			{selectedId && (
				<div className="border-primary/30 bg-primary/5 flex items-center justify-between rounded-lg border p-3 text-sm">
					<span className="text-muted-foreground">A notary is selected</span>
					<Button variant="ghost" size="sm" onClick={() => setQuery("")}>
						Change selection
					</Button>
				</div>
			)}
		</div>
	)
}
