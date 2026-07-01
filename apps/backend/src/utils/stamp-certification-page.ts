import { randomUUID } from "node:crypto"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { eq } from "drizzle-orm"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import * as qrcode from "qrcode"

import { db } from "@/common/database/database.client"
import { publicAppUrl } from "@/config/env.config"
import { enpProfiles, users } from "@repo/db/schema"

const CERT_PAGE_MARKER = "qlegal-certification-page"

const FONT_SIZE = 6.5
const LINE_HEIGHT = 8
const PAGE_TOP = 740

function pdfDocAlreadyHasCertPage(doc: PDFDocument): boolean {
	return (doc.getSubject() ?? "").includes(CERT_PAGE_MARKER)
}

function str(v: string | null | undefined): string {
	if (v === null || v === undefined) return ""
	return String(v).trim()
}

function fmtYmd(d: Date | null | undefined): string {
	if (!d) return ""
	const t = d instanceof Date ? d : new Date(d)
	if (Number.isNaN(t.getTime())) return ""
	const year = t.getUTCFullYear()
	const month = String(t.getUTCMonth() + 1).padStart(2, "0")
	const day = String(t.getUTCDate()).padStart(2, "0")
	return `${year}-${month}-${day}`
}

function fmtMdy(d: Date | null | undefined): string {
	if (!d) return ""
	const t = d instanceof Date ? d : new Date(d)
	if (Number.isNaN(t.getTime())) return ""
	const month = String(t.getUTCMonth() + 1).padStart(2, "0")
	const day = String(t.getUTCDate()).padStart(2, "0")
	const year = t.getUTCFullYear()
	return `${month}/${day}/${year}`
}

function formatEnpName(
	prefix: string | null,
	firstName: string,
	lastName: string,
	suffix: string | null
): string {
	const parts = [prefix, firstName, lastName, suffix].filter(Boolean)
	return parts.join(" ").trim() || "Electronic Notary Public"
}

export type SealSessionMode = "remote" | "in_person" | "hybrid" | null | undefined

