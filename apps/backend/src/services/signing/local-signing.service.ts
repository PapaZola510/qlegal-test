import { Injectable, Logger } from "@nestjs/common"
import { PDFDocument } from "pdf-lib"
import { eq } from "drizzle-orm"

import { db } from "@/common/database/database.client"
import { quicksignProjects } from "@repo/db/schema"
import { LocalStorageService } from "@/services/storage/local-storage.service"

@Injectable()
export class LocalSigningService {
	private readonly log = new Logger(LocalSigningService.name)

	constructor(private readonly localStorageService: LocalStorageService) {}

	async stampSignature(
		projectUuid: string,
		signerEmail: string,
		signaturePngBase64: string
	): Promise<void> {
		const [row] = await db
			.select({ signatureFields: quicksignProjects.signatureFields })
			.from(quicksignProjects)
			.where(eq(quicksignProjects.id, projectUuid))
			.limit(1)

		if (!row) {
			throw new Error(`Project ${projectUuid} not found`)
		}

		const fields = row.signatureFields ?? []
		const field = fields.find(f => f.signerEmail === signerEmail)
		if (!field) {
			throw new Error(
				`No signature field found for signer ${signerEmail} in project ${projectUuid}`
			)
		}

		const pdf = await this.localStorageService.readPdf(projectUuid)
		const doc = await PDFDocument.load(pdf, { ignoreEncryption: true })

		const raw = signaturePngBase64.replace(/^data:image\/png;base64,/, "")
		const pngBytes = Buffer.from(raw, "base64")
		const pngImage = await doc.embedPng(pngBytes)

		const pages = doc.getPages()
		const page = pages[field.pageIndex]
		if (!page) {
			throw new Error(
				`Page index ${field.pageIndex} out of bounds (document has ${pages.length} pages)`
			)
		}

		page.drawImage(pngImage, {
			x: field.x,
			y: field.y,
			width: field.width,
			height: field.height,
		})

		const updated = Buffer.from(await doc.save())
		await this.localStorageService.savePdf(projectUuid, updated)

		this.log.debug(`Signature stamped for ${signerEmail} on project …${projectUuid.slice(-12)}`)
	}
}
