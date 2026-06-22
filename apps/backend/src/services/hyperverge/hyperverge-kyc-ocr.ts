import type { HyperVergeLogsApiResponse } from "./hyperverge-kyc-logs.service"

const EXPIRY_FIELD_KEYS = [
	"expiryDate",
	"expiry_date",
	"expirationDate",
	"expiration_date",
	"dateOfExpiration",
	"date_of_expiration",
	"validUntil",
	"valid_until",
	"validUpto",
	"valid_upto",
	"dateOfExpiry",
	"date_of_expiry",
	"dateExpiry",
	"date_expiry",
	"licenseExpiry",
	"license_expiry",
	"dlExpiry",
	"dl_expiry",
] as const

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v)

function normalizeFieldName(field: string): string {
	return field.toLowerCase().replace(/[_\s-]/g, "")
}

const NORMALIZED_EXPIRY_KEYS = new Set(EXPIRY_FIELD_KEYS.map(normalizeFieldName))

function extractOcrValue(fieldValue: unknown): string | undefined {
	if (typeof fieldValue === "string" && fieldValue.trim()) {
		return fieldValue.trim()
	}
	if (fieldValue && typeof fieldValue === "object" && "value" in fieldValue) {
		const nested = (fieldValue as { value: unknown }).value
		if (typeof nested === "string" && nested.trim()) {
			return nested.trim()
		}
	}
	return undefined
}

function extractFieldFromOcr(
	ocrData: Record<string, unknown>,
	fieldVariations: readonly string[]
): string | undefined {
	for (const variation of fieldVariations) {
		if (variation in ocrData) {
			const extracted = extractOcrValue(ocrData[variation])
			if (extracted) return extracted
		}
	}

	const normalizedOcrData = new Map<string, unknown>()
	for (const [key, value] of Object.entries(ocrData)) {
		normalizedOcrData.set(normalizeFieldName(key), value)
	}

	for (const variation of fieldVariations) {
		const normalized = normalizeFieldName(variation)
		if (normalizedOcrData.has(normalized)) {
			const extracted = extractOcrValue(normalizedOcrData.get(normalized))
			if (extracted) return extracted
		}
	}

	return undefined
}

/** Normalize OCR expiry strings to `YYYY-MM-DD` for profile storage. */
export function normalizeExpiryToYmd(raw: string): string | null {
	const trimmed = raw.trim()
	if (!trimmed) return null

	if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
		const ymd = trimmed.slice(0, 10)
		const [y, m, d] = ymd.split("-").map(Number)
		if (
			y !== undefined &&
			m !== undefined &&
			d !== undefined &&
			y > 0 &&
			m >= 1 &&
			m <= 12 &&
			d >= 1 &&
			d <= 31
		) {
			return ymd
		}
		return null
	}

	const dashMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(trimmed)
	if (dashMatch) {
		const a = Number(dashMatch[1])
		const b = Number(dashMatch[2])
		const year = Number(dashMatch[3])
		if (!year || year < 1900 || year > 2100) return null
		let month: number
		let day: number
		if (a > 12) {
			day = a
			month = b
		} else if (b > 12) {
			month = a
			day = b
		} else {
			month = a
			day = b
		}
		if (month < 1 || month > 12 || day < 1 || day > 31) return null
		return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
	}

	const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)
	if (slashMatch) {
		const a = Number(slashMatch[1])
		const b = Number(slashMatch[2])
		const year = Number(slashMatch[3])
		if (!year || year < 1900 || year > 2100) return null
		let month: number
		let day: number
		if (a > 12) {
			day = a
			month = b
		} else if (b > 12) {
			month = a
			day = b
		} else {
			month = a
			day = b
		}
		if (month < 1 || month > 12 || day < 1 || day > 31) return null
		return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
	}

	return null
}

function isExpiryFieldKey(key: string): boolean {
	return NORMALIZED_EXPIRY_KEYS.has(normalizeFieldName(key))
}

function expiryFromKeyValueEntry(entry: Record<string, unknown>): string | null {
	const name = entry.fieldName ?? entry.name ?? entry.key ?? entry.label ?? entry.field
	if (typeof name !== "string" || !isExpiryFieldKey(name)) return null
	const raw = extractOcrValue(entry.value ?? entry.fieldValue ?? entry.text)
	if (!raw) return null
	return normalizeExpiryToYmd(raw)
}

