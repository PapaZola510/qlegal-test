import { validateMeetingDocumentFile } from "@/features/appointments/lib/upload-appointment-file"
import { env } from "@/env"

export async function uploadQuicksignOriginalFile(args: {
	file: File
	subOrgId: string
}): Promise<{ fileObjectId: string }> {
	const err = validateMeetingDocumentFile(args.file)
	if (err) throw new Error(err)

	const form = new FormData()
	form.append("file", args.file)
	form.append("bucket", "qlegal-documents")
	form.append("purpose", "qs_original")
	form.append("sub_org_id", args.subOrgId)

	const base = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
	const url = `${base}/v1/files?sub_org_id=${encodeURIComponent(args.subOrgId)}`
	const res = await fetch(url, {
		method: "POST",
		body: form,
		credentials: "include",
	})

	if (!res.ok) {
		let message = "Upload failed"
		try {
			const body = (await res.json()) as { message?: string | string[] }
			if (typeof body.message === "string") message = body.message
			else if (Array.isArray(body.message)) message = body.message.join(", ")
		} catch {
			/* ignore parse errors */
		}
		throw new Error(message)
	}

	const data = (await res.json()) as { fileObjectId?: string }
	if (!data.fileObjectId) {
		throw new Error("Upload succeeded but no file id was returned")
	}
	return { fileObjectId: data.fileObjectId }
}
