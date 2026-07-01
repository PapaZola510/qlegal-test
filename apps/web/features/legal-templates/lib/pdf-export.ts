import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib"

import type {
	AffidavitOfDesistanceData,
	AffidavitOfDiscrepancyData,
	AffidavitOfLossData,
	AffidavitOfUndertakingData,
	AffidavitOfUndertakingPsaBirthMarriageCertificateData,
	AffidavitOfUndertakingWithMinorData,
	ContractOfLeaseData,
	CopyCertificationData,
	DeedOfAbsoluteSaleData,
	DeedOfDonationData,
	GsisBoardOfTrusteesPetitionData,
	JudicialAffidavitData,
	OmnibusSwornStatementData,
	PetitionForVoluntaryConfinementTreatmentData,
	RealEstateMortgageData,
	SpecialPowerOfAttorneyData,
	SwornAffidavitNameDiscrepancyData,
	SwornStatementAssetsLiabilitiesNetWorthData,
	VerificationAndCertificationAgainstForumShoppingData,
	ContractOfServicesData,
} from "../types"
import { defaultSwornStatementAssetsLiabilitiesNetWorth } from "../types"

// â”€â”€ Layout constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PAGE_W = 612 // Letter width (pts)
const PAGE_H = 792 // Letter height (pts)
const MARGIN_H = 72 // 1-inch horizontal margin
const MARGIN_TOP = 72
const MARGIN_BOTTOM = 108 // 1.5-inch footer space from body
const CONTENT_W = PAGE_W - MARGIN_H * 2

const INK = rgb(0, 0, 0)
const MUTED = rgb(0.3, 0.3, 0.3)

const SIZE_SM = 9
const SIZE_BODY = 10
const SIZE_TITLE = 12

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
	const words = text.split(" ")
	const lines: string[] = []
	let current = ""

	for (const word of words) {
		const test = current ? `${current} ${word}` : word
		if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
			lines.push(current)
			current = word
		} else {
			current = test
		}
	}
	if (current) lines.push(current)
	return lines.length ? lines : [""]
}

/** Draws wrapped text and returns the new cursor y position. */
function drawParagraph(
	page: PDFPage,
	text: string,
	x: number,
	y: number,
	font: PDFFont,
	size: number,
	maxWidth: number,
	lineHeight: number,
	color = INK
): number {
	const lines = wrapText(text, font, size, maxWidth)
	for (const line of lines) {
		page.drawText(line, { x, y, size, font, color })
		y -= lineHeight
	}
	return y
}

/** Draws a centred heading. Returns the new y position. */
function drawCentred(page: PDFPage, text: string, y: number, font: PDFFont, size: number): number {
	const textW = font.widthOfTextAtSize(text, size)
	const x = (PAGE_W - textW) / 2
	page.drawText(text, { x, y, size, font, color: INK })
	return y - size * 1.6
}

/** Returns a blank field representation. */
const f = (value: string, fallback = "_____________") => (value.trim() ? value : fallback)

