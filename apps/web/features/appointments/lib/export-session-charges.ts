import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib"

import type {
	AppointmentAttachment,
	MeetingFeeBreakdown,
	MeetingPaymentStatus,
} from "@repo/contracts"

export interface SessionChargesLineItem {
	name: string
	notarialFeePhp: number | null
}

export interface SessionChargesExportInput {
	appointmentId: string
	appointmentTitle?: string
	lineItems: SessionChargesLineItem[]
	breakdown?: MeetingFeeBreakdown
}

/** Receipt downloads are allowed only after a successful session payment. */
export function canDownloadSessionChargesReceipt(
	paymentStatus?: MeetingPaymentStatus | null
): boolean {
	if (!paymentStatus?.paid) return false
	if ((paymentStatus.totalFeePhp ?? 0) <= 0) return false
	if (paymentStatus.required && paymentStatus.status !== "succeeded") return false
	return true
}

export function buildSessionChargesExportInput(
	appointmentId: string,
	appointmentTitle: string | undefined,
	attachments: AppointmentAttachment[],
	paymentStatus: MeetingPaymentStatus | null | undefined
): SessionChargesExportInput | null {
	if (!canDownloadSessionChargesReceipt(paymentStatus)) return null
	return {
		appointmentId,
		appointmentTitle,
		lineItems: lineItemsFromAttachments(attachments),
		breakdown: paymentStatus?.breakdown,
	}
}

function escapeCsvField(value: string): string {
	if (/[",\n\r]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`
	}
	return value
}

function formatPhpPlain(amount: number): string {
	return amount.toFixed(0)
}

function buildFilenameStem(appointmentId: string): string {
	const date = new Date().toISOString().slice(0, 10)
	return `session-charges-${appointmentId.slice(0, 8)}-${date}`
}

function buildReceiptFilenameStem(appointmentId: string): string {
	const date = new Date().toISOString().slice(0, 10)
	return `payment-receipt-${appointmentId.slice(0, 8)}-${date}`
}

const RECEIPT_PAGE_WIDTH = 400
const RECEIPT_MARGIN = 28
const RECEIPT_LINE = 16
const RECEIPT_FONT_XS = 8
const RECEIPT_FONT_SM = 9
const RECEIPT_FONT_MD = 10
const RECEIPT_FONT_XL = 16
const RECEIPT_AMOUNT_SIZE = RECEIPT_FONT_SM

const RECEIPT_INK = rgb(0.12, 0.12, 0.14)
const RECEIPT_MUTED = rgb(0.42, 0.42, 0.48)
const RECEIPT_BORDER = rgb(0.82, 0.82, 0.86)
const RECEIPT_TOTAL_BG = rgb(0.94, 0.94, 0.97)

interface ReceiptLayout {
	pageWidth: number
	margin: number
	contentWidth: number
	amountRight: number
	metaValueX: number
	labelMaxWidth: number
}

function createReceiptLayout(pageWidth: number, margin: number, regular: PDFFont): ReceiptLayout {
	const contentWidth = pageWidth - margin * 2
	const amountRight = pageWidth - margin
	const amountColWidth = regular.widthOfTextAtSize("PHP 9,999,999.99", RECEIPT_AMOUNT_SIZE) + 4
	const labelMaxWidth = contentWidth - amountColWidth - 8
	const metaLabels = ["Receipt no.", "Date", "Session", "Reference"]
	const metaLabelCol =
		Math.max(...metaLabels.map(label => regular.widthOfTextAtSize(label, RECEIPT_FONT_SM))) + 14

	return {
		pageWidth,
		margin,
		contentWidth,
		amountRight,
		metaValueX: margin + metaLabelCol,
		labelMaxWidth,
	}
}

function formatReceiptAmountValue(amount: number): string {
	return amount.toLocaleString("en-PH", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})
}

function formatReceiptDate(date: Date): string {
	return date.toLocaleString("en-PH", {
		dateStyle: "medium",
		timeStyle: "short",
	})
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
	if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
	let trimmed = text
	while (trimmed.length > 1 && font.widthOfTextAtSize(`${trimmed}…`, size) > maxWidth) {
		trimmed = trimmed.slice(0, -1)
	}
	return `${trimmed}…`
}

function drawReceiptDivider(
	page: PDFPage,
	y: number,
	width: number,
	margin: number,
	dashed = false
) {
	const x1 = margin
	const x2 = width - margin
	if (dashed) {
		for (let x = x1; x < x2; x += 6) {
			page.drawLine({
				start: { x, y },
				end: { x: Math.min(x + 3, x2), y },
				thickness: 0.5,
				color: RECEIPT_BORDER,
			})
		}
		return
	}
	page.drawLine({
		start: { x: x1, y },
		end: { x: x2, y },
		thickness: 0.75,
		color: RECEIPT_BORDER,
	})
}

