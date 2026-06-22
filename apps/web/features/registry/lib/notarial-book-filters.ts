import type { RegistryAct } from "./fixtures"

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const

export type RegistryBookSort = "book" | "newest"

export type BookYearKey = `${number}-${string}`

/** Calendar month + year for the monthly notarial book an act belongs to (from execution date). */
export function bookYearKeyFromExecutedAt(executedAt: string): BookYearKey | null {
	const executed = new Date(executedAt)
	if (Number.isNaN(executed.getTime())) return null
	return `${executed.getFullYear()}-${String(executed.getMonth() + 1).padStart(2, "0")}`
}

function isScMonthlyBookNo(value: string): boolean {
	const n = Number.parseInt(value, 10)
	return /^\d{1,2}$/.test(value) && Number.isFinite(n) && n >= 1 && n <= 12
}

/** SC monthly book: book 1 = January … 12 = December. */
export function bookNoFromAct(
	act: Pick<RegistryAct, "bookNo" | "entryNumber" | "executedAt">
): string | null {
	const fromBook = act.bookNo?.trim()
	if (fromBook && isScMonthlyBookNo(fromBook)) return String(Number.parseInt(fromBook, 10))

	const entry = act.entryNumber?.trim()
	if (entry) {
		const parts = entry.split("-")
		const monthSegment = parts[2]?.trim()
		if (monthSegment) {
			const month = Number.parseInt(monthSegment, 10)
			if (Number.isFinite(month) && month >= 1 && month <= 12) {
				return String(month)
			}
		}
	}

	const key = bookYearKeyFromExecutedAt(act.executedAt)
	if (!key) return null
	const month = Number.parseInt(key.split("-")[1] ?? "", 10)
	return Number.isFinite(month) ? String(month) : null
}

/** Which monthly book (year + month) an act belongs to — keyed by notarization date. */
export function bookYearKey(
	act: Pick<RegistryAct, "bookNo" | "entryNumber" | "executedAt">
): BookYearKey | null {
	return bookYearKeyFromExecutedAt(act.executedAt)
}

export function resolveBookFilterKey(filter: BookYearKey | "all"): BookYearKey | null {
	if (filter === "all") return null
	return filter
}

export function shiftBookYearKey(key: BookYearKey, deltaMonths: number): BookYearKey {
	const [yearStr, monthStr] = key.split("-", 2)
	let year = Number.parseInt(yearStr ?? "", 10)
	let month = Number.parseInt(monthStr ?? "", 10)
	if (!Number.isFinite(year) || !Number.isFinite(month)) return key

	month += deltaMonths
	while (month > 12) {
		month -= 12
		year += 1
	}
	while (month < 1) {
		month += 12
		year -= 1
	}
	return `${year}-${String(month).padStart(2, "0")}`
}

export function currentBookYearKey(): BookYearKey {
	const now = new Date()
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function formatBookFilterLabel(bookNo: string, year: number): string {
	const monthIdx = Number.parseInt(bookNo, 10) - 1
	const monthName =
		monthIdx >= 0 && monthIdx < MONTH_NAMES.length ? MONTH_NAMES[monthIdx] : `Month ${bookNo}`
	return `Book ${bookNo} — ${monthName} ${year}`
}

export function labelForBookYearKey(key: BookYearKey): string {
	const [yearStr, bookPadded] = key.split("-", 2)
	const year = Number.parseInt(yearStr ?? "", 10)
	const bookNo = String(Number.parseInt(bookPadded ?? "", 10))
	if (!Number.isFinite(year) || !bookNo) return key
	return formatBookFilterLabel(bookNo, year)
}

export function parsePageNo(pageNo: string | null | undefined): number {
	const n = Number.parseInt((pageNo ?? "").replace(/\D/g, ""), 10)
	return Number.isFinite(n) && n > 0 ? n : 0
}

export type BookFilterOption = {
	value: BookYearKey
	label: string
	entryCount: number
}

/** Recent calendar months plus any month that has entries (for browsing empty past books). */
export function buildBookFilterOptions(
	acts: RegistryAct[],
	options?: { recentMonthCount?: number; anchorKey?: BookYearKey }
): BookFilterOption[] {
	const entryCounts = new Map<BookYearKey, number>()
	for (const act of acts) {
		const key = bookYearKey(act)
		if (key) entryCounts.set(key, (entryCounts.get(key) ?? 0) + 1)
	}

	const anchor = options?.anchorKey ?? currentBookYearKey()
	const recentMonthCount = options?.recentMonthCount ?? 24
	const keys = new Set<BookYearKey>()
	let cursor: BookYearKey = anchor
	for (let i = 0; i < recentMonthCount; i++) {
		keys.add(cursor)
		cursor = shiftBookYearKey(cursor, -1)
	}
	for (const key of entryCounts.keys()) keys.add(key)

	return [...keys]
		.sort((a, b) => b.localeCompare(a))
		.map(value => {
			const count = entryCounts.get(value) ?? 0
			const base = labelForBookYearKey(value)
			return {
				value,
				label: count > 0 ? `${base} (${count})` : `${base} — no entries`,
				entryCount: count,
			}
		})
}

export const REGISTRY_PAGE_SIZE_OPTIONS = [10, 25, 50] as const
export type RegistryPageSize = (typeof REGISTRY_PAGE_SIZE_OPTIONS)[number]

export function sortLabel(sort: RegistryBookSort): string {
	return sort === "book" ? "Latest page first" : "Newest first"
}

/** Highest page / most recent notarization in the monthly book first. */
export function compareActsByBookOrder(a: RegistryAct, b: RegistryAct): number {
	const keyA = bookYearKey(a)
	const keyB = bookYearKey(b)
	if (keyA && keyB && keyA !== keyB) return keyB.localeCompare(keyA)

	const pageDiff = parsePageNo(b.pageNo) - parsePageNo(a.pageNo)
	if (pageDiff !== 0) return pageDiff

	return new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
}

export function compareActsByNewest(a: RegistryAct, b: RegistryAct): number {
	const byDate = new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
	if (byDate !== 0) return byDate
	return compareActsByBookOrder(a, b)
}

export function actMatchesSearch(act: RegistryAct, query: string): boolean {
	const q = query.toLowerCase()
	return (
		act.registryNo.toLowerCase().includes(q) ||
		(act.entryNumber?.toLowerCase().includes(q) ?? false) ||
		(act.bookNo?.toLowerCase().includes(q) ?? false) ||
		(act.pageNo?.toLowerCase().includes(q) ?? false) ||
		act.documentTitle.toLowerCase().includes(q) ||
		act.nrid.toLowerCase().includes(q) ||
		(act.projectUuid?.toLowerCase().includes(q) ?? false) ||
		act.principals.some(p => p.name.toLowerCase().includes(q))
	)
}
