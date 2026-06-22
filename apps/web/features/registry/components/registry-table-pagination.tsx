"use client"

import { Button } from "@/core/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/core/components/ui/select"

import { REGISTRY_PAGE_SIZE_OPTIONS, type RegistryPageSize } from "../lib/notarial-book-filters"

export function RegistryTablePagination({
	page,
	totalPages,
	pageSize,
	totalItems,
	onPageChange,
	onPageSizeChange,
}: {
	page: number
	totalPages: number
	pageSize: RegistryPageSize
	totalItems: number
	onPageChange: (page: number) => void
	onPageSizeChange: (size: RegistryPageSize) => void
}) {
	if (totalItems === 0) return null

	const start = (page - 1) * pageSize + 1
	const end = Math.min(page * pageSize, totalItems)

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
			<p className="text-muted-foreground text-xs">
				Showing {start}–{end} of {totalItems}
			</p>

			<div className="flex flex-wrap items-center gap-2">
				<div className="flex items-center gap-2">
					<span className="text-muted-foreground text-xs whitespace-nowrap">Rows per page</span>
					<Select
						value={String(pageSize)}
						onValueChange={v => onPageSizeChange(Number(v) as RegistryPageSize)}
					>
						<SelectTrigger className="h-8 w-[4.5rem] text-xs">
							<span>{pageSize}</span>
						</SelectTrigger>
						<SelectContent>
							{REGISTRY_PAGE_SIZE_OPTIONS.map(size => (
								<SelectItem key={size} value={String(size)}>
									{size}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<span className="text-muted-foreground text-xs tabular-nums">
					Page {page} of {totalPages}
				</span>

				<Button
					size="sm"
					variant="outline"
					disabled={page <= 1}
					onClick={() => onPageChange(page - 1)}
				>
					Previous
				</Button>
				<Button
					size="sm"
					variant="outline"
					disabled={page >= totalPages}
					onClick={() => onPageChange(page + 1)}
				>
					Next
				</Button>
			</div>
		</div>
	)
}
