import { Logger } from "@nestjs/common"

import { env } from "@/config/env.config"
import {
	isScCommissionStatusBlocked,
	normalizeScCommissionStatus,
} from "@/modules/v1/auth-profile/lib/enp-commission-validation"

const log = new Logger("SupremeCourtClient")

const SC_FETCH_TIMEOUT_MS = 45_000

function scFetchTimeoutSignal(): AbortSignal {
	return AbortSignal.timeout(SC_FETCH_TIMEOUT_MS)
}

export type ScAddress = {
	homeStreet: string
	barangay: string
	cityProvince: string
}

export type ScConsolidatedPayload = {
	notaryFacilityNumber: string
	notaryPublicNumber: string
	rollNumber: string
	metaData: {
		dateNotarized: string
		notarialActType: string
		notarialPageNumber: number
		notarialBookNumber: number
		description: string
		modeOfNotarization: string
		remarks: string
		dateUpdated: string
	}
	listOfPrincipals: Array<{ principalName: string; principalAddress: ScAddress }>
	listOfWitness: Array<{ witnessName: string; witnessAddress: ScAddress }>
}

type TokenCache = { token: string; expiresAtMs: number }

let tokenCache: TokenCache | null = null

export function supremeCourtIsConfigured(): boolean {
	return Boolean(
		env.SUPREME_COURT_API_URL?.trim() &&
		env.SUPREME_COURT_AUTH_URL?.trim() &&
		env.SUPREME_COURT_CLIENT_ID?.trim() &&
		env.SUPREME_COURT_USERNAME?.trim() &&
		env.SUPREME_COURT_PASSWORD?.trim() &&
		env.SUPREME_COURT_NFN?.trim()
	)
}

export function scNormalizeId(value: string | null | undefined, prefix: string): string {
	const v = value?.trim() ?? ""
	if (!v) return v
	if (v.toUpperCase().startsWith(prefix.toUpperCase())) return v
	return `${prefix}${v}`
}

/** Registry / DB act type → SC `notarialActType` (legacy `mapActType`). */
export function mapRegistryActTypeToSc(notarialActType: string): string {
	const key = notarialActType.trim().toLowerCase().replace(/\s+/g, "_")
	const map: Record<string, string> = {
		acknowledgment: "Acknowledgment",
		jurat: "Jurat",
		affidavit: "Jurat",
		oath: "Affirmation",
		oath_affirmation: "Affirmation",
		affirmation: "Affirmation",
		signature_witnessing: "Signature Witnessing",
		certification: "Copy Certification",
		copy_certification: "Copy Certification",
		deed_of_sale: "Acknowledgment",
		special_power_of_attorney: "Acknowledgment",
		general_power_of_attorney: "Acknowledgment",
		protest: "Acknowledgment",
		deposition: "Acknowledgment",
		other: "Acknowledgment",
	}
	return map[key] ?? "Acknowledgment"
}

export function formatScDate(value: Date | string): string {
	const d = value instanceof Date ? value : new Date(value)
	if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
	return d.toISOString().slice(0, 10)
}

/** Split free-text address into SC shape; defaults match legacy `parseAddress`. */
export function parseScAddress(text: string | null | undefined): ScAddress {
	const raw = text?.trim()
	if (!raw) {
		return { homeStreet: "Not specified", barangay: "Not specified", cityProvince: "Not specified" }
	}
	const parts = raw
		.split(",")
		.map(p => p.trim())
		.filter(Boolean)
	if (parts.length >= 3) {
		return {
			homeStreet: parts[0] ?? "Not specified",
			barangay: parts[1] ?? "Not specified",
			cityProvince: parts.slice(2).join(", ") || "Not specified",
		}
	}
	if (parts.length === 2) {
		return {
			homeStreet: parts[0] ?? "Not specified",
			barangay: "Not specified",
			cityProvince: parts[1] ?? "Not specified",
		}
	}
	return {
		homeStreet: raw,
		barangay: "Not specified",
		cityProvince: "Not specified",
	}
}

/** REN / remote → `Remote`; otherwise in-person (legacy). */
export function resolveModeOfNotarization(
	sessionMode?: "remote" | "in_person" | "hybrid" | null
): string {
	if (sessionMode === "remote" || sessionMode === "hybrid") return "Remote"
	if (sessionMode === "in_person") return "In-person"
	return "Remote"
}

