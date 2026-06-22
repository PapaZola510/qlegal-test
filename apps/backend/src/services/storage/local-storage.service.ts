import { Injectable } from "@nestjs/common"
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const STORAGE_ROOT = resolve(process.cwd(), ".storage")

@Injectable()
export class LocalStorageService {
	private async ensureRoot(): Promise<void> {
		await mkdir(STORAGE_ROOT, { recursive: true })
	}

	private pdfPath(uuid: string): string {
		return resolve(STORAGE_ROOT, `${uuid}.pdf`)
	}

	private signatureDir(projectId: string): string {
		return resolve(STORAGE_ROOT, "signatures", projectId)
	}

	private signaturePath(projectId: string, signerEmail: string): string {
		const safeEmail = signerEmail.replace(/[@.]/g, "_")
		return resolve(this.signatureDir(projectId), `${safeEmail}.png`)
	}

	async savePdf(uuid: string, buffer: Buffer): Promise<void> {
		await this.ensureRoot()
		await writeFile(this.pdfPath(uuid), buffer)
	}

	async readPdf(uuid: string): Promise<Buffer> {
		return await readFile(this.pdfPath(uuid))
	}

	async deletePdf(uuid: string): Promise<void> {
		await unlink(this.pdfPath(uuid))
	}

	async saveSignature(projectId: string, signerEmail: string, pngBase64: string): Promise<void> {
		const dir = this.signatureDir(projectId)
		await mkdir(dir, { recursive: true })
		const raw = pngBase64.replace(/^data:image\/png;base64,/, "")
		await writeFile(this.signaturePath(projectId, signerEmail), Buffer.from(raw, "base64"))
	}

	async readSignature(projectId: string, signerEmail: string): Promise<string | null> {
		try {
			const buf = await readFile(this.signaturePath(projectId, signerEmail))
			return `data:image/png;base64,${buf.toString("base64")}`
		} catch {
			return null
		}
	}

	async signatureExists(projectId: string, signerEmail: string): Promise<boolean> {
		try {
			await readFile(this.signaturePath(projectId, signerEmail))
			return true
		} catch {
			return false
		}
	}
}