// â”€â”€ Affidavit of Loss â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function exportAffidavitOfLoss(data: AffidavitOfLossData): Promise<void> {
	const pdf = await PDFDocument.create()
	const regular = await pdf.embedFont(StandardFonts.TimesRoman)
	const bold = await pdf.embedFont(StandardFonts.TimesRomanBold)
	const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic)

	let page = pdf.addPage([PAGE_W, PAGE_H])
	const LH = SIZE_BODY * 1.55
	const LH_SM = SIZE_SM * 1.5
	let y = PAGE_H - MARGIN_TOP
	const x = MARGIN_H
	const indentX = x + 28

	const ensureSpace = (needed: number) => {
		if (y < MARGIN_BOTTOM + needed) {
			page = pdf.addPage([PAGE_W, PAGE_H])
			y = PAGE_H - MARGIN_TOP
		}
	}

	const drawParagraphWithPageBreak = (
		text: string,
		xPos: number,
		font: PDFFont = regular,
		size = SIZE_BODY,
		maxWidth = CONTENT_W,
		lineHeight = LH
	) => {
		const lines = wrapText(text, font, size, maxWidth)
		for (const line of lines) {
			if (y < MARGIN_BOTTOM + lineHeight) {
				page = pdf.addPage([PAGE_W, PAGE_H])
				y = PAGE_H - MARGIN_TOP
			}
			page.drawText(line, { x: xPos, y, size, font, color: INK })
			y -= lineHeight
		}
	}

	// Header
	page.drawText("REPUBLIC OF THE PHILIPPINES", { x, y, size: SIZE_SM, font: bold, color: INK })
	y -= LH_SM
	page.drawText(`CITY OF ${f(data.city, "_______________")}`, {
		x,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	page.drawText(") S.S.", { x: x + 200, y, size: SIZE_SM, font: regular, color: INK })
	y -= LH_SM * 2.5

	// Title
	y = drawCentred(page, "AFFIDAVIT OF LOSS", y, bold, SIZE_TITLE)
	y -= LH * 0.5

	// Body paragraph 1
	const para1 = `I, ${f(data.affiantName)}, of legal age, ${f(data.legalAge, "__")}, and residing at ${f(data.address)} after having been duly sworn to according to law hereby depose and state:`
	drawParagraphWithPageBreak(para1, x)
	y -= LH * 0.5

	// Numbered paragraphs
	const items = [
		`That I am the owner of a ${f(data.itemDescription)};`,
		`That on the ${f(data.dateDay, "__")}th of ${f(data.dateMonth, "_____________")}, 20${f(data.dateYear, "__")}, ${f(data.lossCircumstances, "___________________________________________________________")};`,
		`That after diligent search ${f(data.searchDescription)}, my ${f(data.itemType, "______________")} was nowhere to be found anymore;`,
		`That I am executing this affidavit in order to attest to the truth of the foregoing circumstances and for the purpose of reporting the loss to the ${f(data.reportingTo)}.`,
	]

	for (let i = 0; i < items.length; i++) {
		ensureSpace(90)
		const numText = `${i + 1}. `
		page.drawText(numText, { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
		drawParagraphWithPageBreak(items[i]!, indentX + 16, regular, SIZE_BODY, CONTENT_W - 44, LH)
		y -= LH * 0.4
	}

	y -= LH

	// IN WITNESS WHEREOF
	const witnessText = `IN WITNESS WHEREOF, I have hereunto set my hand this ${f(data.witnessDay, "___")} day of ${f(data.witnessMonth, "_______")}, 20${f(data.witnessYear, "__")} at the City of ${f(data.witnessCity, "_______________")}.`
	drawParagraphWithPageBreak(witnessText, x, italic)
	y -= LH * 3

	// Signature lines
	ensureSpace(110)
	const sigColW = CONTENT_W / 2
	page.drawLine({ start: { x, y }, end: { x: x + sigColW - 20, y }, thickness: 0.75, color: MUTED })
	page.drawLine({
		start: { x: x + sigColW + 20, y },
		end: { x: x + CONTENT_W, y },
		thickness: 0.75,
		color: MUTED,
	})
	y -= LH_SM
	page.drawText(f(data.affiantLabelLeft, "Affiant"), { x: x + 20, y, size: SIZE_SM, font: regular, color: INK })
	page.drawText(f(data.affiantLabelRight, "Affiant"), { x: x + sigColW + 40, y, size: SIZE_SM, font: regular, color: INK })
	y -= LH * 2

	// Subscribed
	const subText = `SUBSCRIBED AND SWORN to before me this ${f(data.swornDay, "__")} day of ${f(data.swornMonth, "_____________")} 20${f(data.swornYear, "__")}, affiant exhibited a competent proof of their Identity:`
	drawParagraphWithPageBreak(subText, x)
	y -= LH

	ensureSpace(90)
	const idNameStartX = x + 20
	const idNameEndX = x + 220
	const idNumberStartX = x + 240
	const idNumberEndX = x + 360
	const idValidStartX = x + 380
	const idValidEndX = x + 480

	page.drawText("Govt. Issued I.D.", { x: idNameStartX, y, size: SIZE_SM, font: bold, color: INK })
	page.drawText("ID Number", { x: idNumberStartX, y, size: SIZE_SM, font: bold, color: INK })
	page.drawText("Valid Until", { x: idValidStartX, y, size: SIZE_SM, font: bold, color: INK })
	y -= LH * 2.5

	// ID lines
	const idRows = [
		{ type: data.govId1Type, number: data.govId1Number, validUntil: data.govId1ValidUntil },
		{ type: data.govId2Type, number: data.govId2Number, validUntil: data.govId2ValidUntil },
		{ type: data.govId3Type, number: data.govId3Number, validUntil: data.govId3ValidUntil },
	]

	for (const row of idRows) {
		page.drawLine({ start: { x: idNameStartX, y }, end: { x: idNameEndX, y }, thickness: 0.5, color: MUTED })
		page.drawLine({ start: { x: idNumberStartX, y }, end: { x: idNumberEndX, y }, thickness: 0.5, color: MUTED })
		page.drawLine({ start: { x: idValidStartX, y }, end: { x: idValidEndX, y }, thickness: 0.5, color: MUTED })
		if (row.type.trim()) {
			page.drawText(row.type, { x: idNameStartX + 2, y: y + 3, size: SIZE_SM, font: regular, color: INK })
		}
		if (row.number.trim()) {
			page.drawText(row.number, { x: idNumberStartX + 2, y: y + 3, size: SIZE_SM, font: regular, color: INK })
		}
		if (row.validUntil.trim()) {
			page.drawText(row.validUntil, { x: idValidStartX + 2, y: y + 3, size: SIZE_SM, font: regular, color: INK })
		}
		y -= LH * 1.8
	}

	await downloadPdf(pdf, `affidavit-of-loss-${Date.now()}.pdf`)
}

// â”€â”€ Affidavit of Discrepancy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function exportAffidavitOfDiscrepancy(
	data: AffidavitOfDiscrepancyData
): Promise<void> {
	const pdf = await PDFDocument.create()
	const regular = await pdf.embedFont(StandardFonts.TimesRoman)
	const bold = await pdf.embedFont(StandardFonts.TimesRomanBold)
	const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic)

	let page = pdf.addPage([PAGE_W, PAGE_H])
	const LH = SIZE_BODY * 1.55
	const LH_SM = SIZE_SM * 1.5
	let y = PAGE_H - MARGIN_TOP
	const x = MARGIN_H
	const indentX = x + 28

	const ensureSpace = (needed: number) => {
		if (y < MARGIN_BOTTOM + needed) {
			page = pdf.addPage([PAGE_W, PAGE_H])
			y = PAGE_H - MARGIN_TOP
		}
	}

	const drawParagraphWithPageBreak = (
		text: string,
		xPos: number,
		font: PDFFont = regular,
		size = SIZE_BODY,
		maxWidth = CONTENT_W,
		lineHeight = LH
	) => {
		const lines = wrapText(text, font, size, maxWidth)
		for (const line of lines) {
			if (y < MARGIN_BOTTOM + lineHeight) {
				page = pdf.addPage([PAGE_W, PAGE_H])
				y = PAGE_H - MARGIN_TOP
			}
			page.drawText(line, { x: xPos, y, size, font, color: INK })
			y -= lineHeight
		}
	}

	// Title
	y = drawCentred(page, "AFFIDAVIT OF DISCREPANCY", y, bold, SIZE_TITLE)
	y = drawCentred(page, "(ONE AND THE SAME PERSON)", y, bold, SIZE_SM + 1)
	y -= LH

	// Opening paragraph
	const civilStatusText =
		data.civilStatus === "married" ? `single/married to ${f(data.spouseName)}` : "single"
	const para1 = `I, ${f(data.affiantName)}, Filipino, ${civilStatusText}, of legal age, with address at ${f(data.address)}, after having been duly sworn to in accordance with law hereby depose and say:`
	drawParagraphWithPageBreak(para1, x)
	y -= LH

	// Document items (dynamic)
	const docs =
		data.documents.length > 0
			? data.documents
			: [{ type: "", issuedOn: "", issuedAt: "", valueShown: "" }]
	const dtype = f(data.discrepancyType, "[discrepancy type]")
	for (let i = 0; i < docs.length; i++) {
		ensureSpace(90)
		const doc = docs[i]!
		page.drawText(`${i + 1})`, { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
		const docText =
			i === 0
				? `The ${f(doc.type)} issued on ${f(doc.issuedOn)} at ${f(doc.issuedAt)} indicates my ${dtype} as ${f(doc.valueShown)}.`
				: `On the other hand, in the ${f(doc.type)} issued on ${f(doc.issuedOn)} at ${f(doc.issuedAt)}, my ${dtype} is indicated as ${f(doc.valueShown)}.`
		drawParagraphWithPageBreak(docText, indentX + 20, regular, SIZE_BODY, CONTENT_W - 48, LH)
		y -= LH * 0.5
	}

	// Closing items
	const closingNum = docs.length + 1
	const execNum = docs.length + 2
	ensureSpace(80)
	page.drawText(`${closingNum})`, { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	page.drawText("Both names/documents pertain to one and the same person.", {
		x: indentX + 20,
		y,
		size: SIZE_BODY,
		font: regular,
		color: INK,
	})
	y -= LH * 1.5

	ensureSpace(90)
	page.drawText(`${execNum})`, { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	const item4 =
		"I am executing this affidavit to attest to the truth and for whatever legal purposes it may serve."
	drawParagraphWithPageBreak(item4, indentX + 20, regular, SIZE_BODY, CONTENT_W - 48, LH)
	y -= LH * 2

	// IN WITNESS WHEREOF
	const witnessText = `IN WITNESS WHEREOF, I hereby affix my signature this ${f(data.signatureDate)} at the ${f(data.signatureCity)}.`
	drawParagraphWithPageBreak(witnessText, x, italic)
	y -= LH * 3

	// Signature line
	ensureSpace(110)
	const sigLineX = x + CONTENT_W / 2 - 40
	page.drawLine({
		start: { x: sigLineX, y },
		end: { x: sigLineX + 160, y },
		thickness: 0.75,
		color: MUTED,
	})
	y -= LH_SM
	page.drawText("Signature of Affiant over Printed Name", {
		x: sigLineX - 10,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	y -= LH * 1.5

	// Venue lines
	page.drawLine({ start: { x, y }, end: { x: x + 120, y }, thickness: 0.5, color: MUTED })
	page.drawText("  ) S.S.", { x: x + 120, y, size: SIZE_SM, font: regular, color: INK })
	y -= LH_SM
	page.drawLine({ start: { x, y }, end: { x: x + 120, y }, thickness: 0.5, color: MUTED })
	page.drawText("  )", { x: x + 120, y, size: SIZE_SM, font: regular, color: INK })
	y -= LH_SM
	page.drawLine({ start: { x, y }, end: { x: x + 120, y }, thickness: 0.5, color: MUTED })
	page.drawText("  )", { x: x + 120, y, size: SIZE_SM, font: regular, color: INK })
	y -= LH * 1.5

	// Subscribed
	const subText = `SUBSCRIBED AND SWORN to before me this ${f(data.swornDate)} at the ${f(data.swornAt)}, affiant having exhibited to me his/her ${f(data.passportNo)} passport no. ${f(data.passportIssuedIn)} issued in ${f(data.passportIssuedOn)} on ${f(data.validUntil)} and valid until ${f(data.validUntil)}.`
	drawParagraphWithPageBreak(subText, x)
	y -= LH * 1.5

	// Notarial footer
	page.drawText(`Date: ${f(data.notaryDate, "_____________")}`, {
		x,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	y -= LH_SM
	page.drawText(`Service No.: ${f(data.serviceNo, "_______")}`, {
		x,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	y -= LH_SM
	page.drawText(`O.R. No.: ${f(data.orNo, "_______")}`, {
		x,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	y -= LH_SM
	page.drawText(`Fee Paid: ${f(data.feePaid, "_______")}`, {
		x,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})

	page.drawText("Consul of the Republic of the Philippines", {
		x: PAGE_W - MARGIN_H - 240,
		y: y + LH_SM * 2,
		size: SIZE_SM,
		font: bold,
		color: INK,
	})

	await downloadPdf(pdf, `affidavit-of-discrepancy-${Date.now()}.pdf`)
}

// â”€â”€ Sworn Affidavit of Name Discrepancy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function exportSwornAffidavitNameDiscrepancy(
	data: SwornAffidavitNameDiscrepancyData
): Promise<void> {
	const pdf = await PDFDocument.create()
	const regular = await pdf.embedFont(StandardFonts.TimesRoman)
	const bold = await pdf.embedFont(StandardFonts.TimesRomanBold)
	const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic)
	const boldItalic = await pdf.embedFont(StandardFonts.TimesRomanBoldItalic)

	let page = pdf.addPage([PAGE_W, PAGE_H])
	const LH = SIZE_BODY * 1.55
	const LH_SM = SIZE_SM * 1.5
	let y = PAGE_H - MARGIN_TOP
	const x = MARGIN_H
	const indentX = x + 28

	const ensureSpace = (needed: number) => {
		if (y < MARGIN_BOTTOM + needed) {
			page = pdf.addPage([PAGE_W, PAGE_H])
			y = PAGE_H - MARGIN_TOP
		}
	}

	const drawParagraphWithPageBreak = (
		text: string,
		xPos: number,
		font: PDFFont = regular,
		size = SIZE_BODY,
		maxWidth = CONTENT_W,
		lineHeight = LH
	) => {
		const lines = wrapText(text, font, size, maxWidth)
		for (const line of lines) {
			if (y < MARGIN_BOTTOM + lineHeight) {
				page = pdf.addPage([PAGE_W, PAGE_H])
				y = PAGE_H - MARGIN_TOP
			}
			page.drawText(line, { x: xPos, y, size, font, color: INK })
			y -= lineHeight
		}
	}

	// Header
	page.drawText("Republic of the Philippines", { x, y, size: SIZE_SM, font: regular, color: INK })
	page.drawText(`City of ${f(data.city, "_______________")}`, {
		x,
		y: y - LH_SM,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	page.drawText(`${f(data.province, "_______________")} ) S.S.`, {
		x,
		y: y - LH_SM * 2,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	y -= LH_SM * 4

	// Title
	y = drawCentred(page, "AFFIDAVIT OF NAME DISCREPANCY", y, bold, SIZE_TITLE)
	y -= LH * 0.5

	// Opening
	const civilText =
		data.civilStatus === "married" ? "single/married" : data.civilStatus || "single/married"
	const para1 = `I, ${f(data.affiantName)}, of legal age, ${civilText}, Filipino citizen, residing at ${f(data.address)}, after having duly sworn to in accordance with law, do hereby depose and say that:`
	drawParagraphWithPageBreak(para1, x)
	y -= LH

	// Item 1
	ensureSpace(96)
	page.drawText("1.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	const item1 = `When I/He/She received the ${f(data.companyName, "Name of Stocks")} Stock Certificate No. ${f(data.stockCertificateNo)}, my/his/her name appeared as ${f(data.nameAppearedAs)}, whereas in all my/his/her documents and other records ${f(data.recordsName)}.`
	drawParagraphWithPageBreak(item1, indentX + 16, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= LH * 0.5

	const explanations = data.explanations.length > 0 ? data.explanations : [""]
	for (const [index, explanation] of explanations.entries()) {
		ensureSpace(90)
		page.drawText(`${index + 2}.`, { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
		drawParagraphWithPageBreak(f(explanation), indentX + 16, regular, SIZE_BODY, CONTENT_W - 44, LH)
		y -= LH * 0.5
	}

	const namesItemNumber = explanations.length + 2
	const indemnityItemNumber = namesItemNumber + 1
	const closingItemNumber = namesItemNumber + 2

	// Name variants item
	ensureSpace(90)
	page.drawText(`${namesItemNumber}.`, {
		x: indentX,
		y,
		size: SIZE_BODY,
		font: regular,
		color: INK,
	})
	const item4 = `I am executing this Affidavit to attest to the fact that the names ${f(data.name1, "Name1")}, ${f(data.name2, "Name2")}, and ${f(data.name3, "Name3")}, refers to one and the same person.`
	drawParagraphWithPageBreak(item4, indentX + 16, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= LH * 0.5

	// Indemnity item
	ensureSpace(120)
	page.drawText(`${indemnityItemNumber}.`, {
		x: indentX,
		y,
		size: SIZE_BODY,
		font: regular,
		color: INK,
	})
	const item5 = `I hereby further agree and undertake to hold free and harmless and to indemnify ${f(data.companyName, "Name of Stocks")}, its stock transfer agent ${f(data.companyName, "____________________")}, and their respective directors, officers and employees, of any and all claims, damages, charges, expenses, and liabilities of whatever nature that may arise from or in connection with the processing of stock-related transactions.`
	drawParagraphWithPageBreak(item5, indentX + 16, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= LH * 0.5

	// Closing item
	page.drawText(`${closingItemNumber}.`, {
		x: indentX,
		y,
		size: SIZE_BODY,
		font: regular,
		color: INK,
	})
	page.drawText(
		"Finally, I am executing this Affidavit to attest to the truth of the foregoing statements and for all legal intents and purposes it may serve.",
		{ x: indentX + 16, y, size: SIZE_BODY, font: regular, color: INK }
	)
	y -= LH * 2

	// IN WITNESS WHEREOF
	const witnessText = `IN WITNESS WHEREOF, I have hereunto affixed my signature this ${f(data.signDay, "____")} day of ${f(data.signMonth, "_______")}, 20${f(data.signYear, "__")} at ${f(data.signCity)}.`
	drawParagraphWithPageBreak(witnessText, x, italic)
	y -= LH * 3

	// Affiant signature
	const sigLineX = x + CONTENT_W / 2 - 40
	page.drawLine({
		start: { x: sigLineX, y },
		end: { x: sigLineX + 160, y },
		thickness: 0.75,
		color: MUTED,
	})
	y -= LH_SM
	page.drawText("Affiant", { x: sigLineX + 55, y, size: SIZE_SM, font: regular, color: INK })
	y -= LH * 1.5

	// Subscribed
	const subText = `SUBSCRIBED AND SWORN to before me this ${f(data.swornDate)} at ${f(data.swornAt)}, Philippines.`
	drawParagraphWithPageBreak(subText, x)
	y -= LH * 2

	await downloadPdf(pdf, `affidavit-of-name-discrepancy-stocks-${Date.now()}.pdf`)
}

// â”€â”€ Affidavit of Undertaking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function exportAffidavitOfUndertaking(
	data: AffidavitOfUndertakingData
): Promise<void> {
	const pdf = await PDFDocument.create()
	const regular = await pdf.embedFont(StandardFonts.TimesRoman)
	const bold = await pdf.embedFont(StandardFonts.TimesRomanBold)

	const LH = SIZE_BODY * 1.55
	const LH_SM = SIZE_SM * 1.5
	const x = MARGIN_H
	const indentX = x + 28

	let page = pdf.addPage([PAGE_W, PAGE_H])
	let y = PAGE_H - MARGIN_TOP

	const persons = data.personNames.length > 0 ? data.personNames : [""]
	const rows =
		data.paymentRows.length > 0 ? data.paymentRows : [{ name: "", amount: "", paymentDue: "" }]

	page.drawText("LUC FORM NO. 2", { x, y, size: SIZE_SM, font: bold, color: INK })
	y -= LH_SM
	page.drawText("SERIES OF 2002", { x, y, size: SIZE_SM, font: bold, color: INK })
	y -= LH_SM * 2

	page.drawText("REPUBLIC OF THE PHILIPPINES", { x, y, size: SIZE_SM, font: regular, color: INK })
	y -= LH_SM
	page.drawText(`MUNICIPALITY OF ${f(data.municipality)}`, {
		x,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	y -= LH_SM
	page.drawText(`PROVINCE OF ${f(data.province)} ) S.S.`, {
		x,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	y -= LH * 2

	y = drawCentred(page, "AFFIDAVIT OF UNDERTAKING", y, bold, SIZE_TITLE)
	y -= LH * 0.5

	const opening = `I, ${f(data.affiantName)}, of legal age, citizen of the ${f(data.citizenship, "Philippines")}, ${f(data.civilStatus, "single")}, with residence address at ${f(data.address)}, having been duly sworn in accordance with law, hereby depose and say that:`
	y = drawParagraph(page, opening, x, y, regular, SIZE_BODY, CONTENT_W, LH)
	y -= LH * 0.5

	page.drawText("1.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	const item1 = `I am the owner/authorized representative of the owner(s) of the ${f(data.parcelCount, "____")} parcel(s) of land subject to an application for conversion.`
	y = drawParagraph(page, item1, indentX + 16, y, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= LH * 0.4

	page.drawText("2.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	const item2 =
		"The land subject of my application for conversion has no vertical or horizontal development of any kind that is related to any non-agricultural use."
	y = drawParagraph(page, item2, indentX + 16, y, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= LH * 0.4

	page.drawText("3.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	const item3 =
		"I undertake to post a bond to guarantee the present status of the land and my obligations under this application."
	y = drawParagraph(page, item3, indentX + 16, y, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= LH * 0.7

	page.drawText("4.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	const item4 =
		"The total number of farmers, agricultural lessees, share tenants, farmworkers, actual tillers, occupants, or others directly working on the land is:"
	y = drawParagraph(page, item4, indentX + 16, y, regular, SIZE_BODY, CONTENT_W - 44, LH)

	page.drawText(`[ ${data.personsMode === "none" ? "x" : " "} ] None`, {
		x: indentX + 16,
		y,
		size: SIZE_BODY,
		font: regular,
		color: INK,
	})
	y -= LH

	page.drawText(
		`[ ${data.personsMode === "with-persons" ? "x" : " "} ] ${f(data.personsCount, "_____")} persons. Their names are:`,
		{ x: indentX + 16, y, size: SIZE_BODY, font: regular, color: INK }
	)
	y -= LH * 0.8

	if (data.personsMode === "with-persons") {
		for (const name of persons) {
			if (y < MARGIN_BOTTOM + 120) {
				page = pdf.addPage([PAGE_W, PAGE_H])
				y = PAGE_H - MARGIN_TOP
			}
			page.drawLine({
				start: { x: indentX + 20, y },
				end: { x: PAGE_W - MARGIN_H, y },
				thickness: 0.5,
				color: MUTED,
			})
			if (name.trim()) {
				page.drawText(name, {
					x: indentX + 22,
					y: y + 2,
					size: SIZE_SM,
					font: regular,
					color: INK,
				})
			}
			y -= LH_SM * 1.35
		}
	}

	if (y < MARGIN_BOTTOM + 240) {
		page = pdf.addPage([PAGE_W, PAGE_H])
		y = PAGE_H - MARGIN_TOP
	}

	page.drawText("5.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	const item5 =
		"I/we paid (or undertake to pay) disturbance compensation to the following persons at the following amounts and schedule of payments:"
	y = drawParagraph(page, item5, indentX + 16, y, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= LH * 0.4

	const tableX = x
	const tableW = CONTENT_W
	const col1W = tableW * 0.4
	const col2W = tableW * 0.27
	const col3W = tableW - col1W - col2W
	const minRowH = 20
	const cellPad = 6
	const cellLineH = SIZE_SM * 1.35

	const drawCell = (
		text: string,
		xPos: number,
		topY: number,
		width: number,
		font: PDFFont = regular,
		size = SIZE_SM
	) => {
		const lines = wrapText(text || "", font, size, width - cellPad * 2)
		let lineY = topY - size - 2
		for (const line of lines) {
			if (line.trim()) {
				page.drawText(line, { x: xPos + cellPad, y: lineY, size, font, color: INK })
			}
			lineY -= cellLineH
		}
		return lines.length
	}

	const drawTableHeader = () => {
		const headerH = minRowH
		page.drawRectangle({
			x: tableX,
			y: y - headerH,
			width: tableW,
			height: headerH,
			borderColor: INK,
			borderWidth: 0.8,
		})
		page.drawLine({
			start: { x: tableX + col1W, y },
			end: { x: tableX + col1W, y: y - headerH },
			thickness: 0.8,
			color: INK,
		})
		page.drawLine({
			start: { x: tableX + col1W + col2W, y },
			end: { x: tableX + col1W + col2W, y: y - headerH },
			thickness: 0.8,
			color: INK,
		})
		drawCell("NAME", tableX, y, col1W, bold)
		drawCell("Amount", tableX + col1W, y, col2W, bold)
		drawCell("Payment Due", tableX + col1W + col2W, y, col3W, bold)
		y -= headerH
	}

	drawTableHeader()

	for (const row of rows) {
		const rowLineCount = Math.max(
			wrapText(row.name || "", regular, SIZE_SM, col1W - cellPad * 2).length,
			wrapText(row.amount || "", regular, SIZE_SM, col2W - cellPad * 2).length,
			wrapText(row.paymentDue || "", regular, SIZE_SM, col3W - cellPad * 2).length
		)
		const rowH = Math.max(minRowH, rowLineCount * cellLineH + 6)

		if (y < MARGIN_BOTTOM + rowH + 8) {
			page = pdf.addPage([PAGE_W, PAGE_H])
			y = PAGE_H - MARGIN_TOP
			drawTableHeader()
		}

		page.drawRectangle({
			x: tableX,
			y: y - rowH,
			width: tableW,
			height: rowH,
			borderColor: INK,
			borderWidth: 0.8,
		})
		page.drawLine({
			start: { x: tableX + col1W, y },
			end: { x: tableX + col1W, y: y - rowH },
			thickness: 0.8,
			color: INK,
		})
		page.drawLine({
			start: { x: tableX + col1W + col2W, y },
			end: { x: tableX + col1W + col2W, y: y - rowH },
			thickness: 0.8,
			color: INK,
		})

		drawCell(row.name, tableX, y, col1W)
		drawCell(row.amount, tableX + col1W, y, col2W)
		drawCell(row.paymentDue, tableX + col1W + col2W, y, col3W)

		y -= rowH
	}

	const ensureSpace = (needed: number) => {
		if (y < MARGIN_BOTTOM + needed) {
			page = pdf.addPage([PAGE_W, PAGE_H])
			y = PAGE_H - MARGIN_TOP
		}
	}

	y -= LH
	ensureSpace(320)

	page.drawText("6.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	const item6 = `I/we erected ${f(data.billboardCount, "_______")} (number) of billboard(s) and undertake not to remove, deface, nor destroy said billboard(s), and that I/we shall repair or replace the same when damaged, until after the approving authority disposes of the application with finality.`
	y = drawParagraph(page, item6, indentX + 16, y, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= LH * 0.5

	page.drawText("7.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	const item7 =
		"I/we have not commenced any action or filed any claim involving the land subject of my/our application for conversion in any court, tribunal or quasi-judicial agency. To the best of my/our knowledge, no such other action or claim is pending therein. I/we have knowledge of any controversy or proceeding involving the said parcel of land(s) or the rights of person over its possession and entitlement to its fruits or rights thereto as beneficiary, the determination of which is filed before any tribunal, court, the DAR or any other agency."
	y = drawParagraph(page, item7, indentX + 16, y, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= LH * 0.5

	page.drawText("8.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	const item8 =
		'With this instrument, I/we authorize the DAR to forfeit the bond in paragraph "3" of this affidavit the moment the DAR finds, upon proper notice, that there is development within the area, undertaken either before or after the filing of the present conversion application that is related to any non-agricultural use before the issuance of a conversion order.'
	y = drawParagraph(page, item8, indentX + 16, y, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= LH * 1.5

	ensureSpace(220)

	const witness =
		"IN WITNESS WHEREOF, we hereunto affix our signatures on the date and in the place indicated below."
	y = drawParagraph(page, witness, x, y, regular, SIZE_BODY, CONTENT_W, LH)
	y -= LH * 0.8

	const sigX = PAGE_W - MARGIN_H - 220
	page.drawLine({ start: { x: sigX, y }, end: { x: sigX + 180, y }, thickness: 0.8, color: INK })
	y -= LH_SM
	page.drawText("LANDOWNER/APPLICANT", { x: sigX, y, size: SIZE_SM, font: regular, color: INK })
	y -= LH_SM
	page.drawText(`TIN: ${f(data.applicantTin, "__________________")}`, {
		x: sigX,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	y -= LH_SM
	page.drawText(`CTC No.: ${f(data.applicantCtcNo, "______________")}`, {
		x: sigX,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	y -= LH_SM
	page.drawText(`Place: ${f(data.applicantPlace, "________________")}`, {
		x: sigX,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	y -= LH_SM
	page.drawText(`Date: ${f(data.applicantDate, "_________________")}`, {
		x: sigX,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})

	y -= LH * 1.8

	page.drawText("REPUBLIC OF THE PHILIPPINES)", {
		x,
		y,
		size: SIZE_BODY,
		font: regular,
		color: INK,
	})
	y -= LH_SM
	page.drawText(`${f(data.subscribedPlace, "____________________________")}) S.S.`, {
		x,
		y,
		size: SIZE_BODY,
		font: regular,
		color: INK,
	})
	y -= LH * 1.4

	const subscribed = `SUBSCRIBED AND SWORN TO BEFORE ME, this day of ${f(data.subscribedDay, "____________")} in ${f(data.subscribedPlace, "________________")}, affiant exhibiting to me his/her Community Tax Certificate No. issued on ${f(data.ctcIssuedOn, "________________")} 20${f(data.ctcIssuedYear, "____")} at ${f(data.ctcIssuedAt, "__________________________")}.`
	y = drawParagraph(page, subscribed, x, y, regular, SIZE_BODY, CONTENT_W, LH)

	await downloadPdf(pdf, `affidavit-of-undertaking-${Date.now()}.pdf`)
}

// â”€â”€ Affidavit of Undertaking with Minor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function exportAffidavitOfUndertakingWithMinor(
	data: AffidavitOfUndertakingWithMinorData
): Promise<void> {
	const pdf = await PDFDocument.create()
	const regular = await pdf.embedFont(StandardFonts.TimesRoman)
	const bold = await pdf.embedFont(StandardFonts.TimesRomanBold)

	let page = pdf.addPage([PAGE_W, PAGE_H])
	const LH = SIZE_BODY * 1.55
	const LH_SM = SIZE_SM * 1.5
	let y = PAGE_H - MARGIN_TOP
	const x = MARGIN_H
	const indentX = x + 28

	// Header
	y = drawCentred(page, "Republic of the Philippines", y, bold, SIZE_TITLE)
	y -= LH * 0.8

	// Introduction
	const allSameStatus = data.companionLines.every(
		line => f(line.civilStatus) === f(data.companionLines[0]?.civilStatus || "")
	)

	let companionText = ""
	if (allSameStatus && data.companionLines.length > 0) {
		// All have same status: "Name1 and Name2, single"
		const names = data.companionLines.map(line => f(line.name)).join(" and ")
		const status = f(data.companionLines[0]?.civilStatus || "")
		companionText = `${names}, ${status}`
	} else {
		// Different statuses: "Name1, single and Name2, married"
		companionText = data.companionLines
			.map(line => `${f(line.name)}, ${f(line.civilStatus)}`)
			.join(" and ")
	}

	const intro = `I/We ${companionText} of legal age, ${f(data.companionLegalAge)}, and residing at ${f(data.companionAddress)}, after having been sworn to in accordance with the law do hereby depose and state that:`
	y = drawParagraph(page, intro, x, y, regular, SIZE_BODY, CONTENT_W, LH)
	y -= LH * 0.5

	const ensureSpace = (needed: number) => {
		if (y < MARGIN_BOTTOM + needed) {
			page = pdf.addPage([PAGE_W, PAGE_H])
			y = PAGE_H - MARGIN_TOP
		}
	}

	const drawParagraphWithPageBreak = (
		text: string,
		xPos: number,
		font: PDFFont = regular,
		size = SIZE_BODY,
		maxWidth = CONTENT_W,
		lineHeight = LH
	) => {
		const lines = wrapText(text, font, size, maxWidth)
		for (const line of lines) {
			if (y < MARGIN_BOTTOM + lineHeight) {
				page = pdf.addPage([PAGE_W, PAGE_H])
				y = PAGE_H - MARGIN_TOP
			}
			page.drawText(line, { x: xPos, y, size, font, color: INK })
			y -= lineHeight
		}
	}

	// Item 1
	page.drawText("1.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	const item1 = `That I/am/we are the companion of minor ${f(data.minorFirstName)} ${f(data.minorLastName)} who together with me/us will travel to ${f(data.travelCountry)} (date of travel) for the purpose of ${f(data.travelPurpose)} on ${f(data.travelDateStart)}.`
	drawParagraphWithPageBreak(item1, indentX + 16, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= LH * 0.5

	// Item 2
	ensureSpace(100)
	page.drawText("2.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	const item2 = `That said minor is the child of ${f(data.minorParentFirstName)} ${f(data.minorParentLastName)} who gave their full consent and permission to me as companion of their daughter/son.`
	drawParagraphWithPageBreak(item2, indentX + 16, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= LH * 0.5

	// Item 3
	page.drawText("3.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	const item3 = `That I am/We are the ${f(data.minorRelationship)} of the said minor;`
	drawParagraphWithPageBreak(item3, indentX + 16, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= LH * 0.5

	// Item 4
	ensureSpace(120)
	page.drawText("4.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	const item4 = `That I/We hereby undertake and affirm that I/We together with the minor will return to the Philippines as soon as we finish the duration of our ${f(data.returnDate)} in ${f(data.returnCountry)}.`
	drawParagraphWithPageBreak(item4, indentX + 16, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= LH * 0.5

	// Item 5
	page.drawText("5.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	const item5 =
		"That I/We assume full responsibility over the minor's safety and welfare during the entire duration of our travel and stay at (place where minor(s) is to stay) and hold the staff, officers and/or any employee of DSWB Field Office MIMAROPA free and harmless from all and any liability arising from the processing of this application."
	drawParagraphWithPageBreak(item5, indentX + 16, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= LH * 0.5

	// Item 6
	ensureSpace(100)
	page.drawText("6.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	const item6 =
		"That this affidavit was executed for the purpose of attesting to the truth of the foregoing facts and for whatever legal purpose it may serve."
	drawParagraphWithPageBreak(item6, indentX + 16, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= LH

	ensureSpace(240)

	// IN WITNESS WHEREOF
	const witness = `IN WITNESS WHEREOF, I have hereunto set my hand this ${f(data.signatureDay, "___")} th day of ${f(data.signatureMonth, "_______")}, 20${f(data.signatureYear, "__")} in ${f(data.signatureLocation, "_____________")}, Philippines.`
	drawParagraphWithPageBreak(witness, x)
	y -= LH * 1.2

	// Signature line
	const sigX = x + 200
	page.drawLine({ start: { x: sigX, y }, end: { x: sigX + 200, y }, thickness: 0.8, color: INK })
	y -= LH_SM
	page.drawText("AFFIANT", { x: sigX + 60, y, size: SIZE_SM, font: regular, color: INK })

	y -= LH * 1.8

	// SUBSCRIBED AND SWORN
	const subscribed = `SUBSCRIBE AND SWORN TO before me this___ in day of____, 20____ in ${f(data.subscribedLocation, "Philippines")}. Affiant exhibited to me his/her ${f(data.governmentIdType, "ID")} No. ${f(data.governmentIdNumber, "_____")}, issued on ${f(data.governmentIdDate, "_____")} thereon as proof of her identity.`
	drawParagraphWithPageBreak(subscribed, x)

	await downloadPdf(pdf, `affidavit-of-undertaking-with-minor-${Date.now()}.pdf`)
}

// â”€â”€ Affidavit of Undertaking to Submit PSA Copy of Birth/Marriage Certificate â”€
export async function exportAffidavitOfUndertakingPsaBirthMarriageCertificate(
	data: AffidavitOfUndertakingPsaBirthMarriageCertificateData
): Promise<void> {
	const pdf = await PDFDocument.create()
	const regular = await pdf.embedFont(StandardFonts.TimesRoman)
	const bold = await pdf.embedFont(StandardFonts.TimesRomanBold)
	const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic)

	let page = pdf.addPage([PAGE_W, PAGE_H])
	const LH = SIZE_BODY * 1.45
	const LH_SM = SIZE_SM * 1.4
	const x = MARGIN_H
	const indentX = x + 24
	let y = PAGE_H - MARGIN_TOP

	const ensureSpace = (needed: number) => {
		if (y < MARGIN_BOTTOM + needed) {
			page = pdf.addPage([PAGE_W, PAGE_H])
			y = PAGE_H - MARGIN_TOP
		}
	}

	page.drawText("ANNEX B", { x: PAGE_W - 120, y, size: SIZE_TITLE - 1, font: bold, color: INK })
	y -= 40

	page.drawText("Republic of the Philippines", { x, y, size: SIZE_SM, font: regular, color: INK })
	y -= LH_SM
	page.drawText(`City of ${f(data.cityMunicipality, "_______________")}`, {
		x,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	page.drawText(" ) S.S.", { x: x + 240, y, size: SIZE_SM, font: regular, color: INK })
	y -= 30

	page.drawText("AFFIDAVIT OF UNDERTAKING", {
		x: 160,
		y,
		size: SIZE_TITLE + 1,
		font: bold,
		color: INK,
	})
	y -= 18
	page.drawText("To Submit PSA Copy of Birth/Marriage Certificate", {
		x: 98,
		y,
		size: SIZE_TITLE,
		font: bold,
		color: INK,
	})
	y -= 30

	const applicantName = [
		data.affiantGivenName,
		data.affiantMiddleName,
		data.affiantSurname,
		data.affiantSuffix,
	]
		.filter(part => part.trim())
		.join(" ")
	const correctionRows =
		data.correctionRows.length > 0
			? data.correctionRows
			: [{ category: "", incorrectEntry: "", correctEntry: "" }]
	const hasFilledCorrectionRows = correctionRows.some(
		row => row.category.trim() || row.incorrectEntry.trim() || row.correctEntry.trim()
	)
	const shouldShowCorrectionEntries = data.needsCorrectionEntries || hasFilledCorrectionRows

	const intro = `I, ${f(applicantName)}, [${f(data.affiantSurname, "Surname")}, ${f(data.affiantGivenName, "Given Name")}, ${f(data.affiantMiddleName, "Middle Name")}, ${f(data.affiantSuffix, "Suffix")}] of legal age, Filipino citizen, and a resident of ${f(data.affiantAddress)}, hereby depose and state that:`
	y = drawParagraph(page, intro, x, y, regular, SIZE_BODY, CONTENT_W, LH)
	y -= 4

	const item1 = `I am a ${f(data.applicantType, "New Applicant")} for the ${f(data.barExaminationYear, "2026")} Bar Examinations;`
	page.drawText("1.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	y = drawParagraph(page, item1, indentX + 16, y, regular, SIZE_BODY, CONTENT_W - 44, LH)
	y -= 4

	ensureSpace(140)
	page.drawText("2.", { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
	page.drawText("The following documentary deficiency(ies) and/or discrepancy(ies) apply to me:", {
		x: indentX + 16,
		y,
		size: SIZE_BODY,
		font: regular,
		color: INK,
		maxWidth: CONTENT_W - 44,
	})
	y -= LH
	page.drawText("[Check all that are applicable]", {
		x: indentX + 16,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	y -= 16

	const checkboxLine = (checked: boolean, text: string) => {
		page.drawText(checked ? "\u2713" : "", {
			x: indentX + 20,
			y: y + 1,
			size: SIZE_SM,
			font: bold,
			color: INK,
		})
		page.drawText(text, {
			x: indentX + 34,
			y,
			size: SIZE_BODY - 1,
			font: regular,
			color: INK,
			maxWidth: CONTENT_W - 70,
		})
		y -= LH
	}

	checkboxLine(
		data.noBirthRecord,
		"I have no record of birth with the Philippine Statistics Authority (PSA) and/or the Local Civil Registry (LCR)."
	)
	checkboxLine(
		data.recentlyMarriedNoMarriageCertificate,
		"I recently got married and the PSA-issued copy of my Marriage Certificate is not yet available."
	)
	checkboxLine(
		shouldShowCorrectionEntries,
		"My PSA-issued Birth/Marriage Certificate needs correction of entry(ies)."
	)

	if (shouldShowCorrectionEntries) {
		ensureSpace(120)
		const tableX = x + 18
		const tableW = CONTENT_W - 36
		const col1W = tableW * 0.32
		const col2W = tableW * 0.34
		const col3W = tableW - col1W - col2W
		const minRowH = 18
		const cellPad = 4
		const cellLineH = (SIZE_SM - 1) * 1.3

		const drawCell = (
			text: string,
			xPos: number,
			topY: number,
			width: number,
			font: PDFFont = regular,
			size = SIZE_SM - 1
		) => {
			const lines = wrapText(text || "", font, size, width - cellPad * 2)
			let lineY = topY - size - 2
			for (const line of lines) {
				if (line.trim()) {
					page.drawText(line, { x: xPos + cellPad, y: lineY, size, font, color: INK })
				}
				lineY -= cellLineH
			}
			return lines.length
		}

		const drawHeader = () => {
			const headerH = minRowH
			page.drawRectangle({
				x: tableX,
				y: y - headerH,
				width: tableW,
				height: headerH,
				borderColor: INK,
				borderWidth: 0.7,
			})
			page.drawLine({
				start: { x: tableX + col1W, y },
				end: { x: tableX + col1W, y: y - headerH },
				thickness: 0.7,
				color: INK,
			})
			page.drawLine({
				start: { x: tableX + col1W + col2W, y },
				end: { x: tableX + col1W + col2W, y: y - headerH },
				thickness: 0.7,
				color: INK,
			})
			drawCell("Category", tableX, y, col1W, bold)
			drawCell("Incorrect Entry", tableX + col1W, y, col2W, bold)
			drawCell("Correct Entry", tableX + col1W + col2W, y, col3W, bold)
			y -= headerH
		}

		drawHeader()
		for (const row of correctionRows) {
			const rowLineCount = Math.max(
				wrapText(row.category || "", regular, SIZE_SM - 1, col1W - cellPad * 2).length,
				wrapText(row.incorrectEntry || "", regular, SIZE_SM - 1, col2W - cellPad * 2).length,
				wrapText(row.correctEntry || "", regular, SIZE_SM - 1, col3W - cellPad * 2).length
			)
			const rowH = Math.max(minRowH, rowLineCount * cellLineH + 6)

			if (y < MARGIN_BOTTOM + rowH + 8) {
				page = pdf.addPage([PAGE_W, PAGE_H])
				y = PAGE_H - MARGIN_TOP
				drawHeader()
			}

			page.drawRectangle({
				x: tableX,
				y: y - rowH,
				width: tableW,
				height: rowH,
				borderColor: INK,
				borderWidth: 0.7,
			})
			page.drawLine({
				start: { x: tableX + col1W, y },
				end: { x: tableX + col1W, y: y - rowH },
				thickness: 0.7,
				color: INK,
			})
			page.drawLine({
				start: { x: tableX + col1W + col2W, y },
				end: { x: tableX + col1W + col2W, y: y - rowH },
				thickness: 0.7,
				color: INK,
			})
			drawCell(row.category, tableX, y, col1W)
			drawCell(row.incorrectEntry, tableX + col1W, y, col2W)
			drawCell(row.correctEntry, tableX + col1W + col2W, y, col3W)
			y -= rowH
		}
		y -= 8
	}

	const items = [
		`Despite diligent efforts to comply with the application requirements for the ${f(data.barExaminationYear, "2026")} Bar Examinations, I will not be able to submit the required PSA/LCR-issued document(s) within the prescribed period due to reasons not attributable to me;`,
		`On ${f(data.filingDate, "____________")}, I have filed with the ${f(data.filingOfficeType, "LCR")} of ${f(data.filingPlace, "____________")} for the registration/correction of my Birth/Marriage Certificate, as evidenced by the attached proof of filing ${f(data.proofOfFilingDescription, "attached proof of filing")};`,
		`I UNDERTAKE to submit the issued/corrected PSA copy of my Birth/Marriage Certificate to the Office of the Bar Confidant by ${f(data.submitByDate, "October 13, 2026 (Tuesday)")} or once available; and`,
		`I ACCEPT that failure to comply with the above undertaking shall be a ground for my disqualification from the ${f(data.barExaminationYear, "2026")} Bar Examinations or the withholding of my admission to the Bar despite having passed the examinations.`,
	]

	for (let i = 0; i < items.length; i++) {
		ensureSpace(96)
		page.drawText(`${i + 3}.`, { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
		y = drawParagraph(page, items[i]!, indentX + 16, y, regular, SIZE_BODY, CONTENT_W - 44, LH)
		y -= 4
	}

	y -= 4
	page.drawText("Further affiant sayeth naught.", {
		x: x + 8,
		y,
		size: SIZE_BODY,
		font: italic,
		color: INK,
	})
	y -= 24

	const witness = `IN WITNESS WHEREOF, I hereby set my hand this ${f(data.witnessDay, "____")} day of ${f(data.witnessMonth, "____________")} 20${f(data.witnessYear, "__")} in ${f(data.witnessCityMunicipality, "____________")}, Philippines.`
	y = drawParagraph(page, witness, x, y, regular, SIZE_BODY, CONTENT_W, LH)
	y -= 26

	const sigW = 220
	page.drawLine({
		start: { x: x + CONTENT_W / 2 - sigW / 2, y },
		end: { x: x + CONTENT_W / 2 + sigW / 2, y },
		thickness: 0.8,
		color: INK,
	})
	y -= 12
	page.drawText("AFFIANT", {
		x: x + CONTENT_W / 2 - 18,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	y -= 28

	const subscribed = `SUBSCRIBED and SWORN to before me this ${f(data.subscribedDay, "____")} day of ${f(data.subscribedMonth, "____________")} 20${f(data.subscribedYear, "__")} in ${f(data.subscribedCityMunicipality, "________________")}, Philippines, affiant exhibiting their proof of identity ${f(data.idType, "____________")} No. ${f(data.idNumber, "____________")}.`
	y = drawParagraph(page, subscribed, x, y, regular, SIZE_BODY, CONTENT_W, LH)

	await downloadPdf(
		pdf,
		`affidavit-of-undertaking-psa-birth-marriage-certificate-${Date.now()}.pdf`
	)
}

// â”€â”€ Sworn Statement of Assets, Liabilities and Net Worth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function exportSwornStatementAssetsLiabilitiesNetWorth(
	data: SwornStatementAssetsLiabilitiesNetWorthData
): Promise<void> {
	const pdf = await PDFDocument.create()
	const regular = await pdf.embedFont(StandardFonts.TimesRoman)
	const bold = await pdf.embedFont(StandardFonts.TimesRomanBold)
	const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic)

	const topMargin = 48
	const left = 48
	const right = 48
	const contentWidth = PAGE_W - left - right
	const lineHeight = 10
	const cellFontSize = 7
	const headerFontSize = 7
	let page = pdf.addPage([PAGE_W, PAGE_H])
	let y = PAGE_H - topMargin

	const addPage = (includeDocumentHeader = false) => {
		page = pdf.addPage([PAGE_W, PAGE_H])
		y = PAGE_H - topMargin
		if (includeDocumentHeader) drawDocumentHeader()
	}

	const ensureSpace = (needed: number) => {
		if (y - needed < MARGIN_BOTTOM) {
			addPage(false)
		}
	}

	const drawDocumentHeader = () => {
		page.drawText("Revised as of January 2015", {
			x: PAGE_W - 170,
			y,
			size: 8,
			font: regular,
			color: INK,
		})
		y -= 10
		page.drawText("Per CSC Resolution No. 1500888", {
			x: PAGE_W - 170,
			y,
			size: 8,
			font: regular,
			color: INK,
		})
		y -= 10
		page.drawText("Promulgated on January 23, 2015", {
			x: PAGE_W - 170,
			y,
			size: 8,
			font: regular,
			color: INK,
		})
		y -= 22

		const title = "SWORN STATEMENT OF ASSETS, LIABILITIES AND NET WORTH"
		page.drawText(title, {
			x: (PAGE_W - bold.widthOfTextAtSize(title, 13)) / 2,
			y,
			size: 13,
			font: bold,
			color: INK,
		})
		y -= 15

		const asOf = `As of ${f(data.asOfDate)}`
		page.drawText(asOf, {
			x: (PAGE_W - regular.widthOfTextAtSize(asOf, 10)) / 2,
			y,
			size: 10,
			font: regular,
			color: INK,
		})
		y -= 12

		const required = "(Required by R.A. 6713)"
		page.drawText(required, {
			x: (PAGE_W - italic.widthOfTextAtSize(required, 8)) / 2,
			y,
			size: 8,
			font: italic,
			color: INK,
		})
		y -= 18

		const note1 =
			"Note: Husband and wife who are both public officials and employees may file the required statements jointly or separately."
		page.drawText(note1, {
			x: (PAGE_W - italic.widthOfTextAtSize(note1, 8)) / 2,
			y,
			size: 8,
			font: italic,
			color: INK,
		})
		y -= 10

		const note2 = "[ ] Joint Filing   [ ] Separate Filing   [ ] Not Applicable"
		page.drawText(note2, {
			x: (PAGE_W - regular.widthOfTextAtSize(note2, 8)) / 2,
			y,
			size: 8,
			font: regular,
			color: INK,
		})
		y -= 10

		const filingLabel =
			data.filingType === "joint"
				? "Joint Filing"
				: data.filingType === "separate"
					? "Separate Filing"
					: "Not Applicable"
		page.drawText(filingLabel, {
			x: (PAGE_W - bold.widthOfTextAtSize(filingLabel, 8)) / 2,
			y,
			size: 8,
			font: bold,
			color: INK,
		})
		y -= 16
	}

	const drawCellText = (
		text: string,
		xPos: number,
		topY: number,
		width: number,
		font: PDFFont,
		size: number,
		lineGap: number
	) => {
		const lines = wrapText(text || "", font, size, width - 6)
		let lineY = topY - size - 2
		for (const line of lines) {
			if (line.trim()) {
				page.drawText(line, { x: xPos + 3, y: lineY, size, font, color: INK })
			}
			lineY -= lineGap
		}
		return lines.length
	}

	const drawTable = (
		headers: string[],
		widths: number[],
		rows: Array<string[]>,
		minRowHeight = 18
	) => {
		const tableX = left
		const tableWidth = widths.reduce((sum, width) => sum + width, 0)

		const drawHeaderRow = () => {
			const headerLineCounts = headers.map(
				(header, index) => wrapText(header, bold, headerFontSize, widths[index]! - 6).length
			)
			const headerHeight = Math.max(minRowHeight, Math.max(...headerLineCounts) * 8 + 6)
			page.drawRectangle({
				x: tableX,
				y: y - headerHeight,
				width: tableWidth,
				height: headerHeight,
				borderColor: INK,
				borderWidth: 0.7,
				color: rgb(0.87, 0.87, 0.87),
			})
			let currentX = tableX
			for (const [index, header] of headers.entries()) {
				if (index > 0) {
					page.drawLine({
						start: { x: currentX, y },
						end: { x: currentX, y: y - headerHeight },
						thickness: 0.7,
						color: INK,
					})
				}
				drawCellText(header, currentX, y, widths[index]!, bold, headerFontSize, 8)
				currentX += widths[index]!
			}
			y -= headerHeight
		}

		ensureSpace(minRowHeight + 16)
		drawHeaderRow()

		for (const row of rows) {
			const cellLines = row.map(
				(cell, index) => wrapText(cell || "", regular, cellFontSize, widths[index]! - 6).length
			)
			const rowHeight = Math.max(minRowHeight, Math.max(...cellLines) * 8 + 6)
			if (y - rowHeight < MARGIN_BOTTOM) {
				addPage(false)
				drawHeaderRow()
			}

			page.drawRectangle({
				x: tableX,
				y: y - rowHeight,
				width: tableWidth,
				height: rowHeight,
				borderColor: INK,
				borderWidth: 0.6,
			})

			let currentX = tableX
			for (const [index, cell] of row.entries()) {
				if (index > 0) {
					page.drawLine({
						start: { x: currentX, y },
						end: { x: currentX, y: y - rowHeight },
						thickness: 0.6,
						color: INK,
					})
				}
				drawCellText(cell, currentX, y, widths[index]!, regular, cellFontSize, 8)
				currentX += widths[index]!
			}
			y -= rowHeight
		}
	}

	const drawRightValue = (label: string, value: string, minLineWidth: number) => {
		const valueText = value.trim() ? value : ""
		const labelWidth = bold.widthOfTextAtSize(label, 8)
		const valueWidth = Math.max(
			minLineWidth,
			regular.widthOfTextAtSize(valueText || "________", 8) + 12
		)
		const startX = PAGE_W - right - labelWidth - valueWidth - 4
		page.drawText(label, { x: startX, y, size: 8, font: bold, color: INK })
		page.drawLine({
			start: { x: startX + labelWidth + 4, y: y + 2 },
			end: { x: startX + labelWidth + 4 + valueWidth, y: y + 2 },
			thickness: 0.6,
			color: INK,
		})
		if (valueText) {
			page.drawText(valueText, {
				x: startX + labelWidth + 8,
				y,
				size: 8,
				font: regular,
				color: INK,
			})
		}
	}

	drawDocumentHeader()

	const leftBlockWidth = 240
	const rightBlockX = left + 300
	const rightBlockWidth = PAGE_W - rightBlockX - right

	page.drawText("DECLARANT", { x: left, y, size: 8, font: bold, color: INK })
	const nameY = y
	page.drawLine({
		start: { x: left + 74, y: nameY + 2 },
		end: { x: left + leftBlockWidth, y: nameY + 2 },
		thickness: 0.6,
		color: INK,
	})
	page.drawText(
		`${f(data.declarantFamilyName)}  ${f(data.declarantFirstName)}  ${f(data.declarantMiddleInitial)}`,
		{
			x: left + 80,
			y: nameY,
			size: 8,
			font: regular,
			color: INK,
		}
	)
	page.drawText("POSITION", { x: rightBlockX, y, size: 8, font: bold, color: INK })
	page.drawLine({
		start: { x: rightBlockX + 58, y: y + 2 },
		end: { x: rightBlockX + rightBlockWidth, y: y + 2 },
		thickness: 0.6,
		color: INK,
	})
	page.drawText(f(data.declarantPosition), {
		x: rightBlockX + 64,
		y,
		size: 8,
		font: regular,
		color: INK,
	})
	y -= 11
	page.drawText("", { x: left, y, size: 7, font: regular, color: INK })
	page.drawText("(Family Name)      (First Name)      (M.I.)", {
		x: left + 92,
		y,
		size: 7,
		font: regular,
		color: INK,
	})
	y -= 11
	page.drawText("ADDRESS", { x: left, y, size: 8, font: bold, color: INK })
	page.drawLine({
		start: { x: left + 54, y: y + 2 },
		end: { x: left + leftBlockWidth, y: y + 2 },
		thickness: 0.6,
		color: INK,
	})
	page.drawText(f(data.declarantOfficeAddress), {
		x: left + 60,
		y,
		size: 8,
		font: regular,
		color: INK,
	})
	page.drawText("AGENCY/OFFICE", { x: rightBlockX, y, size: 8, font: bold, color: INK })
	page.drawLine({
		start: { x: rightBlockX + 84, y: y + 2 },
		end: { x: rightBlockX + rightBlockWidth, y: y + 2 },
		thickness: 0.6,
		color: INK,
	})
	page.drawText(f(data.declarantAgencyOffice), {
		x: rightBlockX + 90,
		y,
		size: 8,
		font: regular,
		color: INK,
	})
	y -= 11
	page.drawText("", { x: left, y, size: 7, font: regular, color: INK })
	page.drawText("", { x: rightBlockX, y, size: 7, font: regular, color: INK })
	y -= 11
	page.drawText("", { x: left, y, size: 7, font: regular, color: INK })
	page.drawText("OFFICE ADDRESS", { x: rightBlockX, y, size: 8, font: bold, color: INK })
	page.drawLine({
		start: { x: rightBlockX + 88, y: y + 2 },
		end: { x: rightBlockX + rightBlockWidth, y: y + 2 },
		thickness: 0.6,
		color: INK,
	})
	page.drawText(f(data.declarantOfficeAddress), {
		x: rightBlockX + 94,
		y,
		size: 8,
		font: regular,
		color: INK,
	})
	y -= 18

	page.drawText("SPOUSE", { x: left, y, size: 8, font: bold, color: INK })
	page.drawLine({
		start: { x: left + 50, y: y + 2 },
		end: { x: left + leftBlockWidth, y: y + 2 },
		thickness: 0.6,
		color: INK,
	})
	page.drawText(
		`${f(data.spouseFamilyName)}  ${f(data.spouseFirstName)}  ${f(data.spouseMiddleInitial)}`,
		{
			x: left + 56,
			y,
			size: 8,
			font: regular,
			color: INK,
		}
	)
	page.drawText("POSITION", { x: rightBlockX, y, size: 8, font: bold, color: INK })
	page.drawLine({
		start: { x: rightBlockX + 58, y: y + 2 },
		end: { x: rightBlockX + rightBlockWidth, y: y + 2 },
		thickness: 0.6,
		color: INK,
	})
	page.drawText(f(data.spousePosition), {
		x: rightBlockX + 64,
		y,
		size: 8,
		font: regular,
		color: INK,
	})
	y -= 11
	page.drawText("", { x: left, y, size: 7, font: regular, color: INK })
	page.drawText("(Family Name)      (First Name)      (M.I.)", {
		x: left + 92,
		y,
		size: 7,
		font: regular,
		color: INK,
	})
	y -= 11
	page.drawText("", { x: left, y, size: 7, font: regular, color: INK })
	page.drawText("AGENCY/OFFICE", { x: rightBlockX, y, size: 8, font: bold, color: INK })
	page.drawLine({
		start: { x: rightBlockX + 84, y: y + 2 },
		end: { x: rightBlockX + rightBlockWidth, y: y + 2 },
		thickness: 0.6,
		color: INK,
	})
	page.drawText(f(data.spouseAgencyOffice), {
		x: rightBlockX + 90,
		y,
		size: 8,
		font: regular,
		color: INK,
	})
	y -= 11
	page.drawText("", { x: left, y, size: 7, font: regular, color: INK })
	page.drawText("OFFICE ADDRESS", { x: rightBlockX, y, size: 8, font: bold, color: INK })
	page.drawLine({
		start: { x: rightBlockX + 88, y: y + 2 },
		end: { x: rightBlockX + rightBlockWidth, y: y + 2 },
		thickness: 0.6,
		color: INK,
	})
	page.drawText(f(data.spouseOfficeAddress), {
		x: rightBlockX + 94,
		y,
		size: 8,
		font: regular,
		color: INK,
	})
	y -= 20

	const childrenRows =
		data.householdChildren.length > 0
			? data.householdChildren
			: defaultSwornStatementAssetsLiabilitiesNetWorth.householdChildren
	const realRows =
		data.realProperties.length > 0
			? data.realProperties
			: defaultSwornStatementAssetsLiabilitiesNetWorth.realProperties
	const personalRows =
		data.personalProperties.length > 0
			? data.personalProperties
			: defaultSwornStatementAssetsLiabilitiesNetWorth.personalProperties
	const liabilityRows =
		data.liabilities.length > 0
			? data.liabilities
			: defaultSwornStatementAssetsLiabilitiesNetWorth.liabilities
	const businessRows =
		data.businessInterests.length > 0
			? data.businessInterests
			: defaultSwornStatementAssetsLiabilitiesNetWorth.businessInterests
	const relativeRows =
		data.relativesInGovernmentService.length > 0
			? data.relativesInGovernmentService
			: defaultSwornStatementAssetsLiabilitiesNetWorth.relativesInGovernmentService

	const childrenTitle =
		"UNMARRIED CHILDREN BELOW EIGHTEEN (18) YEARS OF AGE LIVING IN DECLARANT'S HOUSEHOLD"
	page.drawText(childrenTitle, {
		x: (PAGE_W - bold.widthOfTextAtSize(childrenTitle, 9)) / 2,
		y,
		size: 9,
		font: bold,
		color: INK,
	})
	y -= 14
	drawTable(
		["Name", "Date of Birth", "Age"],
		[260, 180, 76],
		childrenRows.map(row => [row.name, row.dateOfBirth, row.age]),
		18
	)
	y -= 10

	const assetsTitle = "ASSETS, LIABILITIES AND NET WORTH"
	page.drawText(assetsTitle, {
		x: (PAGE_W - bold.widthOfTextAtSize(assetsTitle, 9)) / 2,
		y,
		size: 9,
		font: bold,
		color: INK,
	})
	y -= 14
	page.drawText("1. Assets", { x: left, y, size: 9, font: bold, color: INK })
	y -= 10
	page.drawText("a. Real Properties*", { x: left, y, size: 8, font: italic, color: INK })
	y -= 10
	drawTable(
		[
			"Description",
			"Kind",
			"Exact Location",
			"Assessed Value",
			"Current Fair Market Value",
			"Year",
			"Mode",
			"Acquisition Cost",
		],
		[92, 58, 105, 65, 85, 28, 28, 55],
		realRows.map(row => [
			row.description,
			row.kind,
			row.exactLocation,
			row.assessedValue,
			row.currentFairMarketValue,
			row.acquisitionYear,
			row.acquisitionMode,
			row.acquisitionCost,
		]),
		18
	)
	drawRightValue("Subtotal:", data.totalAssets, 60)
	y -= 18
	page.drawText("b. Personal Properties*", { x: left, y, size: 8, font: italic, color: INK })
	y -= 10
	drawTable(
		["Description", "Year Acquired", "Acquisition Cost/Amount"],
		[300, 140, 76],
		personalRows.map(row => [row.description, row.yearAcquired, row.acquisitionCostAmount]),
		18
	)
	drawRightValue("Subtotal:", data.totalAssets, 60)
	y -= 18
	drawRightValue("TOTAL ASSETS (a+b):", data.totalAssets, 90)
	y -= 20

	page.drawText("2. Liabilities", { x: left, y, size: 9, font: bold, color: INK })
	y -= 10
	drawTable(
		["Nature", "Name of Creditors", "Outstanding Balance"],
		[180, 180, 156],
		liabilityRows.map(row => [row.nature, row.creditor, row.outstandingBalance]),
		18
	)
	drawRightValue("Total Liabilities:", data.totalLiabilities, 60)
	y -= 16
	drawRightValue("Net Worth:", data.netWorth, 84)
	y -= 22

	const businessTitle = "BUSINESS INTERESTS AND FINANCIAL CONNECTIONS"
	page.drawText(businessTitle, {
		x: (PAGE_W - bold.widthOfTextAtSize(businessTitle, 9)) / 2,
		y,
		size: 9,
		font: bold,
		color: INK,
	})
	y -= 10
	drawTable(
		[
			"Name of Entity/Business Enterprise",
			"Business Address",
			"Nature of Business Interest/Financial Connection",
			"Date of Acquisition",
		],
		[150, 92, 194, 80],
		businessRows.map(row => [
			row.nameOfEntity,
			row.businessAddress,
			row.natureOfBusinessInterest,
			row.dateOfAcquisition,
		]),
		18
	)
	y -= 20

	const relativesTitle = "RELATIVES IN THE GOVERNMENT SERVICE"
	page.drawText(relativesTitle, {
		x: (PAGE_W - bold.widthOfTextAtSize(relativesTitle, 9)) / 2,
		y,
		size: 9,
		font: bold,
		color: INK,
	})
	y -= 10
	drawTable(
		["Name of Relative", "Relationship", "Position", "Name of Agency/Office and Address"],
		[120, 92, 60, 244],
		relativeRows.map(row => [row.name, row.relationship, row.position, row.agencyOfficeAddress]),
		18
	)
	y -= 16

	ensureSpace(140)
	y = drawParagraph(
		page,
		"I hereby certify that these are true and correct statements of my assets, liabilities, net worth, business interests and financial connections, including those of my spouse and unmarried children below eighteen (18) years of age living in my household, and that to the best of my knowledge, the above-enumerated are names of my relatives in the government within the fourth civil degree of consanguinity or affinity.",
		left,
		y,
		regular,
		8,
		contentWidth,
		10
	)
	y -= 10
	y = drawParagraph(
		page,
		"I hereby authorize the Ombudsman or his/her duly authorized representative to obtain and secure from all appropriate government agencies, including the Bureau of Internal Revenue such documents that may show my assets, liabilities, net worth, business interests and financial connections, to include those of my spouse and unmarried children below 18 years of age living with me in my household covering previous years to include the year I first assumed office in government.",
		left,
		y,
		regular,
		8,
		contentWidth,
		10
	)
	y -= 18

	page.drawText(`Date: ${f(data.statementDate, "____________________")}`, {
		x: left,
		y,
		size: 8,
		font: regular,
		color: INK,
	})
	y -= 26

	const sigWidth = 210
	page.drawLine({
		start: { x: left, y },
		end: { x: left + sigWidth, y },
		thickness: 0.6,
		color: INK,
	})
	page.drawLine({
		start: { x: PAGE_W - right - sigWidth, y },
		end: { x: PAGE_W - right, y },
		thickness: 0.6,
		color: INK,
	})
	y -= 10
	page.drawText("(Signature of Declarant)", { x: left + 42, y, size: 8, font: italic, color: INK })
	page.drawText("(Signature of Co-Declarant/Spouse)", {
		x: PAGE_W - right - sigWidth + 20,
		y,
		size: 8,
		font: italic,
		color: INK,
	})
	y -= 14

	page.drawText(`Government Issued ID: ${f(data.declarantGovIdType)}`, {
		x: left,
		y,
		size: 8,
		font: regular,
		color: INK,
	})
	page.drawText(`Government Issued ID: ${f(data.spouseGovIdType)}`, {
		x: PAGE_W - right - sigWidth,
		y,
		size: 8,
		font: regular,
		color: INK,
	})
	y -= 10
	page.drawText(`ID No.: ${f(data.declarantGovIdNo)}`, {
		x: left,
		y,
		size: 8,
		font: regular,
		color: INK,
	})
	page.drawText(`ID No.: ${f(data.spouseGovIdNo)}`, {
		x: PAGE_W - right - sigWidth,
		y,
		size: 8,
		font: regular,
		color: INK,
	})
	y -= 10
	page.drawText(`Date Issued: ${f(data.declarantGovIdDateIssued)}`, {
		x: left,
		y,
		size: 8,
		font: regular,
		color: INK,
	})
	page.drawText(`Date Issued: ${f(data.spouseGovIdDateIssued)}`, {
		x: PAGE_W - right - sigWidth,
		y,
		size: 8,
		font: regular,
		color: INK,
	})
	y -= 18

	ensureSpace(60)
	page.drawText("SUBSCRIBED AND SWORN", { x: left, y, size: 8, font: bold, color: INK })
	page.drawText(
		`to before me this ${f(data.subscribedDay, "__")} day of ${f(data.subscribedMonth, "__")}, ${f(data.subscribedYear, "____")} at ${f(data.subscribedLocation, "________________")}, affiant exhibiting to me the above-stated government issued identification card.`,
		{ x: left + 108, y, size: 8, font: regular, color: INK, maxWidth: contentWidth - 108 }
	)
	y -= 26
	page.drawLine({ start: { x: left, y }, end: { x: left + 210, y }, thickness: 0.6, color: INK })
	page.drawText("(Person Administering Oath)", {
		x: PAGE_W - right - 156,
		y,
		size: 8,
		font: italic,
		color: INK,
	})

	await downloadPdf(pdf, `sworn-statement-assets-liabilities-net-worth-${Date.now()}.pdf`)
}

// â”€â”€ Affidavit of Desistance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function exportAffidavitOfDesistance(data: AffidavitOfDesistanceData): Promise<void> {
	const pdf = await PDFDocument.create()
	const regular = await pdf.embedFont(StandardFonts.TimesRoman)
	const bold = await pdf.embedFont(StandardFonts.TimesRomanBold)
	const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic)

	let page = pdf.addPage([PAGE_W, PAGE_H])
	const LH = SIZE_BODY * 1.6
	const LH_SM = SIZE_SM * 1.4
	const x = MARGIN_H
	const indentX = x + 24
	let y = PAGE_H - MARGIN_TOP

	const ensureSpace = (needed: number) => {
		if (y < MARGIN_BOTTOM + needed) {
			page = pdf.addPage([PAGE_W, PAGE_H])
			y = PAGE_H - MARGIN_TOP
		}
	}

	const drawParagraphWithPageBreak = (
		text: string,
		xPos: number,
		size: number,
		maxWidth: number,
		font: PDFFont = regular,
		lineHeight = LH
	) => {
		const lines = wrapText(text, font, size, maxWidth)
		for (const line of lines) {
			if (y < MARGIN_BOTTOM + lineHeight) {
				page = pdf.addPage([PAGE_W, PAGE_H])
				y = PAGE_H - MARGIN_TOP
			}
			page.drawText(line, { x: xPos, y, size, font, color: INK })
			y -= lineHeight
		}
	}

	page.drawText("REPUBLIC OF THE PHILIPPINES", { x, y, size: SIZE_BODY, font: regular, color: INK })
	y -= LH_SM
	page.drawText(`CITY/MUNICIPALITY OF ${f(data.cityMunicipality)} ) S.S.`, {
		x,
		y,
		size: SIZE_BODY,
		font: regular,
		color: INK,
	})
	y -= LH * 1.8

	y = drawCentred(page, "AFFIDAVIT OF DESISTANCE", y, bold, SIZE_TITLE + 2)
	y -= LH * 0.4

	const opening = `I, ${f(data.affiantName)}, of legal age, ${f(data.citizenship, "Filipino")} and a resident of ${f(data.address)}, after having duly sworn to in accordance with law hereby depose and state:`
	drawParagraphWithPageBreak(opening, x, SIZE_BODY + 1, CONTENT_W)
	y -= LH * 0.4

	const items = [
		`That I am the complaining witness for violation of ${f(data.lawViolation)} and ${f(data.offense)} against ${f(data.respondentName)} in the case entitled "${f(data.caseTitle)}", with Criminal Case No. ${f(data.criminalCaseNo)}, pending before Regional Trial Court, Branch No. ${f(data.courtBranchNo)}, ${f(data.courtLocation)}.`,
		f(data.desistanceReason),
		"That I was never forced nor intimidated in order to execute this Affidavit of Desistance;",
		f(data.withdrawalStatement),
		f(data.dismissalRequest),
	]

	for (const [index, item] of items.entries()) {
		ensureSpace(100)
		page.drawText(`${index + 1}.`, {
			x: indentX,
			y,
			size: SIZE_BODY + 1,
			font: regular,
			color: INK,
		})
		drawParagraphWithPageBreak(item, indentX + 18, SIZE_BODY + 1, CONTENT_W - 40)
		y -= LH * 0.35
	}

	y -= LH * 0.8
	ensureSpace(80)
	page.drawText("Further affiant sayeth naught.", {
		x: x + 8,
		y,
		size: SIZE_BODY + 2,
		font: italic,
		color: INK,
	})
	y -= LH * 1.6

	const witnessText = `IN WITNESS WHEREOF, I hereby set my hand, this ${f(data.witnessDay, "__")} day of ${f(data.witnessMonthYear)} at the City/Municipality of ${f(data.witnessCityMunicipality)}.`
	drawParagraphWithPageBreak(witnessText, x, SIZE_BODY + 1, CONTENT_W)
	y -= LH * 2.2

	ensureSpace(90)
	const affiantName = f(data.affiantName)
	const nameW = bold.widthOfTextAtSize(affiantName, SIZE_TITLE + 1)
	const nameX = (PAGE_W - nameW) / 2
	page.drawText(affiantName, { x: nameX, y, size: SIZE_TITLE + 1, font: bold, color: INK })
	y -= LH * 1.1
	const role = f(data.affiantRole, "Complaining Witness")
	const roleW = regular.widthOfTextAtSize(role, SIZE_TITLE)
	page.drawText(role, { x: (PAGE_W - roleW) / 2, y, size: SIZE_TITLE, font: regular, color: INK })
	y -= LH * 1.8

	const subscribed = `SUBSCRIBED AND SWORN to before me this, this ${f(data.subscribedDay, "__")} day of ${f(data.subscribedMonthYear)}, at the City/Municipality of ${f(data.subscribedCityMunicipality)}. Affiant executing to me his ${f(data.idType)} bearing number ${f(data.idNumber)} as proof of his identity.`
	drawParagraphWithPageBreak(subscribed, x, SIZE_BODY + 1, CONTENT_W)

	await downloadPdf(pdf, `affidavit-of-desistance-${Date.now()}.pdf`)
}

// â”€â”€ Verification and Certification Against Forum Shopping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function exportVerificationAndCertificationAgainstForumShopping(
	data: VerificationAndCertificationAgainstForumShoppingData
): Promise<void> {
	const pdf = await PDFDocument.create()
	const regular = await pdf.embedFont(StandardFonts.TimesRoman)
	const bold = await pdf.embedFont(StandardFonts.TimesRomanBold)

	let page = pdf.addPage([PAGE_W, PAGE_H])
	const LH = SIZE_BODY * 1.45
	const LH_SM = SIZE_SM * 1.35
	const x = MARGIN_H
	const indentX = x + 20
	let y = PAGE_H - MARGIN_TOP

	const ensureSpace = (needed: number) => {
		if (y < MARGIN_BOTTOM + needed) {
			page = pdf.addPage([PAGE_W, PAGE_H])
			y = PAGE_H - MARGIN_TOP
		}
	}

	const drawParagraphWithPageBreak = (
		text: string,
		xPos: number,
		maxWidth: number,
		size = SIZE_BODY
	) => {
		const lines = wrapText(text, regular, size, maxWidth)
		for (const line of lines) {
			if (y < MARGIN_BOTTOM + LH) {
				page = pdf.addPage([PAGE_W, PAGE_H])
				y = PAGE_H - MARGIN_TOP
			}
			page.drawText(line, { x: xPos, y, size, font: regular, color: INK })
			y -= LH
		}
	}

	page.drawText("Republic of the Philippines", { x, y, size: SIZE_SM, font: regular, color: INK })
	y -= LH_SM
	page.drawText(`${f(data.city, "_______________")} ) S.S.`, {
		x,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	y -= LH * 2

	y = drawCentred(page, "VERIFICATION AND CERTIFICATION", y, bold, SIZE_BODY + 1)
	y = drawCentred(page, "AGAINST FORUM SHOPPING", y, bold, SIZE_BODY + 1)
	y -= LH * 0.4

	const opening = `I, ${f(data.affiantName)}, of legal age, ${f(data.civilStatus, "married/single")} and a resident of ${f(data.address)}, after having been duly sworn to in accordance with law hereby depose and say:`
	drawParagraphWithPageBreak(opening, x, CONTENT_W)
	y -= 4

	const items = [data.complaintDescription, data.noOtherActionStatement, data.undertakingStatement]

	for (const item of items) {
		ensureSpace(90)
		drawParagraphWithPageBreak(item, indentX, CONTENT_W - 20)
		y -= 6
	}

	ensureSpace(120)
	const witness = `IN WITNESS WHEREOF, I have hereunto affix my signature in this document this ${f(data.signatureDay, "____")} day of ${f(data.signatureMonth, "____________")}, ${f(data.signatureYear, "20__")}, here at ${f(data.signatureCity, "Quezon City, Metro Manila")}, Philippines.`
	drawParagraphWithPageBreak(witness, x, CONTENT_W)
	y -= 30

	const sigLineX = x + CONTENT_W / 2 - 80
	page.drawLine({
		start: { x: sigLineX, y },
		end: { x: sigLineX + 160, y },
		thickness: 0.8,
		color: INK,
	})
	y -= 12
	page.drawText("Affiant", { x: sigLineX + 58, y, size: SIZE_SM, font: regular, color: INK })
	y -= 24

	const subscribed = `SUBSCRIBED AND SWORN to before me this ${f(data.subscribedDay, "____")} day of ${f(data.subscribedMonth, "____________")}, ${f(data.subscribedYear, "20__")}, at ${f(data.city, "Quezon City, Metro Manila")}. The affiant exhibited to me his/her ${f(data.idType, "competent proof of identity")} ${f(data.idNumber, "____________")}.`
	drawParagraphWithPageBreak(subscribed, x, CONTENT_W, SIZE_SM)

	await downloadPdf(pdf, `verification-and-certification-against-forum-shopping-${Date.now()}.pdf`)
}

// â”€â”€ Petition for Voluntary Confinement for Treatment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function exportPetitionForVoluntaryConfinementTreatment(
	data: PetitionForVoluntaryConfinementTreatmentData
): Promise<void> {
	const pdf = await PDFDocument.create()
	const regular = await pdf.embedFont(StandardFonts.TimesRoman)
	const bold = await pdf.embedFont(StandardFonts.TimesRomanBold)
	const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic)

	let page = pdf.addPage([PAGE_W, PAGE_H])
	const LH = SIZE_BODY * 1.45
	const LH_SM = SIZE_SM * 1.3
	const x = MARGIN_H
	const indentX = x + 24
	let y = PAGE_H - MARGIN_TOP

	const ensureSpace = (needed: number) => {
		if (y < MARGIN_BOTTOM + needed) {
			page = pdf.addPage([PAGE_W, PAGE_H])
			y = PAGE_H - MARGIN_TOP
		}
	}

	const drawParagraphWithPageBreak = (
		text: string,
		xPos: number,
		maxWidth: number,
		font: PDFFont = regular,
		size = SIZE_BODY,
		lineHeight = LH
	) => {
		const lines = wrapText(text, font, size, maxWidth)
		for (const line of lines) {
			if (y < MARGIN_BOTTOM + lineHeight) {
				page = pdf.addPage([PAGE_W, PAGE_H])
				y = PAGE_H - MARGIN_TOP
			}
			page.drawText(line, { x: xPos, y, size, font, color: INK })
			y -= lineHeight
		}
	}

	const drawNumberedParagraph = (index: number, text: string) => {
		ensureSpace(80)
		page.drawText(`${index}.`, { x: indentX, y, size: SIZE_BODY, font: regular, color: INK })
		drawParagraphWithPageBreak(text, indentX + 16, CONTENT_W - 40)
		y -= LH * 0.35
	}

	page.drawText('Annex "D"', {
		x: PAGE_W - MARGIN_H - 52,
		y,
		size: SIZE_BODY,
		font: bold,
		color: INK,
	})
	y -= LH * 1.2
	page.drawText("Republic of the Philippines", {
		x: x + 150,
		y,
		size: SIZE_SM,
		font: bold,
		color: INK,
	})
	y -= LH_SM
	page.drawText("National Capital Judicial Region", {
		x: x + 148,
		y,
		size: SIZE_SM,
		font: bold,
		color: INK,
	})
	y -= LH_SM
	page.drawText(`Regional Trial Court Branch ${f(data.branch)}`, {
		x: x + 137,
		y,
		size: SIZE_SM,
		font: bold,
		color: INK,
	})
	y -= LH * 1.5

	page.drawText("IN THE MATTER OF VOLUNTARY", { x, y, size: SIZE_BODY, font: bold, color: INK })
	y -= LH_SM
	page.drawText("Confinement for Treatment", {
		x: x + 24,
		y,
		size: SIZE_BODY,
		font: italic,
		color: INK,
	})
	y -= LH * 2.1
	page.drawText("DANGEROUS DRUGS BOARD", { x, y, size: SIZE_BODY, font: bold, color: INK })
	y -= LH_SM
	page.drawText("Petitioner,", { x: x + 70, y, size: SIZE_BODY, font: italic, color: INK })

	page.drawText(`SP No. ${f(data.spNo, "__________")}`, {
		x: PAGE_W - 230,
		y: PAGE_H - MARGIN_TOP - 92,
		size: SIZE_BODY,
		font: bold,
		color: INK,
	})
	page.drawText("For: Voluntary Submission of a", {
		x: PAGE_W - 230,
		y: PAGE_H - MARGIN_TOP - 108,
		size: SIZE_BODY,
		font: italic,
		color: INK,
	})
	page.drawText("Drug Dependent to", {
		x: PAGE_W - 230,
		y: PAGE_H - MARGIN_TOP - 122,
		size: SIZE_BODY,
		font: italic,
		color: INK,
	})
	page.drawText("Confinement, Treatment and", {
		x: PAGE_W - 230,
		y: PAGE_H - MARGIN_TOP - 136,
		size: SIZE_BODY,
		font: italic,
		color: INK,
	})
	page.drawText("Rehabilitation pursuant", {
		x: PAGE_W - 230,
		y: PAGE_H - MARGIN_TOP - 150,
		size: SIZE_BODY,
		font: italic,
		color: INK,
	})
	page.drawText("to Section 54, Article VIII of", {
		x: PAGE_W - 230,
		y: PAGE_H - MARGIN_TOP - 164,
		size: SIZE_BODY,
		font: italic,
		color: INK,
	})
	page.drawText("R.A. 9165", {
		x: PAGE_W - 230,
		y: PAGE_H - MARGIN_TOP - 178,
		size: SIZE_BODY,
		font: italic,
		color: INK,
	})

	y -= LH * 1.7
	page.drawText("x---------------------------------------------------x", {
		x,
		y,
		size: SIZE_BODY,
		font: regular,
		color: INK,
	})
	y -= LH * 2.2
	y = drawCentred(page, "PETITION", y, bold, SIZE_TITLE + 4)
	y -= LH * 0.2

	drawParagraphWithPageBreak(
		"COME NOW the Petitioner, Dangerous Drugs Board (DDB for brevity) and unto this Honorable Court most respectfully AVER:",
		x,
		CONTENT_W,
		regular,
		SIZE_BODY
	)
	y -= LH * 0.8

	page.drawText("NATURE OF THE PETITION", { x, y, size: SIZE_TITLE + 2, font: bold, color: INK })
	y -= LH * 1.2
	drawNumberedParagraph(
		1,
		'This Petition is for the voluntary confinement for treatment and rehabilitation of a drug dependent pursuant to Section 54, Article VIII of RA 9165, otherwise known as the "Comprehensive Dangerous Drugs Act of 2002"; and Board Regulation No. 3, Series of 2007 in relation to Section 19, Rule 141 of the Rules of Court, exempting government entities from paying fees;'
	)
	y -= LH * 0.6

	page.drawText("THE PETITIONER", { x, y, size: SIZE_TITLE + 2, font: bold, color: INK })
	y -= LH * 1.2
	drawNumberedParagraph(
		2,
		`The Dangerous Drugs Board is a government agency under the Office of the President created pursuant to Section 79, Article IX of RA 9165, otherwise known as "Comprehensive Dangerous Drugs Act of 2002", with office address located at the 3rd Floor, DDB-PDEA Building, NIA Northside Road, National Government Center, East Triangle, Diliman, Quezon City, represented herein by its Executive Director, ${f(data.executiveDirectorName)} while ${f(data.drugDependentName, "the drug dependent subject of this Petition")} is a Filipino, minor, legal age, single/married with residence and postal address at ${f(data.dependentResidence)}.`
	)
	drawNumberedParagraph(
		3,
		"That under Section 54 of the Act, all applications for voluntary confinement for treatment and rehabilitation shall be filed with the Dangerous Drugs Board (DDB) or any of its duly authorized representatives, who, after determining that the applicant is a drug dependent, shall bring forth the said application of any person determined to be drug dependent on dangerous drugs thru a petition of the Board to the Regional Trial Court of the province or city where the applicant resides;"
	)
	drawNumberedParagraph(
		4,
		`That on ${f(data.applicationDate)}, DDB received the application of ${f(data.drugDependentName, "(Name of Drug Dependent)")}, copy of which is hereto attached as ANNEX "A" and upon receipt thereof, issued an Order directing the applicant to undergo drug dependency examination to be conducted by any DOH accredited physician;`
	)
	drawNumberedParagraph(
		5,
		`That on ${f(data.examinationDate)}, DDB received the result of the drug dependency examination of subject applicant conducted by ${f(data.doctorName)}, a DOH accredited physician and a Certification attesting to the fact that ${f(data.drugDependentName)} is a drug dependent needing immediate confinement for treatment and rehabilitation at the ${f(data.rehabCenterName, "(Name of Government Rehabilitation Center)")} located at ${f(data.rehabCenterAddress, "(Address of the Rehabilitation Center)")};`
	)
	drawNumberedParagraph(
		6,
		`That pending the issuance by the Court of a Commitment Order, said drug dependent has been placed for temporary confinement of not more than fifteen (15) days at the ${f(data.temporaryConfinementFacility)} and shall be released therefrom and committed to the designated rehabilitation center immediately upon receipt of the Commitment Order from the Court hearing the Petition;`
	)

	ensureSpace(170)
	drawParagraphWithPageBreak(
		`WHEREFORE, premises considered, it is most respectfully prayed of this Honorable Court (after notice and hearing) that an Order be issued directing ${f(data.drugDependentName, "Name of Drug Dependent")} to be confined for treatment and rehabilitation at the ${f(data.rehabCenterName)}.`,
		x,
		CONTENT_W,
		regular,
		SIZE_BODY
	)
	y -= LH * 1.4
	drawParagraphWithPageBreak(
		`QUEZON CITY for ${f(data.petitionMonth)} this ${f(data.petitionDay)} day of ${f(data.petitionYear, "20__")}.`,
		x,
		CONTENT_W,
		regular,
		SIZE_BODY
	)
	y -= LH * 2

	ensureSpace(150)
	page.drawText("DANGEROUS DRUGS BOARD:", {
		x: PAGE_W / 2 - 70,
		y,
		size: SIZE_BODY,
		font: regular,
		color: INK,
	})
	y -= LH * 2.5
	const execNameWidth = bold.widthOfTextAtSize(f(data.executiveDirectorName), SIZE_BODY + 1)
	page.drawText(f(data.executiveDirectorName), {
		x: PAGE_W / 2 - execNameWidth / 2,
		y,
		size: SIZE_BODY + 1,
		font: bold,
		color: INK,
	})
	y -= LH
	page.drawText("Executive Director", {
		x: PAGE_W / 2 - 42,
		y,
		size: SIZE_BODY,
		font: regular,
		color: INK,
	})
	y -= LH * 2
	page.drawText("By:", { x: PAGE_W / 2 - 10, y, size: SIZE_BODY, font: regular, color: INK })
	y -= LH * 1.2
	page.drawLine({
		start: { x: PAGE_W / 2 - 110, y },
		end: { x: PAGE_W / 2 + 110, y },
		thickness: 0.7,
		color: INK,
	})
	y -= LH
	page.drawText(`Atty. ${f(data.attorneyName)}`, {
		x: PAGE_W / 2 - 58,
		y,
		size: SIZE_BODY,
		font: regular,
		color: INK,
	})
	y -= LH_SM
	page.drawText("Chief, Legal Division", {
		x: PAGE_W / 2 - 48,
		y,
		size: SIZE_SM,
		font: italic,
		color: INK,
	})
	y -= LH * 1.8
	page.drawText("By:", { x: PAGE_W / 2 - 10, y, size: SIZE_BODY, font: regular, color: INK })
	y -= LH * 1.2
	page.drawLine({
		start: { x: PAGE_W / 2 - 110, y },
		end: { x: PAGE_W / 2 + 110, y },
		thickness: 0.7,
		color: INK,
	})
	y -= LH
	const repWidth = regular.widthOfTextAtSize(f(data.representativeName), SIZE_BODY)
	page.drawText(f(data.representativeName), {
		x: PAGE_W / 2 - repWidth / 2,
		y,
		size: SIZE_BODY,
		font: regular,
		color: INK,
	})
	y -= LH_SM
	page.drawText("Duly Authorized Representative", {
		x: PAGE_W / 2 - 69,
		y,
		size: SIZE_SM,
		font: italic,
		color: INK,
	})

	page = pdf.addPage([PAGE_W, PAGE_H])
	y = PAGE_H - MARGIN_TOP
	y = drawCentred(page, "VERIFICATION / CERTIFICATION", y, bold, SIZE_TITLE + 2)
	y = drawCentred(page, "OF NON-FORUM SHOPPING", y, bold, SIZE_TITLE + 2)
	y -= LH * 0.8

	drawParagraphWithPageBreak(
		`I, ${f(data.verificationAffiantName)}, Filipino, ${f(data.verificationLegalAge, "of legal age")}, the Executive Director / duly authorized representative of the Dangerous Drugs Board, after having been duly sworn to in accordance to law, hereby depose and state:`,
		x,
		CONTENT_W,
		regular,
		SIZE_BODY
	)
	y -= LH * 0.5

	for (const [index, item] of [
		"That I am the Petitioner in this Petition for Voluntary Submission of a drug dependent to confinement, treatment and rehabilitation;",
		"That I caused the preparation and filing of the foregoing Petition and found that all the allegations therein are true and correct according to my own knowledge and belief;",
		"I hereby certify that I have not commenced any action involving the same issue before any Court, tribunal or quasi-judicial agency and, to the best of my knowledge, no such action or claim is pending therein. If I hereafter learned that the same or similar action or claim has been filed or pending therein, I undertake to inform this Honorable Court of said fact within five (5) days therefrom.",
	].entries()) {
		drawNumberedParagraph(index + 1, item)
	}

	ensureSpace(140)
	y -= LH * 1.2
	page.drawLine({
		start: { x: PAGE_W - 230, y },
		end: { x: PAGE_W - 80, y },
		thickness: 0.7,
		color: INK,
	})
	y -= LH_SM
	page.drawText("Affiant / Petitioner", {
		x: PAGE_W - 180,
		y,
		size: SIZE_SM,
		font: regular,
		color: INK,
	})
	y -= LH * 2
	drawParagraphWithPageBreak(
		`SUBSCRIBED and sworn to before me this ${f(data.subscribedDay, "____")} day of ${f(data.subscribedMonth, "____________")}, ${f(data.subscribedYear, "20__")}, affiant / Petitioner exhibited to me his/her Community Tax Certificate No. ${f(data.verificationCtcNo)}, issued on ${f(data.verificationCtcIssuedOn)} at ${f(data.verificationCtcIssuedAt)}.`,
		x,
		CONTENT_W,
		regular,
		SIZE_SM,
		SIZE_SM * 1.5
	)

	await downloadPdf(pdf, `petition-for-voluntary-confinement-treatment-${Date.now()}.pdf`)
}

// â”€â”€ GSIS Board of Trustees Petition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function exportGsisBoardOfTrusteesPetition(
	data: GsisBoardOfTrusteesPetitionData
): Promise<void> {
	const pdf = await PDFDocument.create()
	const regular = await pdf.embedFont(StandardFonts.Helvetica)
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

	const LH = 13
	const SMALL = 8
	const BODY = 10
	const TITLE = 12

	const factLines = [
		data.statementOfFacts1,
		data.statementOfFacts2,
		data.statementOfFacts3,
		data.statementOfFacts4,
		data.statementOfFacts5,
	]
	const argumentLines = [
		data.argumentsLine1,
		data.argumentsLine2,
		data.argumentsLine3,
		data.argumentsLine4,
	]

	let page = pdf.addPage([PAGE_W, PAGE_H])
	let y = PAGE_H - 56
	const x = 44

	const drawCentered = (text: string, size: number, font: PDFFont = regular) => {
		const width = font.widthOfTextAtSize(text, size)
		page.drawText(text, { x: (PAGE_W - width) / 2, y, size, font, color: INK })
		y -= size * 1.45
	}

	const drawLineValue = (
		xPos: number,
		yPos: number,
		width: number,
		value?: string,
		size = BODY
	) => {
		page.drawLine({
			start: { x: xPos, y: yPos },
			end: { x: xPos + width, y: yPos },
			thickness: 0.7,
			color: INK,
		})
		if (value?.trim()) {
			page.drawText(value, { x: xPos + 4, y: yPos + 2, size, font: regular, color: INK })
		}
	}

	page.drawText("Republic of the Philippines", {
		x: 236,
		y,
		size: SMALL,
		font: regular,
		color: INK,
	})
	y -= 12
	page.drawText("GOVERNMENT SERVICE INSURANCE SYSTEM", {
		x: 172,
		y,
		size: SMALL + 1,
		font: bold,
		color: INK,
	})
	y -= 12
	page.drawText("Metro Manila", { x: 274, y, size: SMALL, font: regular, color: INK })
	y -= 36
	drawCentered("BOARD OF TRUSTEES", BODY + 1, bold)
	y -= 22

	page.drawText("IN THE MATTER OF", { x, y, size: BODY + 1, font: bold, color: INK })
	drawLineValue(x + 116, y + 3, 88, data.caseTitle, BODY - 1)
	y -= 14
	page.drawText("(Case Title from the Decision", { x, y, size: SMALL, font: regular, color: INK })
	page.drawText("of the Committee on", { x: x + 138, y, size: SMALL, font: regular, color: INK })
	y -= 11
	page.drawText("Claims)", { x, y, size: SMALL, font: regular, color: INK })
	page.drawText("dated", { x: x + 76, y, size: SMALL, font: regular, color: INK })
	drawLineValue(x + 112, y + 3, 104, data.committeeDecisionDate, SMALL)

	page.drawText(`GSIS Case No. ${f(data.gsisCaseNo, "____")}`, {
		x: 390,
		y: y + 2,
		size: BODY,
		font: bold,
		color: INK,
	})
	page.drawText(`[Case No. ${f(data.committeeCaseNo, "____")}]`, {
		x: 500,
		y: y - 12,
		size: SMALL,
		font: regular,
		color: INK,
	})
	y -= 22
	drawLineValue(x + 34, y + 3, 162, data.petitionerName, BODY - 1)
	y -= 12
	page.drawText("(copy from COC Decision)", { x, y, size: SMALL - 1, font: regular, color: INK })
	y -= 18
	page.drawText("Petitioner.", { x: 170, y, size: BODY, font: regular, color: INK })
	y -= 18
	page.drawText("x - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - x", {
		x: 46,
		y,
		size: BODY,
		font: regular,
		color: INK,
	})
	y -= 22
	drawCentered("PETITION", BODY, bold)
	y -= 12
	drawCentered("I. Timeliness of the Petition", TITLE, bold)
	y -= 12

	if (data.timelinessText.trim()) {
		y = drawParagraph(page, data.timelinessText, 76, y, regular, BODY, CONTENT_W - 32, LH)
	} else {
		drawLineValue(76, y, 472)
		y -= 20
		drawLineValue(76, y, 472)
	}
	y -= 28
	drawCentered("II. Statement of Facts", TITLE, bold)
	y -= 14

	for (const [index, line] of factLines.entries()) {
		page.drawText(`${index + 1}.`, { x: 102, y, size: BODY, font: regular, color: INK })
		drawLineValue(120, y + 3, 428, line)
		y -= 18
		drawLineValue(76, y + 3, 428)
		y -= 22
	}

	drawCentered("III. Arguments and Discussion", BODY, bold)
	y -= 22
	for (const line of argumentLines) {
		drawLineValue(34, y + 3, 310, line)
		y -= 28
	}

	page = pdf.addPage([PAGE_W, PAGE_H])
	y = PAGE_H - 56
	drawCentered("IV. Prayer", 18, bold)
	y -= 32
	if (data.prayerText.trim()) {
		y = drawParagraph(page, data.prayerText, 44, y, regular, BODY, CONTENT_W + 12, LH)
		y -= 20
	}

	drawLineValue(44, y + 3, 132, data.datePlace, SMALL)
	page.drawText("(Date, Place)", { x: 68, y: y - 10, size: SMALL, font: regular, color: INK })
	y -= 42
	drawLineValue(110, y + 3, 126, data.signatoryName, SMALL)
	drawLineValue(270, y + 3, 198, data.signatoryTitle, SMALL)
	y -= 12
	page.drawText("(Name of Petitioner or counsel)", {
		x: 95,
		y,
		size: SMALL,
		font: regular,
		color: INK,
	})
	y -= 34

	page.drawText("VERIFICATION / CERTIFICATION", { x: 44, y, size: BODY, font: bold, color: INK })
	page.drawLine({
		start: { x: 44, y: y - 2 },
		end: { x: 192, y: y - 2 },
		thickness: 0.7,
		color: INK,
	})
	y -= 22
	page.drawText("I,", { x: 44, y, size: BODY, font: regular, color: INK })
	drawLineValue(62, y + 3, 144, data.verificationPetitionerName, SMALL)
	page.drawText(", resident of", { x: 210, y, size: BODY, font: regular, color: INK })
	drawLineValue(288, y + 3, 164, data.verificationResidence, SMALL)
	page.drawText(", of legal age, and", { x: 456, y, size: BODY, font: regular, color: INK })
	y -= 14
	page.drawText(
		"after having been duly sworn to in accordance with law, hereby depose and state:",
		{ x: 44, y, size: BODY, font: regular, color: INK }
	)
	y -= 26

	const verificationItems = [
		"That I am the petitioner in the above-titled case;",
		"That I caused the preparation and filing of the foregoing Petition;",
		"That I have read and fully understood the contents thereof and that the same are true and correct based on my personal knowledge and/or based on authentic records; and",
		data.verificationStatement4,
	]

	for (const [index, item] of verificationItems.entries()) {
		page.drawText(`${index + 1}.`, { x: 112, y, size: BODY, font: regular, color: INK })
		y = drawParagraph(page, item, 140, y, regular, BODY, 360, LH)
		y -= 4
	}

	y -= 12
	page.drawText("SUBSCRIBED AND SWORN TO BEFORE ME this", {
		x: 78,
		y,
		size: BODY,
		font: regular,
		color: INK,
	})
	drawLineValue(300, y + 3, 44, data.subscribedDay, SMALL)
	page.drawText("day of", { x: 350, y, size: BODY, font: regular, color: INK })
	drawLineValue(390, y + 3, 52, data.subscribedMonth, SMALL)
	y -= 14
	drawLineValue(44, y + 3, 58, data.subscribedYear, SMALL)
	page.drawText(", affiant exhibiting to me his", {
		x: 106,
		y,
		size: BODY,
		font: regular,
		color: INK,
	})
	drawLineValue(258, y + 3, 108, data.idDescription, SMALL)
	page.drawText("with No.", { x: 372, y, size: BODY, font: regular, color: INK })
	drawLineValue(420, y + 3, 100, data.idNumber, SMALL)
	y -= 56
	const hasCopyFurnished = [
		data.copyFurnishedLabel,
		data.copyFurnishedTitle,
		data.copyFurnishedOffice,
		data.copyFurnishedAddress,
	].some(value => (value ?? "").trim())
	if (hasCopyFurnished) {
		page.drawText(f(data.copyFurnishedLabel, "Copy furnished:"), { x: 44, y, size: BODY, font: regular, color: INK })
		y -= 34
		page.drawText(f(data.copyFurnishedTitle, "COMMITTEE ON CLAIMS"), { x: 44, y, size: 16, font: bold, color: INK })
		y -= 18
		page.drawText(f(data.copyFurnishedOffice, "Government Service Insurance System"), { x: 44, y, size: BODY, font: regular, color: INK })
		y -= 14
		page.drawText(f(data.copyFurnishedAddress, "Pasay City, Metro Manila"), { x: 44, y, size: BODY, font: regular, color: INK })
	}

	await downloadPdf(pdf, `gsis-board-of-trustees-petition-${Date.now()}.pdf`)
}

// â”€â”€ Judicial Affidavit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function exportJudicialAffidavit(
	data: JudicialAffidavitData
): Promise<void> {
	const pdf = await PDFDocument.create()
	const regular = await pdf.embedFont(StandardFonts.Courier)
	const bold = await pdf.embedFont(StandardFonts.CourierBold)

	let page = pdf.addPage([PAGE_W, PAGE_H])
	const LH = SIZE_BODY * 1.5
	const x = MARGIN_H
	let y = PAGE_H - MARGIN_TOP

	const drawWithBreak = (text: string, size = SIZE_BODY, font: PDFFont = regular, indent = 0) => {
		const lines = wrapText(text, font, size, CONTENT_W - indent)
		for (const line of lines) {
			if (y < MARGIN_BOTTOM + LH) {
				page = pdf.addPage([PAGE_W, PAGE_H])
				y = PAGE_H - MARGIN_TOP
			}
			page.drawText(line, { x: x + indent, y, size, font, color: INK })
			y -= LH
		}
	}

	drawWithBreak("REPUBLIC OF THE PHILIPPINES")
	drawWithBreak("REGIONAL TRIAL COURT")
	drawWithBreak(`${f(data.branchNumber, "Branch Number")}, ${f(data.courtCityProvince, "City/Province")}`)
	y -= LH
	drawWithBreak(f(data.caseTitle, "Case Title"))
	drawWithBreak(f(data.caseNumber, "Case Number"))
	y -= LH
	drawWithBreak(`JUDICIAL AFFIDAVIT OF ${f(data.witnessName, "Name of Witness")}`, SIZE_BODY, bold)
	y -= LH

	drawWithBreak(
		`I, ${f(data.witnessName, "Name of Witness")}, of legal age, Filipino, ${f(data.civilStatus, "civil status")}, and residing at ${f(data.address, "complete address")}, after having been duly sworn to in accordance with law, depose and state that:`
	)
	y -= LH * 0.5
	drawWithBreak("PRELIMINARY STATEMENTS:", SIZE_BODY, bold)
	drawWithBreak(`1. I am a witness for the ${f(data.partyName, "plaintiff/defendant/People of the Philippines")} in the above-captioned case.`)
	drawWithBreak("2. The purpose of this affidavit is to present my testimony in lieu of direct examination, pursuant to the Judicial Affidavit Rule.")
	drawWithBreak("3. I am executing this affidavit freely and voluntarily, fully aware of its contents and of my obligation to tell the truth.")
	y -= LH * 0.5
	drawWithBreak("QUESTIONS AND ANSWERS:", SIZE_BODY, bold)
	for (const line of (data.questionAnswers.trim() || "[Set forth questions and corresponding answers]").split("\n")) {
		drawWithBreak(line)
	}
	y -= LH * 0.5
	drawWithBreak("WITNESS'S ATTESTATION:", SIZE_BODY, bold)
	drawWithBreak("IN WITNESS WHEREOF, I attest that I have read this Judicial Affidavit and fully understand its contents. I understand I can be charged with perjury if I make any false statement.")
	y -= LH * 0.5
	drawWithBreak("(SIGNATURE OF WITNESS)")
	drawWithBreak(f(data.witnessSignatureName, "Name of Witness"))
	drawWithBreak("Affiant")
	y -= LH * 0.5
	drawWithBreak("LAWYER'S ATTESTATION:", SIZE_BODY, bold)
	drawWithBreak(`I, ${f(data.lawyerName, "Name of Lawyer")}, counsel for the ${f(data.partyRepresented, "party")}, hereby certify and state that:`)
	drawWithBreak(`1. I personally examined the witness, ${f(data.witnessName, "Name of Witness")}.`)
	drawWithBreak("2. I explained to her/him the substance of the questions and answers as recorded in this Judicial Affidavit.")
	drawWithBreak("3. I informed her/him of the obligation to tell the truth and the liabilities for false testimony.")
	y -= LH * 0.5
	drawWithBreak("(SIGNATURE OF LAWYER)")
	drawWithBreak(f(data.lawyerName, "Name of Lawyer"))
	drawWithBreak(`PTR No. ${f(data.lawyerPtrNo, "____")}`)
	drawWithBreak(`Roll of Attorneys No. ${f(data.lawyerRollNo, "____")}`)
	drawWithBreak(f(data.lawyerAddressContact, "Address and Contact Information"))
	y -= LH * 0.5
	drawWithBreak(
		`SUBSCRIBED AND SWORN TO before me this ${f(data.subscribedDay, "__")} day of ${f(data.subscribedMonth, "________")}, 20${f(data.subscribedYear, "__")}, affiant exhibiting to me her/his ${f(data.idProof, "competent proof of identity")}.`
	)

	await downloadPdf(pdf, `judicial-affidavit-${Date.now()}.pdf`)
}

// â”€â”€ Omnibus Sworn Statement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function exportOmnibusSwornStatement(
	data: OmnibusSwornStatementData
): Promise<void> {
	const pdf = await PDFDocument.create()
	const regular = await pdf.embedFont(StandardFonts.Helvetica)
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

	let page = pdf.addPage([PAGE_W, PAGE_H])
	const LH = SIZE_BODY * 1.55
	const x = MARGIN_H
	let y = PAGE_H - MARGIN_TOP

	const drawWithBreak = (text: string, size = SIZE_BODY, font: PDFFont = regular, indent = 0) => {
		const lines = wrapText(text, font, size, CONTENT_W - indent)
		for (const line of lines) {
			if (y < MARGIN_BOTTOM + LH) {
				page = pdf.addPage([PAGE_W, PAGE_H])
				y = PAGE_H - MARGIN_TOP
			}
			page.drawText(line, { x: x + indent, y, size, font, color: INK })
			y -= LH
		}
	}

	drawWithBreak("Omnibus Sworn Statement", SIZE_TITLE + 8, bold)
	y -= LH
	drawWithBreak("REPUBLIC OF THE PHILIPPINES )")
	drawWithBreak(`CITY/MUNICIPALITY OF ${f(data.cityMunicipality, "_______")} ) S.S.`)
	y -= LH
	drawWithBreak("AFFIDAVIT", SIZE_TITLE, bold)
	y -= LH

	drawWithBreak(
		`I, ${f(data.affiantName, "Name of Affiant")}, of legal age, ${f(data.civilStatus, "Civil Status")}, ${f(data.nationality, "Nationality")}, and residing at ${f(data.affiantAddress, "Address of Affiant")}, after having been duly sworn in accordance with law, do hereby depose and state that:`
	)
	y -= LH * 0.5

	drawWithBreak("1. Select one, delete the other:")
	if (data.showClause1SoleProprietorship !== false) {
		drawWithBreak(`If a sole proprietorship: I am the sole proprietor of ${f(data.bidderName, "Name of Bidder")} with office address at ${f(data.bidderAddress, "Address of Bidder")};`, SIZE_BODY, regular, 16)
	}
	if (data.showClause1Entity !== false) {
		drawWithBreak(`If a partnership, corporation, cooperative, or joint venture: I am the duly authorized and designated representative of ${f(data.bidderName, "Name of Bidder")} with office address at ${f(data.bidderAddress, "Address of Bidder")};`, SIZE_BODY, regular, 16)
	}

	drawWithBreak("2. Select one, delete the other:")
	if (data.showClause2SoleProprietorship !== false) {
		drawWithBreak(`If a sole proprietorship: As the owner and sole proprietor of ${f(data.bidderName, "Name of Bidder")}, I have full power and authority to represent it in the bidding for ${f(data.projectName, "Name of the Project")} of ${f(data.procuringEntity, "Name of the Procuring Entity")};`, SIZE_BODY, regular, 16)
	}
	if (data.showClause2Entity !== false) {
		drawWithBreak(`If a partnership, corporation, cooperative, or joint venture: I am granted full power and authority to represent ${f(data.bidderName, "Name of Bidder")} in the bidding as shown in the attached authority document;`, SIZE_BODY, regular, 16)
	}

	drawWithBreak(`3. ${f(data.bidderName, "Name of Bidder")} is not blacklisted or barred from bidding by the Government of the Philippines or any agency, office, corporation, or local government unit.`)
	drawWithBreak("4. Each of the documents submitted in satisfaction of the bidding requirements is an authentic copy of the original, complete, and all statements and information provided therein are true and correct;")
	drawWithBreak(`5. ${f(data.bidderName, "Name of Bidder")} is authorizing the Head of the Procuring Entity or its duly authorized representative(s) to verify all the documents submitted;`)

	drawWithBreak("6. Select one, delete the rest:")
	if (data.showClause6SoleProprietorship !== false) {
		drawWithBreak("If a sole proprietorship: I am not related to the Head of the Procuring Entity, members of the BAC, Technical Working Group, and BAC Secretariat, by consanguinity or affinity up to the third civil degree;", SIZE_BODY, regular, 16)
	}
	if (data.showClause6Partnership !== false) {
		drawWithBreak(`If a partnership or cooperative: None of the officers and members of ${f(data.bidderName, "Name of Bidder")} is related to the Head of the Procuring Entity, members of the BAC, Technical Working Group, and BAC Secretariat, by consanguinity or affinity up to the third civil degree;`, SIZE_BODY, regular, 16)
	}
	if (data.showClause6Corporation !== false) {
		drawWithBreak(`If a corporation or joint venture: None of the officers, directors, and controlling stockholders of ${f(data.bidderName, "Name of Bidder")} is related to the Head of the Procuring Entity, members of the BAC, Technical Working Group, and BAC Secretariat, by consanguinity or affinity up to the third civil degree;`, SIZE_BODY, regular, 16)
	}

	drawWithBreak(`7. ${f(data.bidderName, "Name of Bidder")} complies with existing labor laws and standards; and`)
	drawWithBreak(`8. ${f(data.bidderName, "Name of Bidder")} is aware of and has undertaken the following responsibilities as a Bidder:`)
	drawWithBreak("1. Carefully examine all of the Bidding Documents;", SIZE_BODY, regular, 24)
	drawWithBreak("2. Acknowledge all conditions, local or otherwise, affecting the implementation of the Contract;", SIZE_BODY, regular, 24)
	drawWithBreak("3. Made an estimate of the facilities available and needed for the contract to be bid, if any; and", SIZE_BODY, regular, 24)
	drawWithBreak(`4. Inquire or secure Supplemental/Bid Bulletin(s) issued for the ${f(data.projectName, "Name of the Project")}.`, SIZE_BODY, regular, 24)
	y -= LH

	drawWithBreak(
		`IN WITNESS WHEREOF, I have hereunto set my hand this ${f(data.witnessDay, "__")} day of ${f(data.witnessMonth, "____")}, 20${f(data.witnessYear, "__")} at ${f(data.witnessPlace, "____________")}, Philippines.`
	)
	y -= LH * 2

	page.drawLine({ start: { x: x + 230, y }, end: { x: x + CONTENT_W, y }, thickness: 0.8, color: INK })
	y -= LH
	drawWithBreak(f(data.authorizedSignatory, "Bidder's Representative/Authorized Signatory"), SIZE_BODY + 1, regular, 230)

	await downloadPdf(pdf, `omnibus-sworn-statement-${Date.now()}.pdf`)
}

// â”€â”€ Copy Certification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function exportCopyCertification(
	data: CopyCertificationData
): Promise<void> {
	const pdf = await PDFDocument.create()
	const regular = await pdf.embedFont(StandardFonts.Helvetica)
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

	let page = pdf.addPage([PAGE_W, PAGE_H])
	const LH = SIZE_BODY * 1.55
	const x = MARGIN_H
	let y = PAGE_H - MARGIN_TOP

	const drawWithBreak = (text: string, size = SIZE_BODY, font: PDFFont = regular, indent = 0) => {
		const lines = wrapText(text, font, size, CONTENT_W - indent)
		for (const line of lines) {
			if (y < MARGIN_BOTTOM + LH) {
				page = pdf.addPage([PAGE_W, PAGE_H])
				y = PAGE_H - MARGIN_TOP
			}
			page.drawText(line, { x: x + indent, y, size, font, color: INK })
			y -= LH
		}
	}

	drawWithBreak("Standard Copy Certification Template", SIZE_TITLE + 4, regular)
	y -= LH
	drawWithBreak("REPUBLIC OF THE PHILIPPINES)")
	drawWithBreak(`CITY OF ${f(data.city)} ) S.S.`)
	y -= LH * 0.5
	drawWithBreak("COPY CERTIFICATION", SIZE_TITLE, bold)
	y -= LH * 0.5

	drawWithBreak(
		`I, ${f(data.notaryPublicName, "NAME OF NOTARY PUBLIC")}, a Notary Public in the City and Province of ${f(data.cityProvince, "City/Province")}, do hereby depose and state:`
	)
	y -= LH * 0.4

	drawWithBreak(`1. That an original ${f(data.documentName, "Name of Document")} issued on ${f(data.issuingEntity, "Date Issued by Issuing Entity")} was presented to me on [Date Presented];`)
	const numCopies = parseInt(data.numberOfCopies) || 0
	const copyLabel = numCopies === 1 ? "copy" : "copies"
	drawWithBreak(`2. That I have caused or supervised the copying of the said document ${f(data.numberOfCopies, "[number]")} ${copyLabel};`)
	drawWithBreak("3. That I have compared the copy of said document with the original copy; and")
	drawWithBreak("4. That I certify, after having determined, that the said copy is accurate and complete compared with the original document copy.")
	y -= LH * 0.4

	drawWithBreak(`This certification is issued upon the request of ${f(data.clientOwnerName, "Client/Owner Name")} for all legal purposes.`)
	y -= LH * 0.4
	drawWithBreak(`Given this ${f(data.givenDay, "___")} day of ${f(data.givenMonth, "__________")}, 20${f(data.givenYear, "__")} at ${f(data.givenPlace, "_____________")}, Philippines.`)
	y -= LH * 0.6

	drawWithBreak(f(data.signatureNotaryPublic, "Signature of Notary Public"))
	drawWithBreak(f(data.printedNameNotaryPublic, "PRINTED NAME OF NOTARY PUBLIC"))
	drawWithBreak(`Notary Public for ${f(data.cityProvince, "City/Province")}`)
	drawWithBreak(`Notarial Commission No. ${f(data.notarialCommissionNumber, "Commission Number")}`)
	drawWithBreak(`Until ${f(data.commissionValidUntil, "December 31, 20__")}`)
	drawWithBreak(`Roll of Attorneys No. ${f(data.rollOfAttorneysNo, "Roll Number")}`)
	drawWithBreak(`IBP No. ${f(data.ibpNo, "Lifetime/Annual Number")} / ${f(data.ibpDateChapter, "Date/Chapter")}`)
	drawWithBreak(`PTR No. ${f(data.ptrNo, "Number")} / ${f(data.ptrDateLocation, "Date/Location")}`)
	drawWithBreak(`MCLE Compliance No. ${f(data.mcleComplianceNo, "Number")} / ${f(data.mcleDate, "Date")}`)

	await downloadPdf(pdf, `copy-certification-${Date.now()}.pdf`)
}

// Deed of Absolute Sale
export async function exportDeedOfAbsoluteSale(data: DeedOfAbsoluteSaleData): Promise<void> {
	const pdf = await PDFDocument.create()
	const page = pdf.addPage([612, 792])
	const helvetica = await pdf.embedFont(StandardFonts.Helvetica)
	const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold)

	let y = 720

	page.drawText("DEED OF ABSOLUTE SALE", {
		x: 236,
		y: y,
		font: helveticaBold,
		size: 12,
	})

	y -= 40

	const content = `KNOW ALL MEN BY THESE PRESENTS: This Deed of Absolute Sale is made and executed by: ${f(data.sellerName)}, ${f(data.sellerAge)} years of legal age, ${data.sellerMaritalStatus}, Filipino, and residing at ${f(data.sellerAddress)} (hereinafter referred to as the SELLER); AND - ${f(data.buyerName)}, ${f(data.buyerAge)} years of legal age, ${data.buyerMaritalStatus}, Filipino, and residing at ${f(data.buyerAddress)} (hereinafter referred to as the BUYER).

WITNESSETH: That the SELLER is the registered owner of a certain parcel of land together with all the improvements found therein, as evidenced by Transfer Certificate of Title (TCT) No. ${f(data.propertyTCT)} situated in ${f(data.propertyLocation)}, Philippines, and more particularly described as follows, to wit: ${f(data.propertyImprovements)}, containing an area of ${f(data.propertyArea)} ${data.propertyAreaUnit} including all the existing improvements erected thereon.

That for and in consideration of the sum of ${f(data.price)}, receipt in full is hereby acknowledged. The SELLER/s do hereby SELL, TRANSFER and CONVEY, unto the said BUYER/s, their heirs and assigns, the above-described parcel of lot, with all the improvements found thereon. That the SELLER/s hereby warrants that the title over the land above described, with full right to dispose of the same, free from all liens and encumbrances.

IN WITNESS WHEREOF, I have hereunto signed this deed of absolute sale, this ${f(data.transactionDay)} day of ${f(data.transactionMonth)}, 20${f(data.transactionYear)} at ${f(data.transactionPlace)}, ${f(data.transactionCity)}.

${f(data.sellerName)}
SELLER

Signed in the presence of:

__________________________     __________________________
${f(data.witness1Name)}          ${f(data.witness2Name)}
Witness                      Witness

ACKNOWLEDGMENT
(REPUBLIC OF THE PHILIPPINES)
${f(data.transactionCity)} SS.

BEFORE ME, A Notary Public for the City of ${f(data.transactionCity)}, this ${f(data.transactionDay)} day of ${f(data.transactionMonth)}, 20${f(data.transactionYear)}, personally appeared the foregoing instrument and they acknowledged to me that the same is their free and voluntary act and deed.

IN WITNESS WHEREOF, I have hereunto set my hand the day, year and place above written.

${f(data.notaryName)}
Notary Public for ${f(data.transactionCity)}
Notarial Commission No. ${f(data.notaryCommissionNo)}
Until ${f(data.notaryCommissionValidUntil)}
Roll of Attorneys No. ${f(data.rollOfAttorneysNo)}
IBP No. ${f(data.ibpNo)} / ${f(data.ibpDateChapter)}
PTR No. ${f(data.ptrNo)} / ${f(data.ptrDateLocation)}
MCLE Compliance No. ${f(data.mcleNo)} / ${f(data.mcleDate)}`

	y = drawParagraph(page, content, 72, y, helvetica, 10, 468, 14)

	await downloadPdf(pdf, `deed-of-absolute-sale-${Date.now()}.pdf`)
}

// Special Power of Attorney
export async function exportSpecialPowerOfAttorney(data: SpecialPowerOfAttorneyData): Promise<void> {
	const pdf = await PDFDocument.create()
	const page = pdf.addPage([612, 792])
	const helvetica = await pdf.embedFont(StandardFonts.Helvetica)
	const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold)

	let y = 720

	page.drawText("SPECIAL POWER OF ATTORNEY", {
		x: 210,
		y: y,
		font: helveticaBold,
		size: 12,
	})

	y -= 40

	const content = `KNOW ALL MEN BY THESE PRESENTS:

WE, ${f(data.principalName)}, ${data.principalMaritalStatus}, of legal age, with residence and postal address at ${f(data.principalResidence)}, ${f(data.principalPostalAddress)}, do hereby APPOINT our true and legal representative to act for and in our name and stead and to perform the following acts:

1. To ask for sale, and come to an agreement with the prospective buyer and therefor to receive payment from the sale of our property more particularly described as follows: ${f(data.propertyDescription)}

HEREBY GRANTING unto our representative full power and authority to execute and perform every act necessary to render effective the power to ${f(data.powersGranted)}, as though we ourselves have so performed, and HEREBY APPROVING ALL that he may do by virtue hereof with full right of substitution of his person and revocation of this instrument.

IN WITNESS WHEREOF, WE HAVE HEREUNTO SET OUR HANDS THIS ${f(data.executionDay)} DAY OF ${f(data.executionMonth).toUpperCase()}, 20${f(data.executionYear)} AT ${f(data.executionPlace).toUpperCase()}.

_______________________________
${f(data.principalName)}
(Name of Principal)

_______________________________
${f(data.agentName)}
(Name of Agent/Attorney-in-Fact)

Republic of the Philippines
${f(data.cityProvince)}

BEFORE ME, personally appeared:

Name             CTC Number          Date/Place Issued

Known to me and to me known to be the same persons who executed the foregoing instrument and acknowledged to me that the same is their free and voluntary act and deed.

WITNESS MY HAND AND SEAL, on the date and place first above written.

${f(data.notaryName)}
Notary Public for ${f(data.cityProvince)}
Notarial Commission No. ${f(data.notaryCommissionNo)}
Until ${f(data.notaryCommissionValidUntil)}
Roll of Attorneys No. ${f(data.rollOfAttorneysNo)}
IBP No. ${f(data.ibpNo)} / ${f(data.ibpDateChapter)}
PTR No. ${f(data.ptrNo)} / ${f(data.ptrDateLocation)}
MCLE Compliance No. ${f(data.mcleNo)} / ${f(data.mcleDate)}`

	y = drawParagraph(page, content, 72, y, helvetica, 10, 468, 14)

	await downloadPdf(pdf, `special-power-of-attorney-${Date.now()}.pdf`)
}

// Deed of Donation
export async function exportDeedOfDonation(data: DeedOfDonationData): Promise<void> {
	const pdf = await PDFDocument.create()
	const page = pdf.addPage([612, 792])
	const helvetica = await pdf.embedFont(StandardFonts.Helvetica)
	const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold)

	let y = 720

	page.drawText("DEED OF DONATION", {
		x: 236,
		y: y,
		font: helveticaBold,
		size: 12,
	})

	y -= 40

	const content = `KNOW ALL MEN BY THESE PRESENTS:

This DEED OF DONATION, made and executed into by and among:

${f(data.donorName)}, (Name of Registered Owner/Donor) (${data.donorCivilStatus}) of legal age, Filipino, and residents of (${f(data.donorAddress)}) (address), hereinafter referred to as the DONOR;

- and -

${f(data.doneeeName)}, (Name of DONEE) (${data.doneneCivilStatus}) of legal age, Filipino, and residents of (${f(data.doneeAddress)}) (address), hereinafter referred to as the DONEE;

WITNESSETH: THAT

The DONOR is the registered owner of a parcel of land located in ${f(data.propertyLocation)}, more particularly described as follows:

TCT No. ${f(data.propertyTCT)}

${f(data.technicalDescription)}

For and in consideration of the love and affection which the DONOR has for the DONEE who is ${f(data.donationPurpose)}, said DONOR by these presents does hereby RECEIVE AND ACCEPT the gift and donation made in his favor by the DONOR.

IN WITNESS WHEREOF, the parties to this Deed of Donation have hereunto set their hand on ${f(data.executionDay)} in ${f(data.executionPlace)}.

_______________________________     _______________________________
${f(data.donorName)}              ${f(data.doneeeName)}
Donor                         Donee

Signed in the presence of:

__________________________     __________________________
${f(data.witness1Name)}          ${f(data.witness2Name)}
Witness                      Witness

ACKNOWLEDGMENT
(REPUBLIC OF THE PHILIPPINES)
${f(data.propertyCityProvince)} SS.

BEFORE ME, a Notary Public for and in ${f(data.executionCity)} on ${f(data.executionDay)} personally appeared the foregoing instrument and they acknowledged to me that the same is their free and voluntary act and deed.

IN WITNESS WHEREOF, I have hereunto set my hand the day, year and place above written.

${f(data.notaryName)}
Notary Public for ${f(data.propertyCityProvince)}
Notarial Commission No. ${f(data.notaryCommissionNo)}
Until ${f(data.notaryCommissionValidUntil)}
Roll of Attorneys No. ${f(data.rollOfAttorneysNo)}
IBP No. ${f(data.ibpNo)} / ${f(data.ibpDateChapter)}
PTR No. ${f(data.ptrNo)} / ${f(data.ptrDateLocation)}
MCLE Compliance No. ${f(data.mcleNo)} / ${f(data.mcleDate)}`

	y = drawParagraph(page, content, 72, y, helvetica, 10, 468, 14)

	await downloadPdf(pdf, `deed-of-donation-${Date.now()}.pdf`)
}

// Contract of Lease
export async function exportContractOfLease(data: ContractOfLeaseData): Promise<void> {
	const pdf = await PDFDocument.create()
	const page = pdf.addPage([612, 792])
	const helvetica = await pdf.embedFont(StandardFonts.Helvetica)
	const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold)

	let y = 720

	page.drawText("CONTRACT OF LEASE", {
		x: 228,
		y,
		font: helveticaBold,
		size: 12,
	})

	y -= 36

	const content = `Republic of the Philippines) ${f(data.city)} )\n\ns.s.\n\nKNOW ALL MEN BY THESE PRESENTS:\n\nThis CONTRACT OF LEASE, made and entered into this ${f(data.contractDay, "___")} day of ${f(data.contractMonth)}, ${f(data.contractYear)} at the City of ${f(data.contractCity)}, by and between: ${f(data.lessorName)}, of legal age, ${f(data.lessorCivilStatus)}, and residing at ${f(data.lessorAddress)}, and hereinafter referred to as the LESSOR;\n\n-and-\n\n${f(data.lesseeName)}, also of legal age, ${f(data.lesseeCivilStatus)} and residing at ${f(data.lesseeAddress)}, and hereinafter referred to as the LESSEE,\n\nWITNESSETH: That\n\nWHEREAS, the LESSOR is the registered and absolute owner of a house and lot situated at ${f(data.propertyAddress)};\n\nWHEREAS, the LESSEE is willing to lease said property from the LESSOR under the following terms and conditions:\n\n1. That the lease shall be for a period of one year from ${f(data.leaseStartDate)} up to ${f(data.leaseEndDate)};\n2. That the LESSEE shall pay a monthly rental of ${f(data.monthlyRent)}, payable every ${f(data.rentDueDay)} day of the month;\n3. That the LESSEE upon signing pays ${f(data.depositAmount)} pesos, representing two (2) months deposit and one (1) month advance;\n4. That electric and water bills shall be for the account of the LESSEE;\n5. That the leased premises shall be devoted exclusively for residential purposes only;\n6. That all improvements introduced on the premises shall require prior consent of the LESSOR;\n7. That expenses for repair caused by the LESSEE shall be shouldered by the LESSEE;\n8. That the leased premises shall not be subleased without written consent and approval of the LESSOR;\n9. That if premises is not surrendered upon expiration, LESSEE shall be liable for damages;\n10. That the LESSEE shall return the premises in as good condition as reasonable wear and tear permits;\n11. That in case of rental arrears, the LESSOR may take possession of tenant property to offset arrears;\n12. That in case the premises is abandoned, the LESSOR may repossess without prejudice to legal action;\n13. That the LESSOR may increase rental by ten percent (10%) per year upon renewal by mutual agreement;\n14. That the LESSEE shall maintain cleanliness and peaceful condition inside and outside the premises;\n15. That the LESSEE has read and understood all provisions of this contract.\n\nIN WITNESS WHEREOF, the parties have hereunto set their hands this ${f(data.witnessDay, "___")} day of ${f(data.witnessMonth)}, ${f(data.witnessYear)} at the City of ${f(data.witnessCity)}, Philippines.\n\n${f(data.lesseeSignatureName, "Signature of Lessee")}\n${f(data.lessorSignatureName, "Signature of Lessor")}\n\nSIGNED IN THE PRESENCE OF:\n${f(data.witness1Name)}\n${f(data.witness2Name)}\n\nREPUBLIC OF THE PHILIPPINES)\n${f(data.notaryCity)} ) S.S.\n\nACKNOWLEDGEMENT\n\nBEFORE ME, a Notary Public for and in ${f(data.notaryCity)}, this ${f(data.ackDay, "___")} day of ${f(data.ackMonth)}, 20${f(data.ackYear, "__")}, personally came and appeared ${f(data.idPresentedBy)} showing a competent proof of identification: ${f(data.idType)} ${f(data.idNumber)} valid until ${f(data.idValidUntil)}, known to me and to me known to be the same person who executed the foregoing instrument and acknowledged that the same is his free and voluntary act and deed.\n\nWITNESS MY HAND AND SEAL....................`

	y = drawParagraph(page, content, 72, y, helvetica, 10, 468, 14)

	await downloadPdf(pdf, `contract-of-lease-${Date.now()}.pdf`)
}

// Real Estate Mortgage
export async function exportRealEstateMortgage(data: RealEstateMortgageData): Promise<void> {
	const pdf = await PDFDocument.create()
	const page = pdf.addPage([612, 792])
	const helvetica = await pdf.embedFont(StandardFonts.Helvetica)
	const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold)

	let y = 720

	page.drawText("REAL ESTATE MORTGAGE", {
		x: 208,
		y,
		font: helveticaBold,
		size: 12,
	})

	y -= 36

	const content = `KNOW ALL MEN BY THESE PRESENTS:\n\nThis REAL ESTATE MORTGAGE (REM), made and executed in ${f(data.executionPlace)}, Philippines, by and between:\n\n${f(data.mortgagorName)}, of legal age, single/married to ${f(data.mortgagorSpouseName)}, Filipino/doing business within the Philippines, and with residence/principal address at ${f(data.mortgagorAddress)}, hereinafter referred to as the MORTGAGOR/BORROWER;\n\n-and-\n\n${f(data.mortgageeName)}, of legal age, single/married to ${f(data.mortgageeSpouseName)}, Filipino/doing business within the Philippines, and with residence/principal address at ${f(data.mortgageeAddress)}, hereinafter referred to as the MORTGAGEE/LENDER.\n\nWITNESSETH THAT:\n\nThis agreement is entered into by the parties for the purpose of obtaining a loan in the sum of ${f(data.loanAmountWords)} PESOS (${f(data.loanAmountFigures)}), Philippine currency, to be paid by the MORTGAGOR/BORROWER, who hereby by way of MORTGAGE, unto the said MORTGAGEE/LENDER, his/her/their heirs and assigns, that certain parcel of land, together with all the buildings and improvements thereon, situated in ${f(data.propertyLocation)}, more particularly described as follows:\n\nTCT/CCT No. ${f(data.propertyTctCctNo)}\n\n${f(data.propertyDescription)}\n\nof which real property, the MORTGAGOR is the registered owner in accordance with the provisions of the Presidential Decree No. 1529 (PD 1529) or the Property Registration Decree, as evidenced by Original/Transfer/Condominium (OCT/TCT/CCT) No. ${f(data.propertyTctCctNo)}, registered at the Register of Deeds of ${f(data.registeredDeedsOffice)}, with an area of ${f(data.propertyAreaSqm)} square meters (____ sq. m.);\n\nWHEREAS, the MORTGAGOR/BORROWER shall not dispose or transfer the said parcel of land without the knowledge and consent of the MORTGAGEE/LENDER;\n\nWHEREAS, in the event of default by the MORTGAGOR/BORROWER, the obligation to pay the above-mentioned consideration shall be payable with interest. Failure to pay shall subject the MORTGAGEE/LENDER to file a Petition for Extrajudicial or Judicial Foreclosure of Mortgage in accordance with the provisions of Act 3135 and/or of the Rules of Court;\n\nPROVIDED, HOWEVER, that if the MORTGAGOR/BORROWER shall pay or cause to be paid to said MORTGAGEE/LENDER, his/her/their heirs or assigns, the sum of ${f(data.loanAmountFigures)} PESOS (${f(data.loanAmountWords)}), to be paid within a period of ${f(data.paymentPeriodYears)} years/months and after the execution of this REAL ESTATE MORTGAGE, together with interest thereon at the rate of ${f(data.interestRate)} percent (____%) per annum/month, then this mortgage shall be discharged and of no effect;\n\nOTHERWISE, this REM shall remain in full force and shall be enforceable in the manner provided for by law.\n\nIN WITNESS WHEREOF, I have hereunto set my hand this ${f(data.executionDay)} day of ${f(data.executionMonthYear)}, 20____, in ${f(data.executionCity)}, Philippines.\n\n${f(data.mortgagorSignatureName)}\n(Full name and signature of the Mortgagor/Borrower)\n\n${f(data.mortgageeSignatureName)}\n(Full name and signature of the Mortgagee/Lender)\n\nWith marital consent:\n${f(data.mortgagorSpouseName)}\n(Full name and signature of the Mortgagor's/Borrower's Spouse)\n\n${f(data.mortgageeSpouseName)}\n(Full name and signature of the Mortgagee's/Lender's Spouse)\n\nSIGNED IN THE PRESENCE OF:\n${f(data.witness1Name)}\n${f(data.witness2Name)}\n\nACKNOWLEDGMENT\nREPUBLIC OF THE PHILIPPINES\n${f(data.notaryCityProvince)}\n\nBEFORE ME, a Notary Public for and in ${f(data.notaryCityProvince)}, this ${f(data.ackDay)} day of ${f(data.ackMonthYear)}, personally appeared:\n${f(data.ackIdName1)} - ${f(data.ackIdDetails1)}\n${f(data.ackIdName2)} - ${f(data.ackIdDetails2)}\n\nKnown to me to be the same persons who executed the foregoing instrument, and acknowledged that the same is/are his/her/their free act and voluntary deed.`

	y = drawParagraph(page, content, 72, y, helvetica, 10, 468, 14)

	await downloadPdf(pdf, `real-estate-mortgage-${Date.now()}.pdf`)
}

// Contract of Services
export async function exportContractOfServices(data: ContractOfServicesData): Promise<void> {
	const pdf = await PDFDocument.create()
	const helvetica = await pdf.embedFont(StandardFonts.Helvetica)
	const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold)

	let page = pdf.addPage([PAGE_W, PAGE_H])
	const LH = SIZE_BODY * 1.55
	const LH_SM = SIZE_SM * 1.4
	let y = PAGE_H - MARGIN_TOP
	const x = MARGIN_H
	const indentX = x + 28

	const drawParagraphWithPageBreak = (
		text: string,
		xPos: number,
		font: PDFFont = helvetica,
		size = SIZE_BODY,
		maxWidth = CONTENT_W,
		lineHeight = LH
	) => {
		const lines = wrapText(text, font, size, maxWidth)
		for (const line of lines) {
			if (y < MARGIN_BOTTOM + lineHeight) {
				page = pdf.addPage([PAGE_W, PAGE_H])
				y = PAGE_H - MARGIN_TOP
			}
			page.drawText(line, { x: xPos, y, size, font, color: INK })
			y -= lineHeight
		}
	}

	// Title
	y = drawCentred(page, "CONTRACT OF SERVICES", y, helveticaBold, SIZE_TITLE)
	y -= LH * 0.5

	// Opening
	drawParagraphWithPageBreak("KNOW ALL MEN BY THESE PRESENTS:", x, helvetica, SIZE_BODY)
	y -= LH * 0.3

	// Parties intro
	const partiesIntro = `This Contract of Services ("Contract") made and executed by and between:`
	drawParagraphWithPageBreak(partiesIntro, x, helvetica, SIZE_BODY)
	y -= LH * 0.3

	// Provider party
	const providerText = `${f(data.serviceProviderName)}, a corporation duly organized and existing under Philippine laws, with business address at ${f(data.serviceProviderAddress)}, represented by its ${f(data.serviceProviderRepresentative)};`
	drawParagraphWithPageBreak(providerText, x, helvetica, SIZE_BODY)
	y -= LH * 0.3

	// And connector
	page.drawText("-and-", { x: (PAGE_W - helvetica.widthOfTextAtSize("-and-", SIZE_BODY)) / 2, y, size: SIZE_BODY, font: helvetica, color: INK })
	y -= LH

	// Client party
	const clientText = `${f(data.clientName)}, a corporation organized and existing under Philippine laws with office address at ${f(data.clientAddress)}, represented by its ${f(data.clientRepresentative)} ("CLIENT").`
	drawParagraphWithPageBreak(clientText, x, helvetica, SIZE_BODY)
	y -= LH * 0.3

	// Parties definition
	const partiesDef = `(Each of ${f(data.serviceProviderName)} and the CLIENT shall be referred to as a "Party"; and collectively as the "Parties").`
	drawParagraphWithPageBreak(partiesDef, x, helvetica, SIZE_BODY)
	y -= LH

	// RECITALS
	page.drawText("RECITALS:", { x, y, size: SIZE_BODY, font: helveticaBold, color: INK })
	y -= LH

	// Recital A
	const recitalA = `A. ${f(data.serviceProviderName)} with Certificate of Filing of Amended Articles of Incorporation/Company Registration No. _____ issued by Securities and Exchange Commission Main Office on _____ is an independent service provider with substantial capital, equipment, and expertise, engaged in ${f(data.serviceDescription)} services; and`
	drawParagraphWithPageBreak(recitalA, x, helvetica, SIZE_BODY)
	y -= LH * 0.5

	// Recital B
	const recitalB = `B. The CLIENT, relying on the representations of ${f(data.serviceProviderName)} and in need of the Services, has accepted XCORP's offer to supply the service requirements of the CLIENT under the terms and conditions specified hereunder.`
	drawParagraphWithPageBreak(recitalB, x, helvetica, SIZE_BODY)
	y -= LH

	// NOW THEREFORE
	const nowTherefore = `NOW, THEREFORE, for and in consideration of the foregoing premises and the terms and conditions hereunder set forth, the parties hereto agree as follows:`
	drawParagraphWithPageBreak(nowTherefore, x, helvetica, SIZE_BODY)
	y -= LH * 0.5

	// Term 1: Scope of Work
	const term1 = `1. Scope of Work â€” The CLIENT hereby engages ${f(data.serviceProviderName)} to provide the CLIENT, within ten (10) days from receipt of request or execution of this Contract, the services identified in Annex "A", as required by the CLIENT in the areas of clerical, technical, professional, and similar services, including but not limited to: ${f(data.scopeOfWork)} (the "Services").`
	drawParagraphWithPageBreak(term1, indentX, helvetica, SIZE_SM)
	y -= LH_SM * 0.5

	// Term 2: Qualification
	const term2 = `2. Qualification â€” ${f(data.serviceProviderName)} shall assign personnel who possess the necessary skills and qualifications as required by the CLIENT ("Personnel") for the performance of the Services.`
	drawParagraphWithPageBreak(term2, indentX, helvetica, SIZE_SM)
	y -= LH_SM * 0.5

	// Term 3: Place of Work
	const term3 = `3. Place of Work â€” The Personnel's regular place of work will be at ${f(data.workLocation)}. XCORP Personnel may only be assigned to work at other locations upon the approval of XCORP.`
	drawParagraphWithPageBreak(term3, indentX, helvetica, SIZE_SM)
	y -= LH_SM * 0.5

	// Term 4: Supplies, Tools and Equipment
	const term4 = `4. Supplies, Tools and Equipment â€” ${f(data.serviceProviderName)} shall provide the necessary standard supplies, tools, equipment, and other facilities to be used by its Personnel assigned to the CLIENT, which shall be maintained by XCORP in good working condition for the duration of the Contract.`
	drawParagraphWithPageBreak(term4, indentX, helvetica, SIZE_SM)
	y -= LH_SM * 0.5

	// Term 5: Consideration
	const term5 = `5. Consideration â€” For and in consideration of the Services to be rendered by ${f(data.serviceProviderName)}, the CLIENT shall pay XCORP the billing rates as provided in the "Monthly Billing Rates" attached as Annex "B" and made an integral part of this Contract. The rates quoted include government mandatory contribution and Administrative Service Fee of ${f(data.advanceAdminFeePercent)}%. Value Added Tax (VAT). The rates, however, shall be subject to proportionate wage increase in the minimum wage, wage rates, wage related benefits, mandatory government contributions, tax rates, other fees and the additional costs incidental to any change in billing procedures subsequently imposed by CLIENT. The CLIENT shall have a non-extendible period of 15 days from receipt of any invoice showing any unpaid charges for billing adjustment, failing which, the billing shall be considered final.`
	drawParagraphWithPageBreak(term5, indentX, helvetica, SIZE_SM)
	y -= LH_SM * 0.5

	// Term 6: Cash Advance/Reimbursement
	const term6 = `6. Cash Advance/Reimbursement - Should the Personnel need to travel within or outside Metro Cebu in the performance of the Services to the CLIENT, XCORP may advance the travel expense subject to reimbursement by CLIENT, provided that the CLIENT will send a written request for the required travel at least five (5) days prior to travel. The Personnel's travel expense in the form of cash advances and/or reimbursement shall be charged ten percent (10%) interest and must be reimbursed by the CLIENT within sixty (60) days after the travel.`
	drawParagraphWithPageBreak(term6, indentX, helvetica, SIZE_SM)
	y -= LH_SM * 0.5

	// Term 7: Mode of Payment
	const term7 = `7. Mode of Payment - All bills shall be paid within fifteen (15) calendar days from receipt thereof. Bills unpaid after fifteen (15) calendar days shall automatically earn interest at the monthly rate provided herein as part of the billing. A fraction of a month shall be considered as one month. Non-payment of bills for two (2) consecutive months or more shall be a support for XCORP to terminate the Contract.`
	drawParagraphWithPageBreak(term7, indentX, helvetica, SIZE_SM)
	y -= LH_SM * 0.5

	// Term 8: Overtime and Services Rendered on Holidays
	const term8 = `8. Overtime and Services Rendered on Holidays â€” For services rendered over and above the eight (8) hour regular working time and/or during night shift/rest day/holiday/rest day, XCORP shall charge overtime, night differential and holiday pay as the case may be at rates as allowed under applicable government rules and regulations and other laws of the Republic of the Philippines. XSERV shall be in charge of monitoring of the service in question by its Personnel.`
	drawParagraphWithPageBreak(term8, indentX, helvetica, SIZE_SM)
	y -= LH_SM * 0.5

	// Term 9: Benefits under Labor Code
	const term9 = `9. Benefits under Labor Code and Special Laws â€” Entitlement of the Personnel under labor laws and other special laws, shall be included in XCORP's billing, which shall be billed to the CLIENT when the employees concerned become entitled to such benefit as provided for under the law. XCORP shall, at the end of each billing period, submit to CLIENT an affidavit to the effect that it has paid all of its Personnel assigned to CLIENT all their compensation and/or benefits, if any, for such period in accordance with the labor laws.`
	drawParagraphWithPageBreak(term9, indentX, helvetica, SIZE_SM)
	y -= LH_SM * 0.5

	// Term 10: Posting of Bond
	const term10 = `10. Posting of Bond - The CLIENT may require ${f(data.serviceProviderName)} to furnish a bond, renewable every year, on condition that the bond shall answer for the wages due XCORP Personnel should XCORP fail to pay the same.`
	drawParagraphWithPageBreak(term10, indentX, helvetica, SIZE_SM)
	y -= LH_SM * 0.5

	// Term 11: No Employer-Employee Relationship
	const term11 = `11. No Employer-Employee Relationship â€” XCORP warrants that it is an independent contractor duly registered with the Department of Labor and Employment. It is expressly understood that there is NO EMPLOYER-EMPLOYEE RELATIONSHIP between the CLIENT and the Personnel and that XCORP as the employer shall be solely responsible for the claims and/or demands of the Personnel.`
	drawParagraphWithPageBreak(term11, indentX, helvetica, SIZE_SM)
	y -= LH * 0.8

	// IN WITNESS WHEREOF
	const witnessWhereof = `IN WITNESS WHEREOF, the Parties, through their duly authorized representative, have hereunto set their hands on ${f(data.effectivityDay)} at the ${f(data.effectivityCity)}, Philippines.`
	drawParagraphWithPageBreak(witnessWhereof, x, helvetica, SIZE_BODY)
	y -= LH * 1.5

	// Signature lines
	page.drawText("_____________________", { x, y, size: SIZE_BODY, font: helvetica, color: INK })
	page.drawText("_____________________", { x: x + 250, y, size: SIZE_BODY, font: helvetica, color: INK })
	y -= LH * 1.5

	// By line
	page.drawText("By:", { x, y, size: SIZE_BODY, font: helvetica, color: INK })
	y -= LH * 1.5

	// Representative lines
	page.drawText("_____________________", { x, y, size: SIZE_BODY, font: helvetica, color: INK })
	page.drawText("_____________________", { x: x + 250, y, size: SIZE_BODY, font: helvetica, color: INK })
	y -= LH * 1.8

	// SIGNED IN THE PRESENCE OF
	page.drawText("SIGNED IN THE PRESENCE OF:", { x: (PAGE_W - helvetica.widthOfTextAtSize("SIGNED IN THE PRESENCE OF:", SIZE_BODY)) / 2, y, size: SIZE_BODY, font: helvetica, color: INK })
	y -= LH * 1.8

	// Witness lines
	page.drawText("_____________________", { x, y, size: SIZE_BODY, font: helvetica, color: INK })
	page.drawText("_____________________", { x: x + 250, y, size: SIZE_BODY, font: helvetica, color: INK })
	y -= LH * 1.5

	// ACKNOWLEDGMENT section
	if (y < MARGIN_BOTTOM + LH * 6) {
		page = pdf.addPage([PAGE_W, PAGE_H])
		y = PAGE_H - MARGIN_TOP
	}

	page.drawText("ACKNOWLEDGMENT", { x: (PAGE_W - helvetica.widthOfTextAtSize("ACKNOWLEDGMENT", SIZE_BODY)) / 2, y, size: SIZE_BODY, font: helveticaBold, color: INK })
	y -= LH

	page.drawText("REPUBLIC OF THE PHILIPPINES )", { x, y, size: SIZE_SM, font: helvetica, color: INK })
	y -= LH_SM
	page.drawText(`${f(data.notaryCityProvince)} ) S.S.`, { x, y, size: SIZE_SM, font: helvetica, color: INK })
	y -= LH_SM * 1.5

	const ackText = `6, a Notary Public for and in the above jurisdiction on this day of ____, personally appeared:`
	drawParagraphWithPageBreak(ackText, x, helvetica, SIZE_SM)
	y -= LH_SM

	// Names and proof
	page.drawText("Name", { x, y, size: SIZE_SM, font: helveticaBold, color: INK })
	page.drawText("Proof of Identity", { x: x + 150, y, size: SIZE_SM, font: helveticaBold, color: INK })
	page.drawText("Type of Proof Presented", { x: x + 300, y, size: SIZE_SM, font: helveticaBold, color: INK })
	y -= LH_SM * 1.3

	page.drawText("_____________________", { x, y, size: SIZE_SM, font: helvetica, color: INK })
	page.drawText("_____________________", { x: x + 150, y, size: SIZE_SM, font: helvetica, color: INK })
	page.drawText("_____________________", { x: x + 300, y, size: SIZE_SM, font: helvetica, color: INK })
	y -= LH_SM * 1.8

	// Final acknowledgment text
	const finalAck = `Known to me and to me known to be the same persons who executed the foregoing instrument and they acknowledged to me that the same is their free and voluntary act and deed as well as of the corporations which they represent and that they are duly authorized to do the same.`
	drawParagraphWithPageBreak(finalAck, x, helvetica, SIZE_SM)
	y -= LH_SM * 1.5

	// Notary signature
	page.drawText("WITNESS MY HAND AND OFFICIAL SEAL the last day of the day, month and year first above written.", {
		x,
		y,
		size: SIZE_SM,
		font: helvetica,
		color: INK,
	})

	await downloadPdf(pdf, `contract-of-services-${Date.now()}.pdf`)
}

	// â”€â”€ Download helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function downloadPdf(pdf: PDFDocument, filename: string): Promise<void> {
	const bytes = await pdf.save()
	const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" })
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement("a")
	anchor.href = url
	anchor.download = filename
	anchor.click()
	URL.revokeObjectURL(url)
}