function drawReceiptCentered(
	page: PDFPage,
	font: PDFFont,
	text: string,
	y: number,
	size: number,
	pageWidth: number,
	color = RECEIPT_INK
) {
	const textWidth = font.widthOfTextAtSize(text, size)
	page.drawText(text, {
		x: (pageWidth - textWidth) / 2,
		y,
		size,
		font,
		color,
	})
}

function drawReceiptMetaRow(
	page: PDFPage,
	font: PDFFont,
	label: string,
	value: string,
	y: number,
	layout: ReceiptLayout
) {
	page.drawText(label, {
		x: layout.margin,
		y,
		size: RECEIPT_FONT_SM,
		font,
		color: RECEIPT_MUTED,
	})
	const valueMaxWidth = layout.pageWidth - layout.margin - layout.metaValueX
	const displayValue = truncateToWidth(value, font, RECEIPT_FONT_SM, valueMaxWidth)
	page.drawText(displayValue, {
		x: layout.metaValueX,
		y,
		size: RECEIPT_FONT_SM,
		font,
		color: RECEIPT_INK,
	})
}

function drawReceiptAmountValue(
	page: PDFPage,
	font: PDFFont,
	amount: number | null,
	y: number,
	amountRight: number,
	placeholder = "—"
) {
	if (amount === null) {
		const textWidth = font.widthOfTextAtSize(placeholder, RECEIPT_AMOUNT_SIZE)
		page.drawText(placeholder, {
			x: amountRight - textWidth,
			y,
			size: RECEIPT_AMOUNT_SIZE,
			font,
			color: RECEIPT_INK,
		})
		return
	}

	const prefix = "PHP "
	const value = formatReceiptAmountValue(amount)
	const prefixWidth = font.widthOfTextAtSize(prefix, RECEIPT_AMOUNT_SIZE)
	const valueWidth = font.widthOfTextAtSize(value, RECEIPT_AMOUNT_SIZE)
	const valueX = amountRight - valueWidth

	page.drawText(prefix, {
		x: valueX - prefixWidth,
		y,
		size: RECEIPT_AMOUNT_SIZE,
		font,
		color: RECEIPT_INK,
	})
	page.drawText(value, {
		x: valueX,
		y,
		size: RECEIPT_AMOUNT_SIZE,
		font,
		color: RECEIPT_INK,
	})
}

function drawReceiptAmountRow(
	page: PDFPage,
	font: PDFFont,
	boldFont: PDFFont,
	label: string,
	amount: number | null,
	y: number,
	layout: ReceiptLayout,
	opts?: { boldLabel?: boolean; mutedLabel?: boolean; amountPlaceholder?: string }
) {
	const labelFont = opts?.boldLabel ? boldFont : font
	const labelSize = opts?.boldLabel ? RECEIPT_FONT_MD : RECEIPT_FONT_SM
	const labelColor = opts?.mutedLabel ? RECEIPT_MUTED : RECEIPT_INK
	const labelText = truncateToWidth(label, labelFont, labelSize, layout.labelMaxWidth)

	page.drawText(labelText, {
		x: layout.margin,
		y,
		size: labelSize,
		font: labelFont,
		color: labelColor,
	})

	drawReceiptAmountValue(page, font, amount, y, layout.amountRight, opts?.amountPlaceholder)
}

