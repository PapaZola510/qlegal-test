/**
 * Heuristic: DocOnChain interim PDFs often still have blank SC template underscores
 * on the last page (Roll/PTR/IBP, Doc/Page/Book). Sealed copies replace those with
 * the electronic notarial block.
 *
 * Default is permissive (treat as usable) so View/Download keeps working; only flag
 * obvious pre-seal template PDFs when blank credential lines are readable in the file.
 */
const MAX_SCAN_BYTES = 12 * 1024 * 1024

/** DocOnChain renders these on the sealed notarial certification block. */
const SEAL_POSITIVE_MARKERS = [
	/ELECTRONIC\s+NOTARY\s+PUBLIC/i,
	/ENP\s*Name\s*:/i,
	/Commission\s+No\.\s*&\s*Validity/i,
	/Mode\s+of\s+Electronic\s+Notarization/i,
] as const

export type NotarizedPdfSealHeuristicOptions = {
	/** When true, only accept PDFs with readable seal text or trusted completed source. */
	strict?: boolean
	trustDocumentCompleted?: boolean
	acceptAnySignedPdf?: boolean
}

function pdfBinarySample(pdf: Buffer): string {
	const len = Math.min(pdf.length, MAX_SCAN_BYTES)
	return pdf.subarray(0, len).toString("latin1")
}

function hasDoconchainNotarialSealBlock(sample: string): boolean {
	return SEAL_POSITIVE_MARKERS.some(re => re.test(sample))
}

function hasBlankNotarialTemplateLines(sample: string): boolean {
	const hasBlankRollLine = /Roll\s+of\s+Attorneys?\s+No\.\s*_{2,}/i.test(sample)
	const hasBlankPtrLine = /PTR\s+No\.\s*_{2,}/i.test(sample)
	const hasBlankIbpLine = /IBP\s+No\.\s*_{2,}/i.test(sample)
	const hasBlankDocBlock =
		/Doc\.\s*No\.\s*_{2,}/i.test(sample) &&
		/Page\s*No\.\s*_{2,}/i.test(sample) &&
		/Book\s*No\.\s*_{2,}/i.test(sample)

	const blankCredentialLines = [hasBlankRollLine, hasBlankPtrLine, hasBlankIbpLine].filter(
		Boolean
	).length
	if (blankCredentialLines >= 2) return true
	if (hasBlankDocBlock && blankCredentialLines >= 1) return true
	if (hasBlankDocBlock) return true

	return false
}

/**
 * Returns true when the PDF is clearly a pre-seal / sign-only interim copy.
 * When unsure, returns false so View/Download is not blocked.
 */
export function looksLikePdfMissingDoconchainNotarialSeal(
	pdf: Buffer,
	opts?: NotarizedPdfSealHeuristicOptions
): boolean {
	if (!pdf.length || pdf.subarray(0, 4).toString("ascii") !== "%PDF") return true
	if (opts?.acceptAnySignedPdf) return false

	const sample = pdfBinarySample(pdf)
	if (hasDoconchainNotarialSealBlock(sample)) return false
	if (hasBlankNotarialTemplateLines(sample)) return true

	if (opts?.trustDocumentCompleted || !opts?.strict) return false

	return true
}

/** Strict check for S3 archive — skip storing obvious interim template PDFs. */
export function looksLikePdfStrictlyMissingDoconchainNotarialSeal(pdf: Buffer): boolean {
	return looksLikePdfMissingDoconchainNotarialSeal(pdf, { strict: true })
}
