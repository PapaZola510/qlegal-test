"use client"

import * as React from "react"
import { UnfoldMoreIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { EnpDocumentType } from "@repo/contracts"

import { Checkbox } from "@/core/components/ui/checkbox"
import { Label } from "@/core/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/core/components/ui/popover"
import { cn } from "@/core/lib/utils"

function triggerLabel(
	types: EnpDocumentType[],
	selectedIds: string[],
	placeholder: string
): string {
	if (selectedIds.length === 0) return placeholder

	const names = selectedIds
		.map(id => types.find(t => t.id === id)?.name)
		.filter((name): name is string => Boolean(name))

	if (names.length === 1) return names[0]!
	if (names.length === 2) return names.join(", ")
	return `${names.length} types selected`
}

interface EnpDocumentTypeMultiSelectProps {
	types: EnpDocumentType[] | undefined
	selectedIds: string[]
	onSelectedIdsChange: (ids: string[]) => void
	isLoading?: boolean
	isError?: boolean
	emptyMessage?: string
	disabled?: boolean
	placeholder?: string
	label?: React.ReactNode
	description?: React.ReactNode
}

export function EnpDocumentTypeMultiSelect({
	types,
	selectedIds,
	onSelectedIdsChange,
	isLoading = false,
	isError = false,
	emptyMessage = "No document types available.",
	disabled = false,
	placeholder = "Select document type(s)",
	label,
	description,
}: EnpDocumentTypeMultiSelectProps) {
	const [open, setOpen] = React.useState(false)
	const typesList = types ?? []
	const summary = triggerLabel(typesList, selectedIds, placeholder)

	const toggleType = (typeId: string, checked: boolean) => {
		onSelectedIdsChange(
			checked ? [...selectedIds, typeId] : selectedIds.filter(id => id !== typeId)
		)
	}

	return (
		<div className="space-y-2">
			{((label !== null && label !== undefined) ||
				(description !== null && description !== undefined)) && (
				<div>
					{label !== null &&
						label !== undefined &&
						(typeof label === "string" ? <Label>{label}</Label> : <div>{label}</div>)}
					{description}
				</div>
			)}

			{isLoading ? (
				<p className="text-muted-foreground text-sm">Loading document types…</p>
			) : isError ? (
				<p className="text-destructive text-sm">Could not load document types.</p>
			) : typesList.length === 0 ? (
				<p className="text-destructive text-sm">{emptyMessage}</p>
			) : (
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger
						disabled={disabled}
						className={cn(
							"border-input focus-visible:border-ring focus-visible:ring-ring/50 data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 flex h-8 w-full items-center justify-between gap-2 rounded-lg border bg-transparent px-2.5 py-2 text-sm transition-colors outline-none select-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50",
							selectedIds.length === 0 && "text-muted-foreground"
						)}
					>
						<span className="min-w-0 truncate text-left">{summary}</span>
						<HugeiconsIcon
							icon={UnfoldMoreIcon}
							strokeWidth={2}
							className="text-muted-foreground size-4 shrink-0"
						/>
					</PopoverTrigger>
					<PopoverContent align="start" className="w-(--anchor-width) gap-0 p-1" sideOffset={4}>
						<div className="max-h-60 overflow-y-auto">
							{typesList.map(t => {
								const checked = selectedIds.includes(t.id)
								return (
									<label
										key={t.id}
										className="hover:bg-muted flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm"
										onMouseDown={e => e.preventDefault()}
									>
										<Checkbox
											checked={checked}
											onCheckedChange={value => toggleType(t.id, value === true)}
										/>
										<span className="min-w-0 flex-1">
											<span className="truncate font-medium">{t.name}</span>
											<span className="text-muted-foreground ml-2 text-xs">
												₱{t.pricePhp.toLocaleString()}
											</span>
										</span>
									</label>
								)
							})}
						</div>
					</PopoverContent>
				</Popover>
			)}
		</div>
	)
}
