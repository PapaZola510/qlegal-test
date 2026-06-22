import { extractHttpsUrlFromPassportPayload } from "./doconchain-vault-document-code.js"

function unwrapDoconchainDataEnvelope(json: unknown): Record<string, unknown> | null {
	if (!json || typeof json !== "object") return null
	const root = json as Record<string, unknown>
	if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
		return root.data as Record<string, unknown>
	}
	return root
}

function readStringField(obj: Record<string, unknown>, keys: string[]): string | null {
	for (const key of keys) {
		const raw = obj[key]
		if (typeof raw === "string" && raw.trim()) return raw.trim()
	}
	return null
}

export type DoconchainVerificationSigner = {
	name: string
	email: string
	role: string | null
	status: string
	signedAt: string | null
}

/** Parsed `GET /api/v2/verifications/:uuid` (Show Verification). */
export type DoconchainVerificationDetails = {
	verificationUuid: string | null
	/** Project UUID for `GET /projects/:uuid/passport` (from `data.project.uuid`). */
	projectUuid: string | null
	status: string | null
	documentName: string | null
	verificationDate: string | null
	projectName: string | null
	projectReferenceNumber: string | null
	signers: DoconchainVerificationSigner[]
}

function normalizeSigners(raw: unknown): DoconchainVerificationSigner[] {
	if (!Array.isArray(raw)) return []
	const out: DoconchainVerificationSigner[] = []
	for (const item of raw) {
		if (!item || typeof item !== "object" || Array.isArray(item)) continue
		const row = item as Record<string, unknown>
		const email = readStringField(row, ["email"])
		if (!email) continue
		const first = readStringField(row, ["first_name", "firstName"]) ?? ""
		const last = readStringField(row, ["last_name", "lastName"]) ?? ""
		const name = [first, last].filter(Boolean).join(" ").trim() || email
		out.push({
			name,
			email,
			role: readStringField(row, ["role", "signer_role", "project_role"]),
			status: readStringField(row, ["status"]) ?? "—",
			signedAt: readStringField(row, ["signed_at", "signedAt"]),
		})
	}
	return out
}

export function parseDoconchainVerificationDetails(json: unknown): DoconchainVerificationDetails {
	const root = unwrapDoconchainDataEnvelope(json) ?? {}
	const project =
		root.project && typeof root.project === "object" && !Array.isArray(root.project)
			? (root.project as Record<string, unknown>)
			: null
	const inner =
		root.data && typeof root.data === "object" && !Array.isArray(root.data)
			? (root.data as Record<string, unknown>)
			: null

	const projectUuid =
		(project ? readStringField(project, ["uuid", "project_uuid", "projectUuid"]) : null) ||
		readStringField(root, ["project_uuid", "projectUuid"])

	return {
		verificationUuid: readStringField(root, ["uuid", "verification_uuid", "verificationUuid"]),
		projectUuid,
		status: readStringField(root, ["status"]),
		documentName: readStringField(root, ["name", "file_name", "fileName"]),
		verificationDate: readStringField(root, [
			"verification_date",
			"verificationDate",
			"verification_date_timestamp",
		]),
		projectName: project ? readStringField(project, ["name"]) : null,
		projectReferenceNumber: project
			? readStringField(project, ["reference_number", "referenceNumber"])
			: null,
		signers: normalizeSigners(inner?.signers),
	}
}

/** `GET /projects/:uuid/passport?view=certificate_url` → `data.certificate_url`. */
export function parseDoconchainPassportCertificateUrl(json: unknown): string | null {
	if (!json || typeof json !== "object") return null
	const root = json as Record<string, unknown>
	const data =
		root.data && typeof root.data === "object" && !Array.isArray(root.data)
			? (root.data as Record<string, unknown>)
			: root
	const direct = readStringField(data, ["certificate_url", "certificateUrl"])
	if (direct?.startsWith("http")) return direct
	return extractHttpsUrlFromPassportPayload(json)
}
