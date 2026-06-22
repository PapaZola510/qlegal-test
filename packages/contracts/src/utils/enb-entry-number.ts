/** SC entry number: Document No.-Page No.-Month No.-Year (e.g. `1-001-04-2026`). */

const SC_ENTRY_NO_PATTERN = /^\d+-\d{3}-\d{2}-\d{4}$/

export function parseDocumentNoFromActNumber(actNumber: string): string {
	const parts = actNumber.trim().split("-")
	const last = parts[parts.length - 1]
	const n = Number.parseInt(last ?? "", 10)
	if (Number.isFinite(n)) return String(n)
	return actNumber.trim() || "1"
}

export type NotarialBookFooterFields = {
	/** Chronological document number in the monthly book (e.g. 106). */
	docNo: string
	/** Page number in the notarial book (same as doc no for single-page entries). */
	pageNo: string
	/** Monthly book number (1 = January … 12 = December). */
	bookNo: string
	/** Calendar year for "Series of ____." */
	seriesYear: string
}

/** Fields for the Doc./Page/Book/Series block on the last page of a notarized PDF. */
export function resolveNotarialBookFooterFields(input: {
	bookNo: string | null | undefined
	pageNo: string | null | undefined
	executedAt: Date | string
	entryNumber?: string | null
}): NotarialBookFooterFields | null {
	const book = input.bookNo?.trim()
	const pageRaw = input.pageNo?.trim()
	if (!book || !pageRaw) return null

	const pageDigits = pageRaw.replace(/\D/g, "")
	const pageNo = pageDigits || pageRaw

	const d = input.executedAt instanceof Date ? input.executedAt : new Date(input.executedAt)
	if (Number.isNaN(d.getTime())) return null

	let docNo = pageNo
	const entry = input.entryNumber?.trim()
	if (entry) {
		const first = entry.split("-")[0]?.trim()
		if (first) docNo = first
	}

	return {
		docNo,
		pageNo,
		bookNo: book,
		seriesYear: String(d.getFullYear()),
	}
}

export function formatEnbEntryNumber(input: {
	actNumber: string
	pageNo: string | null
	executedAt: Date | string
}): string {
	const trimmed = input.actNumber.trim()
	if (SC_ENTRY_NO_PATTERN.test(trimmed)) return trimmed

	const d = input.executedAt instanceof Date ? input.executedAt : new Date(input.executedAt)
	if (Number.isNaN(d.getTime())) return trimmed || "—"

	const month = String(d.getMonth() + 1).padStart(2, "0")
	const year = d.getFullYear()
	const pageDigits = (input.pageNo?.trim() || "").replace(/\D/g, "")
	const pageNum = Number.parseInt(pageDigits, 10)
	const page =
		Number.isFinite(pageNum) && pageNum > 0
			? String(pageNum).padStart(3, "0")
			: (input.pageNo?.trim() || "001").replace(/\D/g, "").padStart(3, "0").slice(-3) || "001"
	const docNo =
		Number.isFinite(pageNum) && pageNum > 0
			? String(pageNum)
			: parseDocumentNoFromActNumber(trimmed)
	return `${docNo}-${page}-${month}-${year}`
}
