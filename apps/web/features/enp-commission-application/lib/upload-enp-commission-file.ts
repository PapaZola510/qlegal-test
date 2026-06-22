import { env } from "@/env"

const MAX_BYTES = 20 * 1024 * 1024

export function validateCommissionApplicationFile(file: File): string | null {
	const mime = file.type.toLowerCase()
	const allowed =
		mime === "application/pdf" ||
		mime.startsWith("image/") ||
		mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	if (!allowed) {
		return "Upload a PDF, image, or Word document."
	}
	if (file.size > MAX_BYTES) {
		return "File must be 20MB or smaller."
	}
	if (file.size <= 0) {
		return "File is empty."
	}
	return null
}

async function readUploadErrorMessage(res: Response): Promise<string> {
	try {
		const body = (await res.json()) as {
			message?: string | string[]
			error?: { message?: string | string[] }
		}
		const nested = body.error?.message
		if (typeof nested === "string" && nested.trim()) return nested.trim()
		if (Array.isArray(nested) && nested.length > 0) return nested.join(", ")
		if (typeof body.message === "string" && body.message.trim()) return body.message.trim()
		if (Array.isArray(body.message) && body.message.length > 0) return body.message.join(", ")
	} catch {
		/* ignore */
	}
	return `Upload failed (${res.status})`
}

/** Uploads commission application attachments using the documents bucket. */
export async function uploadEnpCommissionApplicationFile(args: {
	file: File
	subOrgId: string
}): Promise<{ fileObjectId: string }> {
	const err = validateCommissionApplicationFile(args.file)
	if (err) throw new Error(err)

	const form = new FormData()
	form.append("file", args.file)
	form.append("bucket", "qlegal-documents")
	form.append("purpose", "commission_application")
	form.append("sub_org_id", args.subOrgId)

	const base = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
	const url = `${base}/v1/files?sub_org_id=${encodeURIComponent(args.subOrgId)}`
	const res = await fetch(url, {
		method: "POST",
		body: form,
		credentials: "include",
	})

	if (!res.ok) {
		throw new Error(await readUploadErrorMessage(res))
	}

	const data = (await res.json()) as { fileObjectId?: string }
	if (!data.fileObjectId) {
		throw new Error("Upload succeeded but no file id was returned")
	}
	return { fileObjectId: data.fileObjectId }
}
