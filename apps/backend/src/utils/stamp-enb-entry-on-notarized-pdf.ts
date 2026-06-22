import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

import type { NotarialBookFooterFields } from "@repo/contracts"

export type { NotarialBookFooterFields as NotarialBookPdfFooter }

/** @deprecated Use {@link NotarialBookPdfFooter} */
export type EnbPdfStampMeta = NotarialBookFooterFields

/** Left-column Doc./Page/Book/Series block (above the DocOnChain notarial seal on the last page). */
const FOOTER_LEFT_X = 72
const FOOTER_FONT_SIZE = 10
const FOOTER_LINE_HEIGHT = 12
/** Y of the bottom line ("Series of …") measured from the page bottom. */
const FOOTER_SERIES_BASE_Y = 118
/** Written to PDF Subject so re-stamping can be skipped without parsing compressed streams. */
const FOOTER_STAMP_MARKER = "qlegal-notarial-book-footer"

function pdfDocAlreadyHasNotarialBookFooter(doc: PDFDocument): boolean {
	return (doc.getSubject() ?? "").includes(FOOTER_STAMP_MARKER)
}

/**
 * Embeds the traditional Doc./Page/Book/Series block on the last page of a sealed notarized PDF.
 * Quanby Legal assigns book and page numbers — DocOnChain only renders the notarial seal.
 */
export async function stampNotarialBookFooterOnPdf(
	pdf: Buffer,
	footer: NotarialBookFooterFields
): Promise<Buffer> {
	const docNo = footer.docNo.trim()
	const pageNo = footer.pageNo.trim()
	const bookNo = footer.bookNo.trim()
	const seriesYear = footer.seriesYear.trim()
	if (!docNo || !pageNo || !bookNo || !seriesYear) return pdf

	const doc = await PDFDocument.load(pdf, { ignoreEncryption: true })
	if (pdfDocAlreadyHasNotarialBookFooter(doc)) return pdf

	const pages = doc.getPages()
	if (!pages.length) return pdf

	const regular = await doc.embedFont(StandardFonts.Helvetica)
	const italic = await doc.embedFont(StandardFonts.HelveticaOblique)
	const last = pages[pages.length - 1]!

	const lines: { text: string; font: typeof regular; y: number }[] = [
		{
			text: `Doc. No. ${docNo};`,
			font: regular,
			y: FOOTER_SERIES_BASE_Y + FOOTER_LINE_HEIGHT * 3,
		},
		{
			text: `Page No. ${pageNo};`,
			font: regular,
			y: FOOTER_SERIES_BASE_Y + FOOTER_LINE_HEIGHT * 2,
		},
		{
			text: `Book No. ${bookNo};`,
			font: regular,
			y: FOOTER_SERIES_BASE_Y + FOOTER_LINE_HEIGHT,
		},
		{
			text: `Series of ${seriesYear}.`,
			font: italic,
			y: FOOTER_SERIES_BASE_Y,
		},
	]

	// Cover blank template underscores on the last page, then print ENB values.
	last.drawRectangle({
		x: FOOTER_LEFT_X - 4,
		y: FOOTER_SERIES_BASE_Y - 3,
		width: 132,
		height: FOOTER_LINE_HEIGHT * 4 + 8,
		color: rgb(1, 1, 1),
		borderWidth: 0,
	})

	for (const line of lines) {
		last.drawText(line.text, {
			x: FOOTER_LEFT_X,
			y: line.y,
			size: FOOTER_FONT_SIZE,
			font: line.font,
			color: rgb(0, 0, 0),
		})
	}

	const subject = doc.getSubject() ?? ""
	if (!subject.includes(FOOTER_STAMP_MARKER)) {
		doc.setSubject(subject ? `${subject} ${FOOTER_STAMP_MARKER}` : FOOTER_STAMP_MARKER)
	}

	return Buffer.from(await doc.save())
}

/** @deprecated Use {@link stampNotarialBookFooterOnPdf} */
export async function stampEnbEntryOnNotarizedPdf(
	pdf: Buffer,
	meta: { entryNumber: string; bookNo: string; pageNo: string; executedAt?: Date | string }
): Promise<Buffer> {
	const year =
		meta.executedAt instanceof Date
			? String(meta.executedAt.getFullYear())
			: meta.executedAt
				? String(new Date(meta.executedAt).getFullYear())
				: new Date().getFullYear().toString()
	const pageDigits = meta.pageNo.replace(/\D/g, "") || meta.pageNo.trim()
	const docNo = meta.entryNumber.split("-")[0]?.trim() || pageDigits
	return stampNotarialBookFooterOnPdf(pdf, {
		docNo,
		pageNo: pageDigits,
		bookNo: meta.bookNo.trim(),
		seriesYear: year,
	})
}
