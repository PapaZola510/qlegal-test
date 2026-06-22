"use client"

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/core/components/ui/button"

import {
	labelForBookYearKey,
	shiftBookYearKey,
	type BookYearKey,
} from "../lib/notarial-book-filters"

export function MonthlyBookNavigator({
	bookKey,
	activeBookKey,
	entryCount,
	onSelectBook,
	onSubmitBook,
	submitDisabled,
}: {
	bookKey: BookYearKey | null
	activeBookKey: BookYearKey
	entryCount: number
	onSelectBook: (key: BookYearKey) => void
	onSubmitBook?: () => void
	submitDisabled?: boolean
}) {
	if (!bookKey) {
		const previousKey = shiftBookYearKey(activeBookKey, -1)
		return (
			<div className="bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
				<p className="text-muted-foreground min-w-0 flex-1">
					Showing entries from{" "}
					<span className="text-foreground font-medium">all monthly books</span> ({entryCount}{" "}
					total). Select a monthly book to browse one month at a time.
				</p>
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="shrink-0 text-xs"
					onClick={() => onSelectBook(previousKey)}
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} className="mr-1 size-3.5" strokeWidth={2} />
					Open {labelForBookYearKey(previousKey)}
				</Button>
			</div>
		)
	}

	const label = labelForBookYearKey(bookKey)
	const previousKey = shiftBookYearKey(bookKey, -1)
	const nextKey = shiftBookYearKey(bookKey, 1)

	return (
		<div className="space-y-3 rounded-lg border px-4 py-3">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="text-xs"
					onClick={() => onSelectBook(previousKey)}
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} className="mr-1 size-3.5" strokeWidth={2} />
					Previous month
				</Button>

				<div className="min-w-0 flex-1 text-center">
					<p className="text-sm font-semibold">{label}</p>
					<p className="text-muted-foreground text-xs">
						{entryCount === 0
							? "No entries notarized in this monthly book yet"
							: `${entryCount} ${entryCount === 1 ? "entry" : "entries"} notarized this month`}
					</p>
				</div>

				<Button
					type="button"
					size="sm"
					variant="outline"
					className="text-xs"
					onClick={() => onSelectBook(nextKey)}
				>
					Next month
					<HugeiconsIcon icon={ArrowRight01Icon} className="ml-1 size-3.5" strokeWidth={2} />
				</Button>
			</div>

			{onSubmitBook ? (
				<div className="flex justify-center border-t pt-3">
					<Button
						type="button"
						size="sm"
						variant="secondary"
						className="text-xs"
						onClick={onSubmitBook}
						disabled={submitDisabled || entryCount === 0}
					>
						Submit book to SCP / ENA
					</Button>
				</div>
			) : null}
		</div>
	)
}