/** Deep-scan HyperVerge payload for any expiry-like field (fallback when module OCR shape differs). */
export function findExpiryDateInNode(node: unknown): string | null {
	const maxDepth = 10
	const maxNodes = 2000
	let visited = 0

	const walk = (n: unknown, depth: number): string | null => {
		if (visited++ > maxNodes || depth > maxDepth) return null

		if (Array.isArray(n)) {
			for (const item of n) {
				if (isRecord(item)) {
					const fromKv = expiryFromKeyValueEntry(item)
					if (fromKv) return fromKv
				}
				const found = walk(item, depth + 1)
				if (found) return found
			}
			return null
		}

		if (!isRecord(n)) return null

		for (const [key, value] of Object.entries(n)) {
			if (isExpiryFieldKey(key)) {
				const raw = extractOcrValue(value)
				if (raw) {
					const ymd = normalizeExpiryToYmd(raw)
					if (ymd) return ymd
				}
			}
		}

		for (const value of Object.values(n)) {
			const found = walk(value, depth + 1)
			if (found) return found
		}

		return null
	}

	return walk(node, 0)
}

export function extractExpiryDateFromOcr(ocr: Record<string, unknown>): string | null {
	const raw = extractFieldFromOcr(ocr, EXPIRY_FIELD_KEYS)
	if (!raw) return findExpiryDateInNode(ocr)
	return normalizeExpiryToYmd(raw)
}

/** Parse expiry from Logs API response (module OCR + deep fallback). */
export function extractExpiryDateFromLogs(logs: HyperVergeLogsApiResponse): string | null {
	const ocr = pickOcrFieldsFromLogs(logs)
	if (ocr) {
		const fromOcr = extractExpiryDateFromOcr(ocr)
		if (fromOcr) return fromOcr
	}
	return findExpiryDateInNode(logs)
}

const keyMatches = (value: unknown, needle: string): boolean =>
	typeof value === "string" && value.toLowerCase().includes(needle)

function findOcrFieldsDeep(node: unknown): Record<string, unknown> | null {
	const maxDepth = 8
	const maxNodes = 1200
	let visited = 0

	const walk = (n: unknown, depth: number): Record<string, unknown> | null => {
		if (visited++ > maxNodes || depth > maxDepth) return null

		if (isRecord(n)) {
			for (const [k, v] of Object.entries(n)) {
				const key = k.toLowerCase()
				if (
					key === "fieldsextracted" ||
					key === "fields_extracted" ||
					key === "extractedfields" ||
					key === "ocrfields" ||
					key === "extracted"
				) {
					if (isRecord(v)) return v
				}
				const found = walk(v, depth + 1)
				if (found) return found
			}
		} else if (Array.isArray(n)) {
			for (const item of n) {
				const found = walk(item, depth + 1)
				if (found) return found
			}
		}
		return null
	}

	return walk(node, 0)
}

/** Extract ID OCR fields from HyperVerge Logs API response (link-kyc/results). */
export function pickOcrFieldsFromLogs(
	logs: HyperVergeLogsApiResponse
): Record<string, unknown> | null {
	const result = logs.result
	if (!isRecord(result)) return null

	const results = result.results
	if (!Array.isArray(results)) return findOcrFieldsDeep(result)

	for (const entry of results) {
		if (!isRecord(entry)) continue
		const moduleName = entry.module
		const moduleId = entry.moduleId

		const looksLikeIdValidation =
			keyMatches(moduleName, "id") ||
			keyMatches(moduleName, "ocr") ||
			keyMatches(moduleName, "id card") ||
			keyMatches(moduleName, "document") ||
			keyMatches(moduleName, "license") ||
			keyMatches(moduleName, "passport") ||
			keyMatches(moduleName, "card") ||
			keyMatches(moduleId, "id") ||
			keyMatches(moduleId, "ocr") ||
			keyMatches(moduleId, "document") ||
			keyMatches(moduleId, "license")

		if (!looksLikeIdValidation) continue

		const fields = findOcrFieldsDeep(entry)
		if (fields) return fields
	}

	return findOcrFieldsDeep(results)
}
