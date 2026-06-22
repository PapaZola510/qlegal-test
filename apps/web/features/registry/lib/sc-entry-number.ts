import { formatEnbEntryNumber as formatEntry } from "@repo/contracts"

/** SC entry number: Document No.-Page No.-Month No.-Year (e.g. `1-001-04-2026`). */

export { formatEnbEntryNumber, parseDocumentNoFromActNumber } from "@repo/contracts"

/** @deprecated Use formatEnbEntryNumber from @repo/contracts */
export function formatScEntryNo(input: {
	registryNo: string
	pageNo: string | null
	executedAt: string
	date: string
}): string {
	return formatEntry({
		actNumber: input.registryNo,
		pageNo: input.pageNo,
		executedAt: input.executedAt || input.date,
	})
}

/** @deprecated Use parseDocumentNoFromActNumber from @repo/contracts */
export function parseDocumentNo(registryNo: string): string {
	const parts = registryNo.trim().split("-")
	const last = parts[parts.length - 1]
	const n = Number.parseInt(last ?? "", 10)
	if (Number.isFinite(n)) return String(n)
	return registryNo.trim() || "—"
}
