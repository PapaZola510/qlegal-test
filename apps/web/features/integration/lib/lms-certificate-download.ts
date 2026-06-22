import { toast } from "sonner"

import { env } from "@/env"

/** QLearn-issued certificate numbers use this prefix (e.g. QLRN-2026-FBBAA7DB). */
export function isQlearnCertificateId(certificateId?: string | null): boolean {
	return Boolean(certificateId?.trim().toUpperCase().startsWith("QLRN-"))
}

/** True when qLegal invented the id locally — not from QLearn certificates/query. */
export function isLocallyGeneratedCertificateId(certificateId?: string | null): boolean {
	if (!certificateId?.trim()) return false
	const id = certificateId.trim().toUpperCase()
	return id.startsWith("QL-ENP-") || id.startsWith("QL-LMS-")
}

/** True when the QLearn certificate proxy download should be offered. */
export function isLmsCertificateDownloadAvailable(certificateId?: string | null): boolean {
	if (env.NEXT_PUBLIC_ENABLE_LMS_INTEGRATION === "true") return true
	return isQlearnCertificateId(certificateId)
}

export function lmsCertificateDownloadHref(asAttachment = true): string {
	const base = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
	const path = `${base}/v1/integration/lms/training/certificate/download`
	return asAttachment ? `${path}?download=1` : path
}

export async function fetchLmsCertificatePdf(): Promise<{ blob: Blob; filename: string }> {
	const url = lmsCertificateDownloadHref(true)
	const res = await fetch(url, { credentials: "include" })
	if (!res.ok) {
		let message = `Download failed (${res.status})`
		try {
			const json = (await res.json()) as { message?: string }
			if (json.message?.trim()) message = json.message.trim()
		} catch {
			const text = await res.text().catch(() => "")
			if (text.trim()) message = text.trim().slice(0, 240)
		}
		throw new Error(message)
	}

	const blob = await res.blob()
	if (blob.size < 256) {
		throw new Error("Certificate file is empty or not ready yet.")
	}

	const disposition = res.headers.get("content-disposition") ?? ""
	const match = /filename="?([^";]+)"?/i.exec(disposition)
	const filename = match?.[1] ?? "qlearn-certificate.pdf"
	return { blob, filename }
}

/** Download QLearn certificate PDF via qLegal proxy (session cookie + integration API key). */
export async function downloadLmsCertificate(): Promise<void> {
	try {
		const { blob, filename } = await fetchLmsCertificatePdf()
		const blobUrl = URL.createObjectURL(blob)
		const anchor = document.createElement("a")
		anchor.href = blobUrl
		anchor.download = filename
		anchor.rel = "noopener"
		document.body.appendChild(anchor)
		anchor.click()
		anchor.remove()
		URL.revokeObjectURL(blobUrl)
		toast.success("Certificate downloaded")
	} catch (e) {
		toast.error(e instanceof Error ? e.message : "Could not download certificate")
	}
}
