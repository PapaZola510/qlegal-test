import { env } from "@/env"

const MAX_BYTES = 20 * 1024 * 1024

/** Keep in sync with `SESSION_RECORDING_MAX_BYTES` in apps/backend file-buckets.ts */
const MAX_RECORDING_BYTES = 4 * 1024 * 1024 * 1024

export function validateMeetingDocumentFile(file: File): string | null {
	const mime = file.type.toLowerCase()
	if (mime !== "application/pdf") {
		return "Only PDF files are allowed (required for signing)."
	}
	if (file.size > MAX_BYTES) {
		return "File must be 20MB or smaller."
	}
	if (file.size <= 0) {
		return "File is empty."
	}
	return null
}

function formatUploadMiB(bytes: number): string {
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
		/* ignore parse errors */
	}
	return `Upload failed (${res.status})`
}

function normalizeRecordingFileType(blob: Blob, filename: string): string {
	const raw = (blob.type ?? "").trim().toLowerCase()
	const base = raw.split(";")[0]?.trim() ?? ""
	if (base.startsWith("video/") || base.startsWith("audio/")) return base
	if (base === "application/webm") return "video/webm"
	if (filename.toLowerCase().endsWith(".mp4")) return "video/mp4"
	return "video/webm"
}

export async function uploadAppointmentAttachmentFile(args: {
	file: File
	subOrgId: string
}): Promise<{ fileObjectId: string }> {
	const err = validateMeetingDocumentFile(args.file)
	if (err) throw new Error(err)

	const form = new FormData()
	form.append("file", args.file)
	form.append("bucket", "qlegal-documents")
	form.append("purpose", "appointment_attachment")
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

export async function uploadMeetingRecordingFile(args: {
	file: File
	appointmentId: string
	fileName: string
}): Promise<unknown> {
	const mimeType = normalizeRecordingFileType(args.file, args.fileName)
	if (!mimeType.startsWith("video/") && !mimeType.startsWith("audio/")) {
		throw new Error("Only video recording files are allowed.")
	}
	if (args.file.size <= 0) {
		throw new Error("Recording file is empty.")
	}
	if (args.file.size > MAX_RECORDING_BYTES) {
		const maxGb = (MAX_RECORDING_BYTES / (1024 * 1024 * 1024)).toFixed(0)
		throw new Error(
			`Recording is too large (${formatUploadMiB(args.file.size)}). Maximum size is ${maxGb} GB — try a shorter capture or lower screen resolution.`
		)
	}

	const uploadFile =
		args.file.type === mimeType
			? args.file
			: new File([args.file], args.fileName, {
					type: mimeType,
					lastModified: args.file.lastModified,
				})

	const form = new FormData()
	form.append("file", uploadFile, args.fileName)
	form.append("file_name", args.fileName)

	const base = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
	const url = `${base}/v1/appointments/${encodeURIComponent(args.appointmentId)}/meeting-recordings/upload`
	const res = await fetch(url, {
		method: "POST",
		body: form,
		credentials: "include",
	})

	if (!res.ok) {
		throw new Error(await readUploadErrorMessage(res))
	}

	return (await res.json()) as unknown
}

/**
 * Upload a document-review attachment for a specific notary. Clients use this
 * to attach files without needing a sub-org on their own profile — the server
 * places the file under the picked notary's sub-org.
 */
export async function uploadDocumentReviewFile(args: {
	file: File
	notaryId: string
}): Promise<{ fileObjectId: string }> {
	const err = validateMeetingDocumentFile(args.file)
	if (err) throw new Error(err)

	const form = new FormData()
	form.append("file", args.file)
	form.append("notary_id", args.notaryId)

	const base = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
	const url = `${base}/v1/files/for-notary`
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

/**
 * Principal/client upload helper. Hits the appointment-scoped endpoint that
 * uploads the file into the ENP's sub-org without provisioning a 
 * project — the ENP creates the signing project from the document card.
 */
export async function uploadPrincipalMeetingDocumentFile(args: {
	file: File
	appointmentId: string
	documentName: string
	documentType: string
	enpDocumentTypeId?: string
}): Promise<unknown> {
	const err = validateMeetingDocumentFile(args.file)
	if (err) throw new Error(err)

	const form = new FormData()
	form.append("file", args.file)
	form.append("document_name", args.documentName)
	form.append("document_type", args.documentType)
	if (args.enpDocumentTypeId) {
		form.append("enp_document_type_id", args.enpDocumentTypeId)
	}

	const base = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
	const url = `${base}/v1/appointments/${encodeURIComponent(
		args.appointmentId
	)}/meeting-documents/principal-upload`
	const res = await fetch(url, {
		method: "POST",
		body: form,
		credentials: "include",
	})

	if (!res.ok) {
		throw new Error(await readUploadErrorMessage(res))
	}

	return (await res.json()) as unknown
}