export function defaultScAddress(fallbackCity?: string | null): ScAddress {
	return {
		homeStreet: "N/A",
		barangay: "N/A",
		cityProvince: fallbackCity?.trim() || "Philippines",
	}
}

export async function getSupremeCourtAccessToken(): Promise<string> {
	const authUrl = env.SUPREME_COURT_AUTH_URL?.trim()
	const clientId = env.SUPREME_COURT_CLIENT_ID?.trim()
	const username = env.SUPREME_COURT_USERNAME?.trim()
	const password = env.SUPREME_COURT_PASSWORD?.trim()
	if (!authUrl || !clientId || !username || !password) {
		throw new Error("Supreme Court credentials are not configured (SUPREME_COURT_* env vars).")
	}

	const now = Date.now()
	if (tokenCache && now < tokenCache.expiresAtMs - 60_000) {
		return tokenCache.token
	}

	const res = await fetch(authUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-amz-json-1.1",
			"X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
		},
		body: JSON.stringify({
			AuthFlow: "USER_PASSWORD_AUTH",
			ClientId: clientId,
			AuthParameters: { USERNAME: username, PASSWORD: password },
		}),
		signal: scFetchTimeoutSignal(),
	})

	const raw = await res.text()
	let json: Record<string, unknown> = {}
	try {
		json = JSON.parse(raw) as Record<string, unknown>
	} catch {
		throw new Error(`Cognito auth returned non-JSON (${res.status})`)
	}
	if (!res.ok) {
		throw new Error(
			(typeof json.message === "string" && json.message) || `Cognito auth failed (${res.status})`
		)
	}

	const authResult = json.AuthenticationResult as Record<string, unknown> | undefined
	const token = typeof authResult?.AccessToken === "string" ? authResult.AccessToken : ""
	const expiresIn =
		typeof authResult?.ExpiresIn === "number" && authResult.ExpiresIn > 0
			? authResult.ExpiresIn
			: 3600
	if (!token) {
		throw new Error("Cognito response did not include AccessToken")
	}

	tokenCache = { token, expiresAtMs: now + expiresIn * 1000 }
	return token
}

export async function supremeCourtRequest(
	method: "POST" | "GET",
	path: string,
	payload: Record<string, unknown> | undefined,
	token: string
): Promise<Record<string, unknown>> {
	const base = env.SUPREME_COURT_API_URL?.trim()
	if (!base) throw new Error("SUPREME_COURT_API_URL is not set")

	const url = `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
	const res = await fetch(url, {
		method,
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${token}`,
		},
		body: method === "POST" ? JSON.stringify(payload ?? {}) : undefined,
		signal: scFetchTimeoutSignal(),
	})

	const raw = await res.text()
	let json: Record<string, unknown> = {}
	try {
		json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
	} catch {
		if (!res.ok) throw new Error(`SC API ${res.status}: ${raw.slice(0, 400)}`)
		return {}
	}

	if (!res.ok) {
		const msg =
			(typeof json.message === "string" && json.message) ||
			(typeof json.error === "string" && json.error) ||
			raw.slice(0, 400) ||
			`HTTP ${res.status}`
		throw new Error(`SC API ${res.status} on ${path}: ${msg}`)
	}

	return json
}

export type ScCommissionStatusQuery = {
	token: string
	npn: string
	rn: string
}

/** Query SC `/public-use/cs` and return the normalized commission status. */
export async function queryNotaryCommissionStatus(
	args: ScCommissionStatusQuery
): Promise<{ rawStatus: string; normalizedStatus: string }> {
	const resp = await supremeCourtRequest(
		"POST",
		"/public-use/cs",
		{ npn: args.npn, rn: args.rn },
		args.token
	)
	const rawStatus = String(resp.commissionStatus ?? resp.status ?? "").trim() || "unknown"
	return {
		rawStatus,
		normalizedStatus: normalizeScCommissionStatus(rawStatus),
	}
}

function isHardScCommissionError(message: string): boolean {
	const lower = message.toLowerCase()
	return (
		lower.includes("cognito") ||
		lower.includes("accesstoken") ||
		lower.includes("auth failed") ||
		lower.includes("400") ||
		lower.includes("invalid") ||
		(lower.includes("npn") && lower.includes("rn"))
	)
}

/**
 * Commission check — legacy parity: must be Active; invalid NPN/RN throws; transient errors warn and continue.
 */
