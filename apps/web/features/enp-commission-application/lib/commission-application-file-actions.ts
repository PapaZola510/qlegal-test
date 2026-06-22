import { env } from "@/env"

const apiBase = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")

async function fetchCommissionFileBlob(fileObjectId: string): Promise<Blob> {
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

export async function openCommissionApplicationFile(fileObjectId: string): Promise<void> {
	const newWin = window.open("about:blank", "_blank")
	if (!newWin) {
		throw new Error("Could not open the document. Allow pop-ups for this site and try again.")
	}
	try {
		const blob = await fetchCommissionFileBlob(fileObjectId)
		const url = URL.createObjectURL(blob)
		newWin.location.replace(url)
	} catch (e) {
		newWin.close()
		throw e
	}
}

export async function downloadCommissionApplicationFile(
	fileObjectId: string,
	filename: string
): Promise<void> {
	const blob = await fetchCommissionFileBlob(fileObjectId)
	const url = URL.createObjectURL(blob)
	const safeName =
		filename
			.trim()
			.replace(/[^\w.\-]+/g, "_")
			.slice(0, 200) || "document"
	const anchor = document.createElement("a")
	anchor.href = url
	anchor.download = safeName
	anchor.rel = "noopener"
	document.body.appendChild(anchor)
	anchor.click()
	anchor.remove()
	URL.revokeObjectURL(url)
}