export async function stampCertificationPage(
	pdf: Buffer,
	enpUserId: string,
	options?: { sessionMode?: SealSessionMode }
): Promise<{ pdf: Buffer; code: string; hash: string }> {
	const [enp] = await db
		.select({
			prefix: enpProfiles.prefix,
			firstName: enpProfiles.firstName,
			lastName: enpProfiles.lastName,
			suffix: enpProfiles.suffix,
			rollNo: enpProfiles.rollNo,
			npnCommissionNo: enpProfiles.npnCommissionNo,
			commissionValidUntil: enpProfiles.commissionValidUntil,
			ptrNo: enpProfiles.ptrNo,
			ptrLocation: enpProfiles.ptrLocation,
			ptrDate: enpProfiles.ptrDate,
			ibpNo: enpProfiles.ibpNo,
			mcleNo: enpProfiles.mcleNo,
			mclePeriod: enpProfiles.mclePeriod,
			mcleDate: enpProfiles.mcleDate,
			notaryAddress: enpProfiles.notaryAddress,
			email: users.email,
		})
		.from(enpProfiles)
		.innerJoin(users, eq(users.id, enpProfiles.userId))
		.where(eq(enpProfiles.userId, enpUserId))
		.limit(1)

	if (!enp) return { pdf, code: "", hash: "" }

	const doc = await PDFDocument.load(pdf, { ignoreEncryption: true })
	if (pdfDocAlreadyHasCertPage(doc)) return { pdf, code: "", hash: "" }

	const regular = await doc.embedFont(StandardFonts.Helvetica)
	const bold = await doc.embedFont(StandardFonts.HelveticaBold)

	const page = doc.addPage([612, 792])
	const pw = page.getWidth()

	const verificationCode = randomUUID().replace(/-/g, "").slice(0, 12)

	// --- Left: Supreme Court Seal ---
	const qrSize = 75
	const sealX = 20
	const sealY = PAGE_TOP - qrSize

	try {
		const sealPath = resolve(
			process.cwd(),
			"../web/public/registry/SC-SEAL.png"
		)
		const sealPng = readFileSync(sealPath)
		const sealImage = await doc.embedPng(sealPng)
		const scale = Math.min(qrSize / sealImage.width, qrSize / sealImage.height)
		page.drawImage(sealImage, {
			x: sealX,
			y: sealY,
			width: sealImage.width * scale,
			height: sealImage.height * scale,
		})
	} catch {
		const sealW = 150
		const sealH = 52
		page.drawRectangle({
			x: sealX,
			y: sealY,
			width: sealW,
			height: sealH,
			color: rgb(0.1, 0.14, 0.49),
		})
		page.drawRectangle({
			x: sealX + 4,
			y: sealY,
			width: 4,
			height: sealH,
			color: rgb(1, 1, 1),
			opacity: 0.7,
		})
		page.drawText("Supreme Court", {
			x: sealX + 16,
			y: sealY + 31,
			size: 14,
			font: bold,
			color: rgb(1, 1, 1),
		})
		page.drawText("Philippines", {
			x: sealX + 16,
			y: sealY + 14,
			size: 11,
			font: regular,
			color: rgb(1, 1, 1),
			opacity: 0.85,
		})
	}

	// --- Center: ENP Notarial Seal ---
	const name = formatEnpName(enp.prefix, enp.firstName, enp.lastName, enp.suffix)
	const commission = str(enp.npnCommissionNo)
	const validUntil = fmtYmd(enp.commissionValidUntil)
	const roll = str(enp.rollNo)
	const ptr = [str(enp.ptrNo), str(enp.ptrLocation), fmtMdy(enp.ptrDate)]
		.filter(Boolean)
		.join(" & ")
	const ibp = str(enp.ibpNo)
	const email = str(enp.email)
	const address = str(enp.notaryAddress)
	const mcle = str(enp.mcleNo) || "Exempt"
	const mcleNote = str(enp.mclePeriod)
	const mcleDate = fmtMdy(enp.mcleDate)
	const mode = options?.sessionMode === "in_person" ? "IEN" : "REN"

	const fields: { label: string; value: string }[] = [
		{ label: "ENP Name:", value: name },
		{ label: "Roll of Attorney's No.:", value: roll },
		{
			label: "Commission No. & Validity of Commission:",
			value: commission ? `${commission} & ${validUntil}` : validUntil,
		},
		{ label: "PTR No. & Place of Issuance & Date of Issuance:", value: ptr },
		{ label: "IBP Membership No.:", value: ibp },
		{ label: "ENP's email address:", value: email },
		{ label: "ENP's business address:", value: address },
		{ label: "Mode of Electronic Notarization:", value: mode },
		{
			label: "MCLE Compliance No. & Date & Compliance Note:",
			value: [mcle, mcleDate, mcleNote].filter(Boolean).join(" & "),
		},
	]

	const headerText = "ELECTRONIC NOTARY PUBLIC"
	const headerWidth = bold.widthOfTextAtSize(headerText, 9)
	page.drawText(headerText, {
		x: (pw - headerWidth) / 2,
		y: PAGE_TOP,
		size: 9,
		font: bold,
		color: rgb(0, 0, 0),
	})

	const subText = "PHILIPPINES"
	const subWidth = regular.widthOfTextAtSize(subText, 7)
	page.drawText(subText, {
		x: (pw - subWidth) / 2,
		y: PAGE_TOP - 10,
		size: 7,
		font: regular,
		color: rgb(0.4, 0.4, 0.4),
	})

	// align colons vertically centered between SC seal (190) and QR code (497)
	const colonX = 280
	const gapAfterColon = 2
	const startY = PAGE_TOP - 20

	let y = startY
	for (const row of fields) {
		const labelWidth = bold.widthOfTextAtSize(row.label, FONT_SIZE)
		const valueText = row.value || "\u2014"
		page.drawText(row.label, {
			x: colonX - labelWidth,
			y,
			size: FONT_SIZE,
			font: bold,
			color: rgb(0, 0, 0),
		})
		page.drawText(valueText, {
			x: colonX + gapAfterColon,
			y,
			size: FONT_SIZE,
			font: regular,
			color: rgb(0, 0, 0),
		})
		y -= LINE_HEIGHT
	}

	// --- Right: QR Code ---
	const verifyUrl = `${publicAppUrl()}/verify/document?code=${verificationCode}`
	const qrPng = await qrcode.toBuffer(verifyUrl, {
		type: "png",
		width: 400,
		margin: 1,
		errorCorrectionLevel: "M",
	})
	const qrImage = await doc.embedPng(qrPng)
	const qrX = pw - 40 - qrSize
	const qrY = PAGE_TOP - qrSize
	page.drawImage(qrImage, {
		x: qrX,
		y: qrY,
		width: qrSize,
		height: qrSize,
	})


	const subject = doc.getSubject() ?? ""
	if (!subject.includes(CERT_PAGE_MARKER)) {
		doc.setSubject(subject ? `${subject} ${CERT_PAGE_MARKER}` : CERT_PAGE_MARKER)
	}

	const finalPdf = Buffer.from(await doc.save())
	const hash = createHash("sha256").update(finalPdf).digest("hex")

	return { pdf: finalPdf, code: verificationCode, hash }
}
