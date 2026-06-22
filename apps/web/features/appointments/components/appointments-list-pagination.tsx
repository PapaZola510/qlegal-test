"use client"

import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationNext,
	PaginationPrevious,
} from "@/core/components/ui/pagination"

interface AppointmentsListPaginationProps {
	page: number
	limit: number
	totalPages: number
	total: number
	onPageChange: (page: number) => void
	disabled?: boolean
}

export function AppointmentsListPagination({
	page,
	limit,
	totalPages,
	total,
	onPageChange,
	disabled,
}: AppointmentsListPaginationProps) {
	if (totalPages <= 1) return null

	const from = total === 0 ? 0 : (page - 1) * limit + 1
	const to = Math.min(page * limit, total)

	return (
		<div className="flex flex-col items-center gap-2 pt-2 sm:flex-row sm:justify-between">
			<p className="text-muted-foreground text-xs">
				Showing {from}–{to} of {total}
			</p>
			<Pagination className="mx-0 w-auto">
				<PaginationContent>
					<PaginationItem>
						<PaginationPrevious
							href="#"
							text="Previous"
							className={page <= 1 || disabled ? "pointer-events-none opacity-50" : undefined}
							onClick={e => {
								e.preventDefault()
								if (page > 1 && !disabled) onPageChange(page - 1)
							}}
						/>
					</PaginationItem>
					<PaginationItem>
						<span className="text-muted-foreground px-2 text-xs tabular-nums">
							Page {page} of {totalPages}
						</span>
					</PaginationItem>
					<PaginationItem>
						<PaginationNext
							href="#"
							text="Next"
							className={
								page >= totalPages || disabled ? "pointer-events-none opacity-50" : undefined
							}
							onClick={e => {
								e.preventDefault()
								if (page < totalPages && !disabled) onPageChange(page + 1)
							}}
						/>
					</PaginationItem>
				</PaginationContent>
			</Pagination>
			<div className="hidden sm:block sm:w-[120px]" aria-hidden />
		</div>
	)
}