export async function checkNotaryCommissionStatus(args: ScCommissionStatusQuery): Promise<void> {
	try {
		const { rawStatus, normalizedStatus } = await queryNotaryCommissionStatus(args)
		if (isScCommissionStatusBlocked(normalizedStatus)) {
			throw new Error(
				`Supreme Court reports commission status: ${rawStatus || "Inactive"}. Notarial acts are not allowed.`
			)
		}
		if (normalizedStatus && normalizedStatus !== "active" && normalizedStatus !== "unknown") {
			log.warn(`SC commission status "${rawStatus}" — continuing sync`)
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		if (isHardScCommissionError(msg)) {
			if (
				msg.toLowerCase().includes("400") ||
				msg.toLowerCase().includes("invalid") ||
				(msg.toLowerCase().includes("npn") && msg.toLowerCase().includes("rn"))
			) {
				throw new Error(
					`${msg.slice(0, 400)} Check ENP roll number (RN-…) and commission number (NPN-…) in your profile and SUPREME_COURT_NFN in server config.`
				)
			}
			throw e
		}
		if (msg.includes("Supreme Court reports commission status")) {
			throw e
		}
		log.warn(`SC commission check skipped: ${msg.slice(0, 240)}`)
	}
}

export async function submitConsolidatedNotarialAct(
	payload: ScConsolidatedPayload,
	token: string
): Promise<{ nrid: string; nrn: string }> {
	const resp = await supremeCourtRequest("POST", "/public-use/consolidated", payload, token)
	const nrid =
		(typeof resp.notarialRegistryID === "string" && resp.notarialRegistryID) ||
		(typeof resp.nrid === "string" && resp.nrid) ||
		""
	const nrn =
		(typeof resp.notarialRegistryNumber === "string" && resp.notarialRegistryNumber) ||
		(typeof resp.nrn === "string" && resp.nrn) ||
		""
	if (!nrid) {
		throw new Error(
			`SC API did not return notarialRegistryID. Response: ${JSON.stringify(resp).slice(0, 300)}`
		)
	}
	return { nrid, nrn }
}

export async function uploadNotarialPdfToSupremeCourt(args: {
	token: string
	nrid: string
	/** Legacy API uses NRN for presigned-url and file registration. */
	nrn: string
	pdfBytes: Buffer
	fileName: string
}): Promise<void> {
	const safeName = args.fileName.trim().toLowerCase().endsWith(".pdf")
		? args.fileName.trim()
		: `${args.fileName.trim() || "notarized_document"}.pdf`

	const registryRef = args.nrn.trim() || args.nrid.trim()
	if (!registryRef) {
		throw new Error("NRN or NRID is required for SC PDF upload")
	}

	const psResp = await supremeCourtRequest(
		"POST",
		"/public-use/presigned-url",
		{ nrn: registryRef, nrid: args.nrid, fileName: safeName },
		args.token
	)
	const presignedUrl =
		(typeof psResp.url === "string" && psResp.url) ||
		(typeof psResp.presignedUrl === "string" && psResp.presignedUrl) ||
		(typeof psResp.presigned_url === "string" && psResp.presigned_url) ||
		""
	if (!presignedUrl) {
		throw new Error(
			`SC presigned-url response missing url: ${JSON.stringify(psResp).slice(0, 200)}`
		)
	}

	const putRes = await fetch(presignedUrl, {
		method: "PUT",
		headers: { "Content-Type": "application/pdf" },
		body: new Uint8Array(args.pdfBytes),
		signal: scFetchTimeoutSignal(),
	})
	if (!putRes.ok) {
		throw new Error(`SC S3 PDF upload failed (${putRes.status})`)
	}

	const fileKey =
		(typeof psResp.key === "string" && psResp.key) ||
		(typeof psResp.fileKey === "string" && psResp.fileKey) ||
		(typeof psResp.s3Key === "string" && psResp.s3Key) ||
		""

	const registeredName = (typeof psResp.fileName === "string" && psResp.fileName.trim()) || safeName

	try {
		await supremeCourtRequest(
			"POST",
			"/public-use/file",
			{ nrn: registryRef, fileNames: [registeredName] },
			args.token
		)
	} catch {
		await supremeCourtRequest(
			"POST",
			"/public-use/file",
			{ nrn: registryRef, nrid: args.nrid, fileKey, fileName: safeName },
			args.token
		)
	}
}
