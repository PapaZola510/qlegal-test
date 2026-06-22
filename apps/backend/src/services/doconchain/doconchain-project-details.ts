/** Parsed snapshot from `GET /api/v2/projects/{uuid}?user_type=ENTERPRISE_API` (registry populate on meeting end). */

export type DoconchainSignerSnapshot = {
	email: string
	firstName: string
	lastName: string
	status: string
	signedAt: Date | null
	sequence: number
	role: string
}

export type DoconchainProjectDetailsSnapshot = {
	projectStatus: string | null
	completedAt: Date | null
	signers: DoconchainSignerSnapshot[]
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
	for (const key of keys) {
		const value = record[key]
		if (typeof value === "string" && value.trim()) return value.trim()
	}
	return null
}

function parseDcTimestamp(value: unknown): Date | null {
	if (value === null || value === undefined) return null
	if (value instanceof Date && !Number.isNaN(value.getTime())) return value
	if (typeof value === "string" || typeof value === "number") {
		const d = new Date(value)
		return Number.isNaN(d.getTime()) ? null : d
	}
	return null
}

function resolveSignersArray(record: Record<string, unknown>): unknown {
	if (Array.isArray(record.signers)) return record.signers

	const nested =
		record.data && typeof record.data === "object" && !Array.isArray(record.data)
			? (record.data as Record<string, unknown>)
			: null
	if (nested && Array.isArray(nested.signers)) return nested.signers

	const raw = record.raw
	if (raw && typeof raw === "object" && !Array.isArray(raw)) {
		const rawData = (raw as Record<string, unknown>).data
		if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
			const inner = (rawData as Record<string, unknown>).signers
			if (Array.isArray(inner)) return inner
		}
	}

	return null
}

function extractProjectDataRecord(parsed: unknown): Record<string, unknown> | null {
	if (!parsed || typeof parsed !== "object") return null
	const envelope = parsed as { data?: unknown }
	const data = envelope.data
	if (data && typeof data === "object" && !Array.isArray(data)) {
		return data as Record<string, unknown>
	}
	if (Array.isArray(data) && data[0] && typeof data[0] === "object" && !Array.isArray(data[0])) {
		return data[0] as Record<string, unknown>
	}
	if (!Array.isArray(parsed)) return parsed as Record<string, unknown>
	return null
}

function normalizeDoconchainSigners(raw: unknown): DoconchainSignerSnapshot[] {
	if (!Array.isArray(raw)) return []
	const out: DoconchainSignerSnapshot[] = []
	for (let i = 0; i < raw.length; i++) {
		const item = raw[i]
		if (!item || typeof item !== "object" || Array.isArray(item)) continue
		const row = item as Record<string, unknown>
		const email = pickString(row, ["email", "signer_email", "signerEmail"])
		if (!email) continue
		const sequenceRaw = row.sequence ?? row.signing_order ?? row.signingOrder
		const sequence =
			typeof sequenceRaw === "number" && Number.isFinite(sequenceRaw) ? sequenceRaw : i + 1
		out.push({
			email,
			firstName: pickString(row, ["first_name", "firstName"]) ?? "",
			lastName: pickString(row, ["last_name", "lastName"]) ?? "",
			status: pickString(row, ["status", "signer_status", "signerStatus"]) ?? "",
			signedAt: parseDcTimestamp(row.signed_at ?? row.signedAt),
			sequence,
			role:
				pickString(row, ["role", "signer_role", "signerRole", "signer_type", "signerType"]) ?? "",
		})
	}
	return out
}

export function parseDoconchainProjectDetailsBody(
	parsed: unknown
): DoconchainProjectDetailsSnapshot | null {
	const record = extractProjectDataRecord(parsed)
	if (!record) return null

	const signers = normalizeDoconchainSigners(resolveSignersArray(record))
	const nested =
		record.data && typeof record.data === "object" && !Array.isArray(record.data)
			? (record.data as Record<string, unknown>)
			: null

	return {
		projectStatus:
			pickString(record, [
				"project_status",
				"projectStatus",
				"status",
				"workflow_status",
				"workflowStatus",
			]) ?? (nested ? pickString(nested, ["project_status", "projectStatus", "status"]) : null),
		completedAt: parseDcTimestamp(
			record.completed_at ?? record.completedAt ?? nested?.completed_at ?? nested?.completedAt
		),
		signers,
	}
}

/** Match legacy populate rules: COMPLETED status, completed_at, or all signers have signed_at (staging). */
export function isDoconchainProjectCompleted(details: DoconchainProjectDetailsSnapshot): boolean {
	const status = (details.projectStatus ?? "").trim().toUpperCase().replace(/\s+/g, "_")
	if (status === "COMPLETED" || status === "COMPLETE") return true
	if (details.completedAt) return true
	if (details.signers.length > 0 && details.signers.every(s => s.signedAt !== null)) return true
	return false
}