async function buildSessionChargesReceiptPdf(
	input: SessionChargesExportInput
): Promise<Uint8Array> {
	const lineCount = input.lineItems.length
	const hasBreakdown = Boolean(input.breakdown)
	const headerBlock = 118
	const metaBlock = input.appointmentTitle?.trim() ? 72 : 58
	const tableHeader = 36
	const itemsBlock = Math.max(lineCount, 1) * RECEIPT_LINE
	const breakdownBlock = hasBreakdown ? 108 : 0
	const footerBlock = 56
	const pageHeight = Math.min(
		792,
		Math.max(
			520,
			headerBlock + metaBlock + tableHeader + itemsBlock + breakdownBlock + footerBlock + 48
		)
	)

	const pdf = await PDFDocument.create()
	const page = pdf.addPage([RECEIPT_PAGE_WIDTH, pageHeight])
	const regular = await pdf.embedFont(StandardFonts.Helvetica)
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

	const margin = RECEIPT_MARGIN
	const layout = createReceiptLayout(RECEIPT_PAGE_WIDTH, margin, regular)
	const receiptNo = input.appointmentId.replace(/-/g, "").slice(0, 12).toUpperCase()
	const generatedAt = new Date()

	let y = pageHeight - margin

	drawReceiptCentered(page, bold, "QUANBY LEGAL", y - 18, RECEIPT_FONT_XL, RECEIPT_PAGE_WIDTH)
	drawReceiptCentered(
		page,
		regular,
		"Session Payment Receipt",
		y - 34,
		RECEIPT_FONT_MD,
		RECEIPT_PAGE_WIDTH,
		RECEIPT_MUTED
	)
	y -= headerBlock

	drawReceiptMetaRow(page, regular, "Receipt no.", receiptNo, y, layout)
	y -= RECEIPT_LINE
	drawReceiptMetaRow(page, regular, "Date", formatReceiptDate(generatedAt), y, layout)
	y -= RECEIPT_LINE
	if (input.appointmentTitle?.trim()) {
		drawReceiptMetaRow(page, regular, "Session", input.appointmentTitle.trim(), y, layout)
		y -= RECEIPT_LINE
	}
	drawReceiptMetaRow(page, regular, "Reference", input.appointmentId, y, layout)
	y -= RECEIPT_LINE + 6

	drawReceiptDivider(page, y, RECEIPT_PAGE_WIDTH, margin)
	y -= 16

	const descHeader = "Description"
	const amtHeader = "Amount"
	const amtHeaderWidth = bold.widthOfTextAtSize(amtHeader, RECEIPT_FONT_SM)
	page.drawText(descHeader, {
		x: layout.margin,
		y,
		size: RECEIPT_FONT_SM,
		font: bold,
		color: RECEIPT_MUTED,
	})
	page.drawText(amtHeader, {
		x: layout.amountRight - amtHeaderWidth,
		y,
		size: RECEIPT_FONT_SM,
		font: bold,
		color: RECEIPT_MUTED,
	})
	y -= RECEIPT_LINE
	drawReceiptDivider(page, y, RECEIPT_PAGE_WIDTH, margin, true)
	y -= 14

	if (lineCount === 0) {
		drawReceiptAmountRow(page, regular, bold, "No documents listed", null, y, layout, {
			mutedLabel: true,
			amountPlaceholder: "—",
		})
		y -= RECEIPT_LINE
	} else {
		for (const item of input.lineItems) {
			const fee =
				item.notarialFeePhp !== null && item.notarialFeePhp > 0 ? item.notarialFeePhp : null
			drawReceiptAmountRow(page, regular, bold, item.name, fee, y, layout, {
				amountPlaceholder: "Pending",
			})
			y -= RECEIPT_LINE
		}
	}

	if (input.breakdown) {
		y -= 6
		drawReceiptDivider(page, y, RECEIPT_PAGE_WIDTH, margin)
		y -= 16
		drawReceiptCentered(
			page,
			bold,
			"Summary",
			y,
			RECEIPT_FONT_SM,
			RECEIPT_PAGE_WIDTH,
			RECEIPT_MUTED
		)
		y -= RECEIPT_LINE + 4

		const b = input.breakdown
		const summaryRows: [string, number][] = [
			["Notarial fee", b.notarialFeePhp],
			["Convenience fee (5%)", b.convenienceFeePhp],
			["Processing fee", b.processingFeePhp],
			["VAT (12%)", b.vatPhp],
		]
		for (const [label, amount] of summaryRows) {
			drawReceiptAmountRow(page, regular, bold, label, amount, y, layout, {
				mutedLabel: true,
			})
			y -= RECEIPT_LINE
		}

		y -= 10
		const totalRowHeight = 24
		const totalTextY = y
		page.drawRectangle({
			x: layout.margin - 2,
			y: totalTextY - 8,
			width: layout.contentWidth + 4,
			height: totalRowHeight,
			color: RECEIPT_TOTAL_BG,
			borderColor: RECEIPT_BORDER,
			borderWidth: 0.5,
		})
		drawReceiptAmountRow(page, regular, bold, "TOTAL DUE", b.totalPhp, totalTextY, layout, {
			boldLabel: true,
		})
		y = totalTextY - totalRowHeight - 8
	} else {
		const docTotal = input.lineItems.reduce(
			(sum, item) =>
				sum + (item.notarialFeePhp !== null && item.notarialFeePhp > 0 ? item.notarialFeePhp : 0),
			0
		)
		if (docTotal > 0) {
			y -= 6
			drawReceiptDivider(page, y, RECEIPT_PAGE_WIDTH, margin)
			y -= 16
			drawReceiptAmountRow(page, regular, bold, "Subtotal (notarial)", docTotal, y, layout, {
				boldLabel: true,
			})
			y -= RECEIPT_LINE
		}
	}

	y -= 8
	drawReceiptDivider(page, y, RECEIPT_PAGE_WIDTH, margin)
	y -= 16

	const footerLines = [
		"Thank you for using Quanby Legal.",
		"This receipt summarizes session charges for your",
		"notarization appointment. Keep for your records.",
	]
	for (const line of footerLines) {
		drawReceiptCentered(page, regular, line, y, RECEIPT_FONT_XS, RECEIPT_PAGE_WIDTH, RECEIPT_MUTED)
		y -= 11
	}

	page.drawRectangle({
		x: 12,
		y: 12,
		width: RECEIPT_PAGE_WIDTH - 24,
		height: pageHeight - 24,
		borderColor: RECEIPT_BORDER,
		borderWidth: 1,
	})

	return pdf.save()
}

