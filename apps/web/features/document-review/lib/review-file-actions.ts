import { env } from "@/env"

const apiBase = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")

async function fetchReviewFileBlob(fileObjectId: string): Promise<Blob> {
	const res = await fetch(`${apiBase}/v1/files/${encodeURIComponent(fileObjectId)}`, {
		credentials: "include",
	})
	if (!res.ok) {
		let message = `Could not load document (${res.status})`
		try {
			const json = (await res.json()) as {
				error?: { message?: string }
				message?: string
			}
			const m = json?.error?.message ?? json?.message
			if (typeof m === "string" && m.trim()) message = m.trim()
		} catch {
			/* not JSON */
		}
		throw new Error(message)
	}
	return res.blob()
}

/**
 * Open the review request's document inline in a new browser tab (PDFs render natively).
 *
 * The placeholder tab is opened synchronously so the user-gesture is preserved
 * across the fetch (popup blockers otherwise treat the post-`await` window.open
 * as a programmatic popup). `noopener` is omitted intentionally — with it set,
 * window.open returns null even on success, which makes blocker detection
 * impossible; the rendered content is a PDF so there is no opener-exploit risk.
 */
export async function openReviewFile(fileObjectId: string): Promise<void> {
	const newWin = window.open("about:blank", "_blank")
	if (!newWin) {
		throw new Error("Could not open the document. Allow pop-ups for this site and try again.")
	}
	try {
		const blob = await fetchReviewFileBlob(fileObjectId)
		const url = URL.createObjectURL(blob)
		newWin.location.replace(url)
	} catch (e) {
		newWin.close()
		throw e
	}
}

/** Trigger a browser download for the review request's document with a sensible filename. */
export async function downloadReviewFile(fileObjectId: string, filename: string): Promise<void> {
	const blob = await fetchReviewFileBlob(fileObjectId)
	const url = URL.createObjectURL(blob)
	const safeName = sanitizeFilename(filename)
	const anchor = document.createElement("a")
	anchor.href = url
	anchor.download = safeName
	anchor.rel = "noopener"
	document.body.appendChild(anchor)
	anchor.click()
	anchor.remove()
	URL.revokeObjectURL(url)
}

function sanitizeFilename(name: string): string {
	const trimmed = name.trim() || "document"
	const safe = trimmed.replace(/[^\w.\-]+/g, "_").slice(0, 200)
	return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`
}
