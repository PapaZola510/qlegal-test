import {
	looksLikePdfMissingDoconchainNotarialSeal,
	looksLikePdfStrictlyMissingDoconchainNotarialSeal,
} from "./doconchain-sealed-pdf-heuristic"

describe("looksLikePdfMissingDoconchainNotarialSeal", () => {
	it("flags interim PDFs with blank notarial template lines", () => {
		const fakePdf = Buffer.from(
			`%PDF-1.4\n…Roll of Attorneys No. _____\nPTR No. _____,\nIBP No. _____,\nDoc. No. _____\nPage No. _____\nBook No. _____\n`
		)
		expect(looksLikePdfMissingDoconchainNotarialSeal(fakePdf)).toBe(true)
	})

	it("accepts PDFs with the DocOnChain electronic notarial seal block", () => {
		const fakePdf = Buffer.from(
			`%PDF-1.4\n…ELECTRONIC NOTARY PUBLIC\nENP Name: Mavis Montesor\nCommission No. & Validity of Commission: NPN-2026-00013\nMode of Electronic Notarization: REN\n`
		)
		expect(looksLikePdfMissingDoconchainNotarialSeal(fakePdf)).toBe(false)
	})

	it("does not block unknown PDFs on the permissive view path", () => {
		const fakePdf = Buffer.from(`%PDF-1.4\n…signed body only…\n`)
		expect(looksLikePdfMissingDoconchainNotarialSeal(fakePdf)).toBe(false)
	})

	it("strict mode rejects unknown PDFs without seal markers", () => {
		const fakePdf = Buffer.from(`%PDF-1.4\n…signed body only…\n`)
		expect(looksLikePdfStrictlyMissingDoconchainNotarialSeal(fakePdf)).toBe(true)
	})
})