export function buildSessionChargesCsv(input: SessionChargesExportInput): string {
	const generatedAt = new Date().toISOString()
	const rows: string[] = [
		"Session charges export",
		`Appointment ID,${escapeCsvField(input.appointmentId)}`,
	]

	if (input.appointmentTitle?.trim()) {
		rows.push(`Appointment title,${escapeCsvField(input.appointmentTitle.trim())}`)
	}
	rows.push(`Generated at,${escapeCsvField(generatedAt)}`, "", "Document,Notarial fee (PHP)")

	for (const item of input.lineItems) {
		const fee =
			item.notarialFeePhp !== null && item.notarialFeePhp > 0
				? formatPhpPlain(item.notarialFeePhp)
				: ""
		rows.push(`${escapeCsvField(item.name)},${fee}`)
	}

	if (input.breakdown) {
		const b = input.breakdown
		rows.push(
			"",
			"Fee breakdown",
			"Line,Amount (PHP)",
			`Notarial fee,${formatPhpPlain(b.notarialFeePhp)}`,
			`Convenience fee (5%),${formatPhpPlain(b.convenienceFeePhp)}`,
			`Processing fee,${formatPhpPlain(b.processingFeePhp)}`,
			`VAT (12%),${formatPhpPlain(b.vatPhp)}`,
			`Total,${formatPhpPlain(b.totalPhp)}`
		)
	}

	return rows.join("\n")
}

function triggerBrowserDownload(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement("a")
	anchor.href = url
	anchor.download = filename
	anchor.rel = "noopener"
	document.body.appendChild(anchor)
	anchor.click()
	anchor.remove()
	URL.revokeObjectURL(url)
}

export function downloadSessionChargesCsv(
	input: SessionChargesExportInput,
	paymentStatus?: MeetingPaymentStatus | null
) {
	if (!canDownloadSessionChargesReceipt(paymentStatus)) {
		throw new Error("Receipt download requires a successful payment.")
	}
	const csv = buildSessionChargesCsv(input)
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
	triggerBrowserDownload(blob, `${buildFilenameStem(input.appointmentId)}.csv`)
}

export async function downloadSessionChargesPdf(
	input: SessionChargesExportInput,
	paymentStatus?: MeetingPaymentStatus | null
) {
	if (!canDownloadSessionChargesReceipt(paymentStatus)) {
		throw new Error("Receipt download requires a successful payment.")
	}
	const bytes = await buildSessionChargesReceiptPdf(input)
	triggerBrowserDownload(
		new Blob([bytes as BlobPart], { type: "application/pdf" }),
		`${buildReceiptFilenameStem(input.appointmentId)}.pdf`
	)
}

export function meetingDocumentDisplayName(att: AppointmentAttachment, index: number): string {
	const named = att.documentName?.trim()
	if (named) return named
	if (att.mimeType.includes("pdf")) return `Document ${index + 1}.pdf`
	if (att.mimeType.startsWith("image/")) return `Image ${index + 1}`
	return `Attachment ${index + 1}`
}

export function lineItemsFromAttachments(
	items: AppointmentAttachment[],
	documentName: (att: AppointmentAttachment, index: number) => string = meetingDocumentDisplayName
): SessionChargesLineItem[] {
	return items.map((att, idx) => ({
		name: documentName(att, idx),
		notarialFeePhp:
			typeof att.feePhp === "number" && att.feePhp > 0 ? Math.floor(att.feePhp) : null,
	}))
}
