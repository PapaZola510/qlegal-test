"use client"

import type { ReactNode } from "react"
import { Csv01Icon, Pdf01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/core/components/ui/select"

import { REGISTRY_ACT_TYPE_LABELS, type RegistryActType } from "../lib/fixtures"
import {
	labelForBookYearKey,
	sortLabel,
	type BookFilterOption,
	type BookYearKey,
	type RegistryBookSort,
} from "../lib/notarial-book-filters"

function FilterField({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-1.5">
			<Label className="text-muted-foreground text-xs font-medium">{label}</Label>
			{children}
		</div>
	)
}

export function RegistryFiltersToolbar({
	search,
	onSearchChange,
	bookFilter,
	onBookFilterChange,
	bookOptions,
	activeBookKey,
	sortBy,
	onSortChange,
	actTypeFilter,
	onActTypeFilterChange,
	pendingSyncCount,
	onRecordIncomplete,
	onBulkSync,
	onExportCsv,
	onExportPdf,
	exportPdfDisabled,
}: {
	search: string
	onSearchChange: (value: string) => void
	bookFilter: BookYearKey | "all"
	onBookFilterChange: (value: BookYearKey | "all") => void
	bookOptions: BookFilterOption[]
	activeBookKey: BookYearKey
	sortBy: RegistryBookSort
	onSortChange: (value: RegistryBookSort) => void
	actTypeFilter: RegistryActType | "all"
	onActTypeFilterChange: (value: RegistryActType | "all") => void
	pendingSyncCount: number
	onRecordIncomplete: () => void
	onBulkSync: () => void
	onExportCsv: () => void
	onExportPdf: () => void
	exportPdfDisabled: boolean
}) {
	const bookFilterLabel =
		bookFilter === "all" ? "All monthly books" : labelForBookYearKey(bookFilter)

	const actTypeLabel =
		actTypeFilter === "all" ? "All act types" : REGISTRY_ACT_TYPE_LABELS[actTypeFilter]

	return (
		<div className="space-y-3 rounded-lg border p-4">
			<div className="grid gap-3 lg:grid-cols-[minmax(12rem,1.4fr)_minmax(11rem,1fr)_minmax(9rem,0.8fr)_minmax(9rem,0.8fr)] lg:items-end">
				<FilterField label="Search">
					<Input
						placeholder="Entry no., document, NRID…"
						value={search}
						onChange={e => onSearchChange(e.target.value)}
						className="h-9"
					/>
				</FilterField>

				<FilterField label="Monthly book">
					<Select
						value={bookFilter}
						onValueChange={v => onBookFilterChange(v as BookYearKey | "all")}
					>
						<SelectTrigger className="h-9 w-full">
							<span className="truncate text-left text-sm">{bookFilterLabel}</span>
						</SelectTrigger>
						<SelectContent className="max-h-72">
							<SelectItem value="all">All monthly books</SelectItem>
							{bookOptions.map(option => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
									{option.value === activeBookKey ? " · current" : ""}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FilterField>

				<FilterField label="Sort">
					<Select value={sortBy} onValueChange={v => onSortChange(v as RegistryBookSort)}>
						<SelectTrigger className="h-9 w-full">
							<span className="truncate text-left text-sm">{sortLabel(sortBy)}</span>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="book">Latest page first</SelectItem>
							<SelectItem value="newest">Newest first</SelectItem>
						</SelectContent>
					</Select>
				</FilterField>

				<FilterField label="Act type">
					<Select
						value={actTypeFilter}
						onValueChange={v => onActTypeFilterChange(v as RegistryActType | "all")}
					>
						<SelectTrigger className="h-9 w-full">
							<span className="truncate text-left text-sm">{actTypeLabel}</span>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All act types</SelectItem>
							{(Object.keys(REGISTRY_ACT_TYPE_LABELS) as RegistryActType[]).map(k => (
								<SelectItem key={k} value={k}>
									{REGISTRY_ACT_TYPE_LABELS[k]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FilterField>
			</div>

			<div className="flex flex-wrap gap-2 border-t pt-3">
				<Button size="sm" variant="outline" onClick={onRecordIncomplete}>
					Record incomplete act
				</Button>
				{pendingSyncCount > 0 ? (
					<Button size="sm" variant="secondary" onClick={onBulkSync}>
						Sync all pending ({pendingSyncCount})
					</Button>
				) : null}
				<div className="flex flex-wrap gap-2 sm:ml-auto">
					<Button size="sm" variant="outline" onClick={onExportCsv}>
						<HugeiconsIcon icon={Csv01Icon} className="size-3.5" strokeWidth={2} />
						Export CSV
					</Button>
					<Button size="sm" variant="outline" onClick={onExportPdf} disabled={exportPdfDisabled}>
						<HugeiconsIcon icon={Pdf01Icon} className="size-3.5" strokeWidth={2} />
						Export PDF
					</Button>
				</div>
			</div>
		</div>
	)
}
