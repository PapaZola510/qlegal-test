/** DocOnChain verify API wraps payload in `{ message, data: { status, … } }`. */
export function parseDoconchainVerifyEnvelope(json: Record<string, unknown>): {
	status: string
	data: Record<string, unknown> | null
	message: string | null
} {
	const data =
		json.data && typeof json.data === "object" && !Array.isArray(json.data)
			? (json.data as Record<string, unknown>)
			: null
	const status =
		(typeof data?.status === "string" && data.status.trim()) ||
		(typeof json.status === "string" && json.status.trim()) ||
		""
	const message =
		(typeof json.message === "string" && json.message.trim()) ||
		(typeof data?.message === "string" && String(data.message).trim()) ||
		null
	return { status, data, message }
}

/** Staging returns `SUCCEED`; docs/examples use `verified`. */
export function isDoconchainVerifySuccessStatus(status: string): boolean {
	const n = status.trim().toUpperCase().replace(/\s+/g, "_")
	return (
		n === "VERIFIED" ||
		n === "VERIFY" ||
		n === "SUCCESS" ||
		n === "SUCCEED" ||
		n === "SUCCEEDED" ||
		n === "OK"
	)
}

/** Decode embedded PDF (base64) from DocOnChain JSON payloads. */
export function extractPdfBufferFromDoconchainPayload(value: unknown): Buffer | null {
	const seen = new Set<unknown>()
	const b64Keys = [
		"pdf",
		"pdf_base64",
		"pdfBase64",
		"file",
		"file_base64",
		"content",
		"certificate",
		"certificate_pdf",
		"certificatePdf",
		"document",
	]

	const walk = (node: unknown): Buffer | null => {
		if (node === null || node === undefined) return null
		if (typeof node === "string") {
			const s = node.trim()
			if (s.startsWith("%PDF") && s.length > 100) {
				return Buffer.from(s, "utf8")
			}
			if (s.length > 200 && /^[A-Za-z0-9+/=\r\n]+$/.test(s.slice(0, 200))) {
				try {
					const buf = Buffer.from(s.replace(/\s+/g, ""), "base64")
					if (buf.length >= 5 && buf.subarray(0, 4).toString("ascii") === "%PDF") return buf
				} catch {
					/* ignore */
				}
			}
			return null
		}
		if (typeof node !== "object") return null
		if (seen.has(node)) return null
		seen.add(node)
		if (Array.isArray(node)) {
			for (const item of node) {
				const hit = walk(item)
				if (hit) return hit
			}
			return null
		}
		const obj = node as Record<string, unknown>
		for (const key of b64Keys) {
			const raw = obj[key]
			if (typeof raw === "string") {
				const hit = walk(raw)
				if (hit) return hit
			}
		}
		for (const v of Object.values(obj)) {
			const hit = walk(v)
			if (hit) return hit
		}
		return null
	}

	return walk(value)
}

/** First HTTPS URL in a passport API response (prefers PDF / certificate links). */
export function extractHttpsUrlFromPassportPayload(value: unknown): string | null {
	const urls: string[] = []
	const seen = new Set<unknown>()

	const walk = (node: unknown): void => {
		if (node === null || node === undefined) return
		if (typeof node === "string") {
			const s = node.trim()
			if (/^https?:\/\//i.test(s)) urls.push(s)
			return
		}
		if (typeof node !== "object") return
		if (seen.has(node)) return
		seen.add(node)
		if (Array.isArray(node)) {
			for (const item of node) walk(item)
			return
		}
		const obj = node as Record<string, unknown>
		const priorityKeys = [
			"certificate_url",
			"certificateUrl",
			"pdf_url",
			"pdfUrl",
			"download_url",
			"downloadUrl",
			"url",
			"link",
			"href",
		]
		for (const key of priorityKeys) {
			const raw = obj[key]
			if (typeof raw === "string" && /^https?:\/\//i.test(raw.trim())) {
				urls.unshift(raw.trim())
			}
		}
		for (const v of Object.values(obj)) walk(v)
	}

	walk(value)
	const prefer =
		urls.find(u => /\.pdf(\?|$)/i.test(u) || /certificate|passport|completion/i.test(u)) ?? urls[0]
	return prefer?.trim() || null
}

/** DOC Verify code from DocOnChain vault / project payloads (e.g. `DCMMKVRK737H6H` on sealed PDF or QR). */
export function extractDoconchainDocumentCode(row: Record<string, unknown>): string | null {
	const keys = [
		"code",
		"document_code",
		"documentCode",
		"doc_code",
		"verify_code",
		"verification_code",
		"reference_number",
		"referenceNumber",
	]
	for (const key of keys) {
		const raw = row[key]
		if (typeof raw !== "string") continue
		const trimmed = raw.trim()
		if (trimmed.length < 6 || trimmed.length > 64) continue
		if (trimmed.startsWith("http")) continue
		return trimmed
	}
	return null
}
