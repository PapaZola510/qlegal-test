import { PDFDocument, StandardFonts } from "pdf-lib"

import { stampNotarialBookFooterOnPdf } from "./stamp-enb-entry-on-notarized-pdf"

const FOOTER_STAMP_MARKER = "qlegal-notarial-book-footer"

async function blankPdf(): Promise<Buffer> {
	const doc = await PDFDocument.create()
	const page = doc.addPage([612, 792])
	const font = await doc.embedFont(StandardFonts.Helvetica)
	page.drawText("Notarized document body", { x: 72, y: 700, size: 12, font })
	return Buffer.from(await doc.save())
}

async function subjectOf(pdf: Buffer): Promise<string> {
	const doc = await PDFDocument.load(pdf, { ignoreEncryption: true })
	return doc.getSubject() ?? ""
}

describe("stampNotarialBookFooterOnPdf", () => {
	it("adds Doc./Page/Book/Series on the last page", async () => {
		const input = await blankPdf()
		const output = await stampNotarialBookFooterOnPdf(input, {
			docNo: "106",
			pageNo: "106",
			bookNo: "7",
			seriesYear: "2026",
		})
		expect(output.equals(input)).toBe(false)
		expect(await subjectOf(output)).toContain(FOOTER_STAMP_MARKER)
	})

	it("stamps when the PDF only has blank SC template labels", async () => {
		const doc = await PDFDocument.create()
		const page = doc.addPage([612, 792])
		const font = await doc.embedFont(StandardFonts.Helvetica)
		page.drawText("Doc. No. __________", { x: 72, y: 150, size: 10, font })
		page.drawText("Page No. __________", { x: 72, y: 138, size: 10, font })
		page.drawText("Book No. __________", { x: 72, y: 126, size: 10, font })
		page.drawText("Series of __________.", { x: 72, y: 114, size: 10, font })
		const input = Buffer.from(await doc.save())

		const output = await stampNotarialBookFooterOnPdf(input, {
			docNo: "29",
			pageNo: "29",
			bookNo: "6",
			seriesYear: "2024",
		})
		expect(output.equals(input)).toBe(false)
		expect(await subjectOf(output)).toContain(FOOTER_STAMP_MARKER)
	})

	it("does not double-stamp when footer already present", async () => {
		const once = await stampNotarialBookFooterOnPdf(await blankPdf(), {
			docNo: "1",
			pageNo: "1",
			bookNo: "1",
			seriesYear: "2026",
		})
		const filled = await stampNotarialBookFooterOnPdf(once, {
			docNo: "1",
			pageNo: "1",
			bookNo: "1",
			seriesYear: "2026",
		})
		const twice = await stampNotarialBookFooterOnPdf(filled, {
			docNo: "99",
			pageNo: "99",
			bookNo: "12",
			seriesYear: "2025",
		})
		expect(filled.equals(once)).toBe(true)
		expect(twice.equals(filled)).toBe(true)
	})
})
