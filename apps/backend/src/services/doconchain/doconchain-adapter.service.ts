import { Injectable, Logger } from "@nestjs/common"
import { createHash, randomUUID } from "node:crypto"
import type { Response as ExpressResponse } from "express"

import { doconchainDevMockOnFailure, doconchainOrgEmailFallback, env } from "@/config/env.config"
import { looksLikePdfMissingDoconchainNotarialSeal } from "@/utils/doconchain-sealed-pdf-heuristic"

import { parseDoconchainUserUuidFromToken } from "./doconchain-jwt.util.js"
import {
	parseDoconchainProjectDetailsBody,
	type DoconchainProjectDetailsSnapshot,	
} from "./doconchain-project-details.js"
import {
	extractDoconchainDocumentCode,
	extractHttpsUrlFromPassportPayload,
	extractPdfBufferFromDoconchainPayload,
	isDoconchainVerifySuccessStatus,
	parseDoconchainVerifyEnvelope,
} from "./doconchain-vault-document-code.js"
import {
	parseDoconchainPassportCertificateUrl,
	parseDoconchainVerificationDetails,
	type DoconchainVerificationDetails,
} from "./doconchain-verification-details.js"
import {
	deleteNotarizedPdfBytesCache,
	readNotarizedPdfBytesCache,
	writeNotarizedPdfBytesCache,
} from "./notarized-pdf-bytes-cache.js"

export type { DoconchainProjectDetailsSnapshot } from "./doconchain-project-details.js"
export { isDoconchainProjectCompleted } from "./doconchain-project-details.js"

interface TokenCacheEntry {
	token: string
	expiresAtMs: number
}

function parseJwtExpMs(token: string): number | null {
	const parts = token.split(".")
	if (parts.length < 2) return null
	try {
		const pad = parts[1]!.replace(/-/g, "+").replace(/_/g, "/")
		const json = Buffer.from(pad + "==".slice((pad.length + 3) % 4), "base64").toString("utf8")
		const payload = JSON.parse(json) as { exp?: number }
		if (typeof payload.exp === "number") return payload.exp * 1000
	} catch {
		return null
	}
	return null
}

function buildMultipartBody(
	boundary: string,
	fields: Record<string, string>,
	files?: Record<string, { filename: string; contentType: string; data: Buffer }>
): Buffer {
	const chunks: Buffer[] = []
	for (const [k, v] of Object.entries(fields)) {
		chunks.push(
			Buffer.from(
				`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
				"utf8"
			)
		)
	}
	if (files) {
		for (const [k, f] of Object.entries(files)) {
			const head = Buffer.from(
				`--${boundary}\r\nContent-Disposition: form-data; name="${k}"; filename="${f.filename}"\r\nContent-Type: ${f.contentType}\r\n\r\n`,
				"utf8"
			)
			chunks.push(head, f.data, Buffer.from("\r\n", "utf8"))
		}
	}
	chunks.push(Buffer.from(`--${boundary}--\r\n`, "utf8"))
	return Buffer.concat(chunks)
}

/**
 * Outcome of DocOnChain vault / sealed-PDF resolution (registry + operators).
 * On success, `doconchainProjectUuid` is always the **create-project** id (`POST /api/v2/projects` → `data.uuid`), i.e. what you persist as `quicksign_projects.doconchainProjectUuid` — never the vault list row’s own `uuid`.
 */
type DcDownloadProbeEntry = { status: number; method: string; url: string; snippet: string }

/** Last failing vault/project download probe; split so logs show host-root vs `/api/v2` mounts separately. */
type DcDownloadProbeDiag = {
	last?: DcDownloadProbeEntry
	lastHostMount?: DcDownloadProbeEntry
	lastApiV2Mount?: DcDownloadProbeEntry
}

export type DoconchainVaultPdfOutcome =
	| { outcome: "ok"; signedPdfUrl: string; doconchainProjectUuid: string }
	| { outcome: "unauthorized"; httpStatus: number; detail: string }
	| { outcome: "still_sealing"; detail: string }
	| { outcome: "stored_uuid_mismatches_vault_project"; detail: string }
	| { outcome: "ready_but_no_download_url"; detail: string; keySample: string }
	| { outcome: "vault_item_not_found"; detail: string }

/** DocOnChain “Get Projects In Vault”: `GET /vault/items` with these query params (see DC API docs). */
const VAULT_LIST_PER_PAGE = 50
const VAULT_LIST_MAX_PAGES = 20
/** Same value as `VAULT_LIST_MAX_PAGES`; used with `Math.min(..., VAULT_LIST_MAX_PAGES)` for vault list remap scans. */
const VAULT_LIST_PROJECT_UUID_LOOKUP_MAX_PAGES = VAULT_LIST_MAX_PAGES
/** Vault list pages for in-meeting notarized PDF (balance latency vs finding sealed row). */
const MEETING_VAULT_LIST_MAX_PAGES = 3
/** In-memory cache TTL when a sealed URL was found (meeting polls / page refresh). */
const MEETING_NOTARIZED_PDF_CACHE_TTL_MS = 90_000
/** Skip full vault list scan for this long after a failed/throttled attempt (per project). */
const MEETING_VAULT_RETRY_COOLDOWN_MS = 60_000

type MeetingNotarizedPdfCacheEntry = {
	url: string | null
	expiresAt: number
	lastVaultAttemptAt: number
}

/**
 * DocOnChain `data.files[].type` priority for **notarized / sealed** PDF (matches legacy quanby `main.py`).
 * `Document Completed` is the post-notarial seal; generic `url` / `file-reference-*-BXQ` are often sign-only.
 */
const DC_NOTARIZED_FILE_TYPE_PRIORITY = ["Document Completed", "Document Certification"] as const

/** Broader pick order when only a source/interim copy exists (not for `notarizedDocumentUrl`). */
const DC_GENERAL_FILE_TYPE_PRIORITY = [
	"Document Completed",
	"Document Certification",
	"Original With Signature And QR",
	"Original",
] as const

@Injectable()
export class DoconchainAdapterService {
	private readonly log = new Logger(DoconchainAdapterService.name)
	private readonly tokenCache = new Map<string, TokenCacheEntry>()
	private readonly meetingNotarizedPdfCache = new Map<string, MeetingNotarizedPdfCacheEntry>()
	/** Throttle repeated vault diagnostic lines (same key, 60s). */
	private readonly vaultDiagLogAt = new Map<string, number>()

	private logSensitiveEnabled(): boolean {
		return env.DOCONCHAIN_LOG_SENSITIVE === "true"
	}

	private logDcVerbose(message: string): void {
		if (env.DOCONCHAIN_VERBOSE_LOGS === "true") {
			this.log.debug(message)
		}
	}

	private logVaultDiagOnce(key: string, message: string, level: "debug" | "warn" = "debug"): void {
		const now = Date.now()
		const last = this.vaultDiagLogAt.get(key) ?? 0
		if (now - last < 60_000) return
		this.vaultDiagLogAt.set(key, now)
		if (level === "warn") {
			this.log.warn(message)
			return
		}
		this.logDcVerbose(message)
	}

	private formatBearerForLogs(token: string): string {
		const t = token.trim()
		if (this.logSensitiveEnabled()) return t
		if (t.length <= 18) return `${t.slice(0, 4)}…`
		return `${t.slice(0, 10)}…${t.slice(-8)}`
	}

	isConfigured(): boolean {
		return Boolean(
			env.DOCONCHAIN_API_URL && env.DOCONCHAIN_CLIENT_KEY && env.DOCONCHAIN_CLIENT_SECRET
		)
	}

	clearTokenCacheForEmail(email: string): void {
		this.tokenCache.delete(email.toLowerCase().trim())
	}

	/**
	 * Bearer for DocOnChain API.
	 *
	 * **Main org only (this service):** tokens are minted with `DOCONCHAIN_CLIENT_KEY` + `DOCONCHAIN_CLIENT_SECRET` via
	 * `POST …/api/v2/generate/token` and the given `email`. There is **no** alternate DocOnChain “sub-org client key” path here
	 * (Quanby sub-orgs in Postgres are for tenancy/files, not DC JWT issuance).
	 *
	 * If `DOCONCHAIN_API_TOKEN` is set, it is returned as-is unless `DOCONCHAIN_FORCE_GENERATED_TOKEN=true` — then generation
	 * runs anyway. A static token must belong to the **same DC user** as the vault/project owner or `GET /vault/items/...`
	 * returns **401** (`E_UNAUTHORIZED_ACCESS`).
	 *
	 * Otherwise: `POST .../api/v2/generate/token` with `client_key`, `client_secret`, and `email` (ENP then optional org
	 * fallback from {@link doconchainOrgEmailFallback}).
	 */
	async getAccessToken(
		enpEmail: string,
		options?: { allowMock?: boolean; allowOrgFallback?: boolean }
	): Promise<string> {
		const allowMock = options?.allowMock ?? true
		const allowOrgFallback = options?.allowOrgFallback ?? true
		const staticToken = env.DOCONCHAIN_API_TOKEN
		const forceGenerated = env.DOCONCHAIN_FORCE_GENERATED_TOKEN === "true"
		if (staticToken && !forceGenerated) return staticToken

		const baseUrl = env.DOCONCHAIN_API_URL
		const clientKey = env.DOCONCHAIN_CLIENT_KEY
		const clientSecret = env.DOCONCHAIN_CLIENT_SECRET
		if (!baseUrl || !clientKey || !clientSecret) {
			if (!allowMock) {
				throw new Error(
					"DOCONCHAIN is not configured. Set DOCONCHAIN_API_URL, DOCONCHAIN_CLIENT_KEY, and DOCONCHAIN_CLIENT_SECRET."
				)
			}
			return `mock_dc_token_${createHash("sha256").update(enpEmail).digest("hex").slice(0, 32)}`
		}

		const emailPrimary = enpEmail.trim()
		const emailFallback = allowOrgFallback
			? (doconchainOrgEmailFallback()?.trim() ?? emailPrimary)
			: emailPrimary
		const tryEmails =
			emailFallback === emailPrimary ? [emailPrimary] : [emailPrimary, emailFallback]

		let lastTokenFailure: string | undefined

		for (const email of tryEmails) {
			const cacheKey = email.toLowerCase()
			const cached = this.tokenCache.get(cacheKey)
			const now = Date.now()
			if (cached && now < cached.expiresAtMs - 30_000) {
				return cached.token
			}

			const endpoint = `${baseUrl.replace(/\/$/, "")}/api/v2/generate/token`
			const boundary = `QLDC${randomUUID().replace(/-/g, "")}`
			const multipartBody = buildMultipartBody(boundary, {
				client_key: clientKey,
				client_secret: clientSecret,
				email,
			})

			let res = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
				body: multipartBody,
			})
			// Some DC environments enforce JSON payloads for token generation.
			if (!res.ok) {
				res = await fetch(endpoint, {
					method: "POST",
					headers: { "Content-Type": "application/json", "Accept": "application/json" },
					body: JSON.stringify({
						client_key: clientKey,
						client_secret: clientSecret,
						email,
					}),
				})
			}
			const raw = await res.text()
			let json: unknown
			try {
				json = JSON.parse(raw) as Record<string, unknown>
			} catch {
				throw new Error(`DC token non-JSON (${res.status}): ${raw.slice(0, 240)}`)
			}
			if (!res.ok) {
				const detail = `${res.status} ${raw.slice(0, 200)}`
				lastTokenFailure = `${email}: ${detail}`
				this.log.warn(`DC token failed for ${email}: ${detail}`)
				continue
			}
			const data = json as { data?: { token?: string }; token?: string }
			const tokenStr = data.data?.token ?? data.token
			if (!tokenStr) {
				lastTokenFailure = `${email}: token missing in DC response`
				this.log.warn(`DC token missing in response for ${email}`)
				continue
			}

			if (this.logSensitiveEnabled()) {
				this.log.warn(
					`DC TOKEN (sensitive) minted email=${email} token=${this.formatBearerForLogs(tokenStr)}`
				)
			} else {
				this.logDcVerbose(
					`DC token minted email=${email} token=${this.formatBearerForLogs(tokenStr)}`
				)
			}

			const expMs = parseJwtExpMs(tokenStr) ?? now + 300_000
			this.tokenCache.set(cacheKey, { token: tokenStr, expiresAtMs: expMs })
			return tokenStr
		}

		// DocOnChain staging can temporarily fail token minting (e.g. Redis MISCONF). If a static token is configured,
		// fall back instead of hard-failing QuickSign / meeting notarized PDF flows.
		if (staticToken) {
			this.log.warn(
				`DocOnChain token generation failed for all candidate emails; falling back to DOCONCHAIN_API_TOKEN.${
					forceGenerated
						? " (DOCONCHAIN_FORCE_GENERATED_TOKEN=true — fix DocOnChain /generate/token or unset force-generated mode when DC is healthy.)"
						: ""
				}${lastTokenFailure ? ` Last failure: ${lastTokenFailure}` : ""}`
			)
			return staticToken
		}

		if (doconchainDevMockOnFailure() && allowMock) {
			this.log.warn(
				`DocOnChain token mint failed; using dev mock token (DOCONCHAIN_DEV_MOCK_ON_FAILURE=true).${
					lastTokenFailure ? ` Last failure: ${lastTokenFailure}` : ""
				}`
			)
			return `mock_dc_token_${createHash("sha256").update(enpEmail).digest("hex").slice(0, 32)}`
		}

		const suffix = lastTokenFailure ? ` Last failure: ${lastTokenFailure}` : ""
		throw new Error(
			`Could not obtain DOCONCHAIN token for configured emails.${suffix} Set DOCONCHAIN_API_TOKEN as a fallback when DocOnChain /generate/token is unavailable, enable DOCONCHAIN_DEV_MOCK_ON_FAILURE=true for local UI-only testing, or fix the DocOnChain environment.`
		)
	}

	/**
	 * `POST /api/v2/projects?user_type=ENTERPRISE_API` — Create Project (multipart PDF upload).
	 * `data.uuid` is the **only** project id to persist as `doconchainProjectUuid`.
	 */
	async createProjectFromPdf(args: {
		token: string
		pdf: Buffer
		filename: string
		documentStampJson: string
		/** When true, project creator is not auto-queued as a signer until explicitly added. */
		creatorAsViewer?: boolean
		/** When false, recipients cannot be edited after creation (DocOnChain default). */
		userListEditable?: boolean
		/** `DOCUMENT` | `TEMPLATE` — defaults to `DOCUMENT`. */
		projectType?: "DOCUMENT" | "TEMPLATE"
		allowMock?: boolean
	}): Promise<{ uuid: string }> {
		const allowMock = args.allowMock ?? true
		const baseUrl = env.DOCONCHAIN_API_URL
		if (!baseUrl || !this.isConfigured() || args.token.startsWith("mock_dc_token_")) {
			if (!allowMock) {
				throw new Error(
					"DOCONCHAIN create-project API requires a valid configured token and base URL."
				)
			}
			return { uuid: randomUUID() }
		}

		const boundary = `QLDC${randomUUID().replace(/-/g, "")}`
		const fields: Record<string, string> = {
			document_stamp: args.documentStampJson,
			user_list_editable: args.userListEditable === true ? "true" : "false",
			creator_as_viewer: args.creatorAsViewer === true ? "true" : "false",
			type: args.projectType ?? "DOCUMENT",
		}

		const body = buildMultipartBody(boundary, fields, {
			file: { filename: args.filename, contentType: "application/pdf", data: args.pdf },
		})

		const res = await fetch(
			`${baseUrl.replace(/\/$/, "")}/api/v2/projects?user_type=ENTERPRISE_API`,
			{
				method: "POST",
				headers: {
					"Authorization": `Bearer ${args.token}`,
					"Content-Type": `multipart/form-data; boundary=${boundary}`,
				},
				body,
			}
		)
		const raw = await res.text()
		let json: unknown
		try {
			json = JSON.parse(raw) as Record<string, unknown>
		} catch {
			throw new Error(`DC create project non-JSON (${res.status}): ${raw.slice(0, 400)}`)
		}
		if (!res.ok) {
			throw new Error(`DC create project ${res.status}: ${raw.slice(0, 400)}`)
		}
		const root = json as { data?: Record<string, unknown> }
		const data = (root.data ?? json) as Record<string, unknown>
		const uuid = (data.uuid ?? data.project_uuid ?? data.id) as string | undefined
		if (!uuid)
			throw new Error(`DC create project missing uuid: ${JSON.stringify(json).slice(0, 300)}`)
		return { uuid }
	}

	/**
	 * DocOnChain ENTERPRISE_API add signer.
	 * Projects are created via `POST /api/v2/projects`, so try v2 signers first, then legacy `/projects/.../signers`.
	 */
	async addSigner(args: {
		token: string
		projectUuid: string
		email: string
		firstName: string
		lastName: string
		/** DocOnChain signing group (1 = same group). Turn order is enforced by QLegal, not this field. */
		sequence: number
		/** ME = project owner/notary; GUEST = external signer (DocOnChain enum). */
		signerType?: "ME" | "GUEST"
		allowMock?: boolean
	}): Promise<void> {
		const allowMock = args.allowMock ?? true
		const baseUrl = env.DOCONCHAIN_API_URL
		if (!baseUrl || !this.isConfigured() || args.token.startsWith("mock_dc_token_")) {
			if (!allowMock) {
				throw new Error("DOCONCHAIN add signer requires a valid configured token and base URL.")
			}
			return
		}

		const signerType = args.signerType ?? "GUEST"
		const payload = JSON.stringify({
			email: args.email.trim(),
			first_name: args.firstName.trim(),
			last_name: args.lastName.trim(),
			type: signerType,
			signer_role: "Signer",
			sequence: args.sequence,
			receives_email_notifs: 1,
		})

		const headers = {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${args.token}`,
		} as const

		const root = baseUrl.replace(/\/$/, "")
		const encodedUuid = encodeURIComponent(args.projectUuid.trim())
		// Enterprise doc: POST /projects/{uuid}/signers — try legacy host path first, then v2.
		const urls = [
			`${root}/projects/${encodedUuid}/signers?user_type=ENTERPRISE_API`,
			`${root}/api/v2/projects/${encodedUuid}/signers?user_type=ENTERPRISE_API`,
		]

		let lastBad = ""
		for (let i = 0; i < urls.length; i++) {
			const url = urls[i]!
			const res = await fetch(url, { method: "POST", headers, body: payload })
			if (res.status === 409) return

			const raw = await res.text()
			const rawLower = raw.toLowerCase()

			if (res.ok) return

			if (
				rawLower.includes("already") ||
				rawLower.includes("duplicate") ||
				rawLower.includes("exists")
			) {
				return
			}

			lastBad = `${res.status}: ${raw.slice(0, 420)}`

			if (res.status === 422) {
				throw new Error(`DC add signer ${lastBad}`)
			}

			const hasAlternate = i < urls.length - 1
			const projectMissingOnRoute =
				res.status === 404 ||
				((res.status === 400 || res.status === 403) &&
					(rawLower.includes("project not found") || rawLower.includes("not found")))

			if (hasAlternate && projectMissingOnRoute) {
				this.log.warn(
					`DC add signer ${res.status} on ${url.includes("/api/v2/") ? "v2" : "legacy"} route, retrying alternate (${args.projectUuid.slice(0, 8)}…)`
				)
				continue
			}

			throw new Error(`DC add signer ${lastBad}`)
		}

		throw new Error(`DC add signer failed after retries: ${lastBad}`)
	}

	async autoJoinMemberInOrganization(args: {
		token: string
		email: string
		firstName: string
		lastName: string
		role: string
		organizationId: string
	}): Promise<void> {
		const baseUrl = env.DOCONCHAIN_API_URL
		if (!baseUrl || args.token.startsWith("mock_dc_token_")) return

		const boundary = `QLDC${randomUUID().replace(/-/g, "")}`
		const body = buildMultipartBody(boundary, {
			"data[0][email]": args.email,
			"data[0][first_name]": args.firstName,
			"data[0][last_name]": args.lastName,
			"data[0][role]": args.role,
			"data[0][organization_id]": args.organizationId,
		})

		const res = await fetch(
			`${baseUrl.replace(/\/$/, "")}/api/v2/organization/members/auto-join?user_type=ENTERPRISE_API`,
			{
				method: "POST",
				headers: {
					"Authorization": `Bearer ${args.token}`,
					"Content-Type": `multipart/form-data; boundary=${boundary}`,
				},
				body,
			}
		)

		if (res.status === 409) return
		const raw = await res.text()
		if (!res.ok && !raw.toLowerCase().includes("already")) {
			throw new Error(`DC auto-join ${res.status}: ${raw.slice(0, 400)}`)
		}
	}

	/**
	 * DocOnChain sign-link responses vary by environment (data.link, message.link, signing_url, etc.).
	 */
	private extractDoconchainLinkPayload(json: unknown): string | null {
		if (typeof json === "string" && /^https?:\/\//i.test(json.trim())) return json.trim()

		const pickFromRecord = (rec: Record<string, unknown>): string | null => {
			const keys = [
				"link",
				"url",
				"signing_link",
				"signLink",
				"signingLink",
				"signing_url",
				"signingUrl",
				"href",
				"redirect_url",
				"redirectUrl",
				"magic_link",
				"magicLink",
			]
			for (const k of keys) {
				const v = rec[k]
				if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) return v.trim()
			}
			return null
		}

		if (!json || typeof json !== "object") return null
		const root = json as Record<string, unknown>

		const msg = root.message
		if (typeof msg === "string" && /^https?:\/\//i.test(msg.trim())) return msg.trim()
		if (msg && typeof msg === "object") {
			const m = pickFromRecord(msg as Record<string, unknown>)
			if (m) return m
		}

		const d0 = root.data
		if (d0 && typeof d0 === "object") {
			const d = d0 as Record<string, unknown>
			const m = pickFromRecord(d)
			if (m) return m
			const inner = d.data
			if (inner && typeof inner === "object") {
				const m2 = pickFromRecord(inner as Record<string, unknown>)
				if (m2) return m2
			}
		}

		const top = pickFromRecord(root)
		if (top) return top

		const queue: unknown[] = [json]
		let steps = 0
		while (queue.length && steps < 100) {
			steps++
			const cur = queue.shift()
			if (typeof cur === "string" && /^https?:\/\//i.test(cur.trim())) return cur.trim()
			if (cur && typeof cur === "object" && !Array.isArray(cur)) {
				for (const v of Object.values(cur as Record<string, unknown>)) {
					if (v && (typeof v === "object" || typeof v === "string")) queue.push(v)
				}
			} else if (Array.isArray(cur)) {
				for (const v of cur) {
					if (v && (typeof v === "object" || typeof v === "string")) queue.push(v)
				}
			}
		}
		return null
	}

	/**
	 * POST /api/v2/projects/:uuid/link/generate?email=… — per-signer signing URL (DocOnChain docs).
	 * Uses the ENP/owner bearer token; `email` query is the recipient signer.
	 */
	async getSignLink(args: { token: string; projectUuid: string; email: string }): Promise<string> {
		const baseUrl = env.DOCONCHAIN_API_URL
		if (!baseUrl || args.token.startsWith("mock_dc_token_")) {
			const app = env.DOCONCHAIN_APP_URL ?? "https://stg-app.doconchain.com"
			return `${app.replace(/\/$/, "")}/sign-mock/${args.projectUuid}?email=${encodeURIComponent(args.email)}`
		}

		const signerEmail = args.email.trim()
		const projectUuid = args.projectUuid.trim()
		const url = `${baseUrl.replace(/\/$/, "")}/api/v2/projects/${encodeURIComponent(projectUuid)}/link/generate?email=${encodeURIComponent(signerEmail)}`

		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Authorization": `Bearer ${args.token}`,
				"Accept": "application/json",
				"Content-Type": "application/json",
			},
		})
		const raw = await res.text()
		let json: unknown
		try {
			json = JSON.parse(raw) as unknown
		} catch {
			throw new Error(`DC sign link non-JSON (${res.status}): ${raw.slice(0, 400)}`)
		}
		if (!res.ok) {
			throw new Error(
				`DC sign link ${res.status}: ${typeof json === "object" ? JSON.stringify(json).slice(0, 500) : raw.slice(0, 400)}`
			)
		}

		const link = this.extractDoconchainLinkPayload(json)
		if (!link) {
			throw new Error(`DC sign link missing in response: ${JSON.stringify(json).slice(0, 600)}`)
		}

		this.logDcVerbose(
			`DC sign link minted project=${projectUuid.slice(0, 8)}… signer=${signerEmail}`
		)
		return link
	}

	/**
	 * Browser-ready signing URL: return the raw DC short link — never follow redirects server-side
	 * (one-time token) and do not mutate query params (added signers hang on "SIGNING IN PROGRESS…").
	 */
	async getSignLinkForBrowser(args: {
		token: string
		projectUuid: string
		email: string
	}): Promise<string> {
		return this.getSignLink(args)
	}

	/**
	 * Returns the short plotter link only — never follows redirects (legacy DC TTL sensitivity).
	 */
	async getPlotLink(args: { token: string; projectUuid: string }): Promise<string> {
		const baseUrl = env.DOCONCHAIN_API_URL
		if (!baseUrl || args.token.startsWith("mock_dc_token_")) {
			const app = env.DOCONCHAIN_APP_URL ?? "https://stg-app.doconchain.com"
			return `${app.replace(/\/$/, "")}/plot-mock/${args.projectUuid}`
		}

		const res = await fetch(
			`${baseUrl.replace(/\/$/, "")}/api/v2/projects/${args.projectUuid}/link?user_type=ENTERPRISE_API`,
			{
				method: "POST",
				headers: { Authorization: `Bearer ${args.token}`, Accept: "application/json" },
			}
		)
		const raw = await res.text()
		let json: unknown
		try {
			json = JSON.parse(raw) as Record<string, unknown>
		} catch {
			throw new Error(`DC plot link non-JSON (${res.status}): ${raw.slice(0, 400)}`)
		}
		if (!res.ok) {
			throw new Error(`DC plot link ${res.status}: ${raw.slice(0, 400)}`)
		}
		const parsed = this.extractDoconchainLinkPayload(json)
		if (!parsed)
			throw new Error(`DC plot link missing in response: ${JSON.stringify(json).slice(0, 300)}`)
		return parsed
	}

	/**
	 * Fresh plot URL for the browser: resolve DC short-link redirect once, keep auth query params,
	 * add `api=true` for the field-placement UI. Do not strip `token` / `api_token` (breaks auto-login).
	 */
	async getPlotLinkForBrowser(args: { token: string; projectUuid: string }): Promise<string> {
		let link = await this.getPlotLink(args)
		if (/doconchain\.com/i.test(link)) {
			link = await this.resolvePlotLinkRedirectOnce(link)
		}
		return this.normalizePlotterUrl(link)
	}

	/** @deprecated Prefer {@link getPlotLinkForBrowser}. */
	async getPlotLinkNormalized(args: { token: string; projectUuid: string }): Promise<string> {
		return this.getPlotLinkForBrowser(args)
	}

	/** Capture one 302/303 Location from DC short links without following the full chain (TTL-sensitive). */
	private async resolvePlotLinkRedirectOnce(link: string): Promise<string> {
		try {
			const res = await fetch(link.trim(), {
				method: "GET",
				redirect: "manual",
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
					"Accept": "text/html,application/xhtml+xml",
				},
			})
			if (res.status >= 300 && res.status < 400) {
				const loc = res.headers.get("location") ?? res.headers.get("Location")
				if (loc?.trim()) return new URL(loc.trim(), link).toString()
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.debug(`DC plot redirect resolve skipped: ${msg.slice(0, 120)}`)
		}
		return link
	}

	private normalizePlotterUrl(link: string): string {
		try {
			const u = new URL(link.trim())
			const host = u.hostname.toLowerCase()
			if (host.includes("doconchain.com") && !u.searchParams.has("api")) {
				u.searchParams.set("api", "true")
			}
			return u.toString()
		} catch {
			return link
		}
	}

	private extractVaultDocumentUrl(item: Record<string, unknown>): string | undefined {
		const keys = [
			"sealed_pdf_url",
			"sealedPdfUrl",
			"notarized_file_url",
			"notarizedFileUrl",
			"sealed_document_url",
			"sealedDocumentUrl",
			"notarized_document_url",
			"notarizedDocumentUrl",
			"final_pdf_url",
			"finalPdfUrl",
			"signed_pdf_url",
			"signedPdfUrl",
			"signed_file_url",
			"signedFileUrl",
			"download_url",
			"downloadUrl",
			"document_url",
			"documentUrl",
			"document_link",
			"documentLink",
			"pdf_url",
			"pdfUrl",
			"url",
			"file_url",
			"fileUrl",
			"preview_url",
			"previewUrl",
		] as const
		const fromKeys: string[] = []
		for (const k of keys) {
			const v = item[k]
			if (typeof v === "string" && v.trim().startsWith("http")) fromKeys.push(v.trim())
		}
		const nestedUrlKeys = [
			"file_url",
			"fileUrl",
			"url",
			"download_url",
			"downloadUrl",
			"href",
			"link",
			"signed_pdf_url",
			"signedPdfUrl",
			"path",
			"file_path",
			"filePath",
		] as const
		const pickFromObjectArray = (arr: unknown): string | undefined => {
			if (!Array.isArray(arr)) return undefined
			const urls: string[] = []
			for (const raw of arr) {
				if (!raw || typeof raw !== "object") continue
				const o = raw as Record<string, unknown>
				for (const k of nestedUrlKeys) {
					const u = o[k]
					if (typeof u === "string" && u.trim().startsWith("http")) urls.push(u.trim())
				}
			}
			return this.pickPreferredVaultPdfUrl(urls)
		}
		const fromFilesNotarized = this.extractPdfUrlFromDcFilesByTypePriority(
			item.files,
			DC_NOTARIZED_FILE_TYPE_PRIORITY
		)
		const fromFilesGeneral = this.extractPdfUrlFromDcFilesByTypePriority(
			item.files,
			DC_GENERAL_FILE_TYPE_PRIORITY
		)
		const fromContents = pickFromObjectArray(item.contents)
		const fromKeysPreferred = this.pickPreferredVaultPdfUrl(fromKeys)
		const flat = this.pickPreferredVaultPdfUrl([
			fromFilesNotarized,
			fromFilesGeneral,
			fromKeysPreferred,
			fromContents,
		])
		if (flat) return flat

		const actionUrls: string[] = []
		const actions = item.actions
		if (Array.isArray(actions)) {
			for (const a of actions) {
				if (typeof a === "string" && a.trim().startsWith("http")) actionUrls.push(a.trim())
				if (!a || typeof a !== "object") continue
				const o = a as Record<string, unknown>
				const u = o.url ?? o.link ?? o.href ?? o.download_url ?? o.downloadUrl ?? o.path
				if (typeof u === "string" && u.trim().startsWith("http")) actionUrls.push(u.trim())
			}
		}
		return this.pickPreferredVaultPdfUrl(actionUrls)
	}

	private absolutizeVaultPath(apiRoot: string, s: string): string | undefined {
		const t = s.trim()
		if (/^https?:\/\//i.test(t)) return t
		if (t.startsWith("//")) return `https:${t}`
		if (t.startsWith("/") && t.length > 2) {
			return `${apiRoot.replace(/\/$/, "")}${t}`
		}
		return undefined
	}

	/** Breadth-first search for an https URL (nested `data`, `message`, arrays). */
	private extractVaultDocumentUrlDeep(
		root: unknown,
		maxDepth = 8,
		apiRoot?: string
	): string | undefined {
		const queue: { v: unknown; d: number }[] = [{ v: root, d: 0 }]
		const seen = new Set<unknown>()
		while (queue.length) {
			const cur = queue.shift()!
			const { v, d } = cur
			if (d > maxDepth || v === null || v === undefined) continue
			if (typeof v === "string") {
				const t = v.trim()
				if (t.startsWith("http")) return t
				if (apiRoot) {
					const abs = this.absolutizeVaultPath(apiRoot, t)
					if (abs?.startsWith("http")) return abs
				}
				continue
			}
			if (typeof v !== "object") continue
			if (seen.has(v)) continue
			seen.add(v)
			if (Array.isArray(v)) {
				for (const el of v) queue.push({ v: el, d: d + 1 })
				continue
			}
			const flat = this.extractVaultDocumentUrl(v as Record<string, unknown>)
			if (flat) return flat
			for (const val of Object.values(v as Record<string, unknown>)) {
				if (val && (typeof val === "object" || typeof val === "string"))
					queue.push({ v: val, d: d + 1 })
			}
		}
		return undefined
	}

	/** DC vault list/detail `project_uuid` — same logical project as `doconchainProjectUuid` (may differ only by whitespace). */
	private vaultRowProjectUuid(row: Record<string, unknown>): string | undefined {
		const pick = (r: Record<string, unknown>): string | undefined => {
			const pu =
				r.project_uuid ??
				r.projectUuid ??
				r.doconchain_project_uuid ??
				r.doconchainProjectUuid ??
				r.project_id ??
				r.projectId
			return typeof pu === "string" && pu.trim() ? pu.trim() : undefined
		}
		const top = pick(row)
		if (top) return top
		const nested = row.data
		if (nested && typeof nested === "object" && !Array.isArray(nested)) {
			return pick(nested as Record<string, unknown>)
		}
		return undefined
	}

	/** Vault **list/detail** row id (`data[].uuid`). Used only for DC vault HTTP paths — do not persist as `doconchainProjectUuid`. */
	private vaultRowVaultItemUuid(row: Record<string, unknown>): string | undefined {
		const u = row.uuid
		return typeof u === "string" && u.trim() ? u.trim() : undefined
	}

	/** DC short ref ids are often compared case-insensitively; full UUIDs are normalized the same way. */
	private vaultIdsEquivalent(a: string, b: string): boolean {
		const x = a.trim()
		const y = b.trim()
		if (x === y) return true
		return x.toLowerCase() === y.toLowerCase()
	}

	/**
	 * Compare list `project_uuid` to stored create-project ref, allowing a **single leading-character drift** on short refs (e.g. list `wfY…` vs DB `fY…`).
	 * Not used for full dashed UUIDs where an off-by-one prefix would be unsafe.
	 */
	private vaultProjectUuidRefsEquivalent(listProjectUuid: string, storedWant: string): boolean {
		if (this.vaultIdsEquivalent(listProjectUuid, storedWant)) return true
		const a = listProjectUuid.trim()
		const b = storedWant.trim()
		const shortRef = (s: string) => s.length > 0 && s.length <= 36 && !s.includes("-")
		if (!shortRef(a) || !shortRef(b)) return false
		if (a.length === b.length + 1 && a.length >= 4 && this.vaultIdsEquivalent(a.slice(1), b))
			return true
		if (b.length === a.length + 1 && b.length >= 4 && this.vaultIdsEquivalent(a, b.slice(1)))
			return true
		return false
	}

	/**
	 * Whether a vault **list** row belongs to the stored create-project / lookup id.
	 * DocOnChain docs describe `GET /vault/items/{uuid}` as “project uuid”, but list rows often need matching on **`project_uuid`**, or the row’s own **`uuid`**, or **`id`** (stringified) before remapping to the list row `uuid` for a second detail call.
	 */
	private vaultStoredIdMatchesVaultListRow(
		storedProjectId: string,
		row: Record<string, unknown>
	): boolean {
		const want = storedProjectId.trim()
		if (!want) return false
		const pu = this.vaultRowProjectUuid(row)
		const vu = this.vaultRowVaultItemUuid(row)
		if (pu && this.vaultProjectUuidRefsEquivalent(pu, want)) return true
		if (vu && this.vaultIdsEquivalent(vu, want)) return true
		const nid = row.id
		if (nid !== undefined && nid !== null && this.vaultIdsEquivalent(String(nid), want)) return true
		return false
	}

	/**
	 * Path segments for `GET …/vault/items/{segment}/download` probes only.
	 * Staging often binds **download** to the **vault list row** `uuid` or numeric `id`; try those before the create-project ref.
	 */
	private buildVaultItemDownloadSlugs(
		storedProjectUuid: string,
		row: Record<string, unknown>
	): string[] {
		const out: string[] = []
		const add = (s: string | undefined) => {
			const t = s?.trim()
			if (t && !out.includes(t)) out.push(t)
		}
		add(this.vaultRowVaultItemUuid(row))
		const id = row.id
		if (id !== undefined && id !== null) {
			const s = String(id).trim()
			if (s.length > 0) add(s)
		}
		add(storedProjectUuid)
		const rowPu = this.vaultRowProjectUuid(row)
		if (rowPu) add(rowPu)
		return out
	}

	/**
	 * Only treat as sealed when status is explicitly “done” (missing/null = still processing — sealing often lags).
	 */
	private vaultItemStrictlyCompleted(item: Record<string, unknown>): boolean {
		const raw = item.status
		if (raw === undefined || raw === null) return false
		const s = String(raw).trim().toLowerCase().replace(/\s+/g, "_")
		const ok = new Set([
			"completed",
			"complete",
			"signed",
			"finalized",
			"closed",
			"done",
			"success",
			"fully_signed",
			"all_signed",
			"all_signed_complete",
		])
		return ok.has(s)
	}

	private vaultPayloadKeySample(item: Record<string, unknown>, max = 56): string {
		const keys = new Set<string>()
		for (const k of Object.keys(item)) keys.add(k)
		const nested = item.data
		if (nested && typeof nested === "object" && !Array.isArray(nested)) {
			for (const k of Object.keys(nested as Record<string, unknown>)) keys.add(`data.${k}`)
		}
		const contents = item.contents
		if (Array.isArray(contents) && contents[0] && typeof contents[0] === "object") {
			for (const k of Object.keys(contents[0] as Record<string, unknown>))
				keys.add(`contents[0].${k}`)
		}
		return [...keys].slice(0, max).sort().join(", ")
	}

	/** Paste-friendly blob between BEGIN/END so Turbo/Nest terminals can select/copy one vault row JSON. */
	private logVaultRowJsonBlock(
		tag: string,
		projectUuid: string,
		row: Record<string, unknown>
	): void {
		if (env.DOCONCHAIN_VERBOSE_LOGS !== "true") return
		const tail = projectUuid.length <= 14 ? projectUuid : `…${projectUuid.slice(-14)}`
		let json: string
		try {
			json = JSON.stringify(row, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2)
		} catch {
			json = JSON.stringify(
				{ keys: Object.keys(row), error: "JSON.stringify failed" },
				undefined,
				2
			)
		}
		const max = 48_000
		if (json.length > max) {
			json = `${json.slice(0, max)}\n… truncated (${json.length} chars → ${max})`
		}
		this.log.warn(
			`${tag}: vault row JSON (copy lines between BEGIN and END)\nDC_VAULT_ROW_JSON_BEGIN tag=${tag} project=${tail}\n${json}\nDC_VAULT_ROW_JSON_END`
		)
	}

	private logVaultMissingUrl(
		kind: string,
		projectUuid: string,
		row: Record<string, unknown>,
		opts?: { dumpFullJson?: boolean }
	): void {
		const tail = projectUuid.length <= 14 ? projectUuid : `…${projectUuid.slice(-14)}`
		this.logVaultDiagOnce(
			`vault-missing-url:${tail}`,
			`${kind}: no HTTPS PDF URL (${tail}) keys=${this.vaultPayloadKeySample(row)}`,
			"warn"
		)
		if (opts?.dumpFullJson) {
			const tag = kind.replace(/^DC vault\s+/i, "vault").replace(/\s+/g, "_")
			this.logVaultRowJsonBlock(tag, projectUuid, row)
		}
	}

	/**
	 * Debug: which code path produced the HTTPS PDF (interim “signed” vs sealed notarial often differs by endpoint).
	 * Search logs for `[DocOnChain notarized PDF resolved]`.
	 */
	private logResolvedNotarizedPdf(
		resolutionSource: string,
		projectUuid: string,
		signedPdfUrl: string,
		vaultRow?: Record<string, unknown>
	): void {
		const tail = projectUuid.length <= 14 ? projectUuid : `…${projectUuid.slice(-14)}`
		let host = ""
		let pathSample = ""
		try {
			const u = new URL(signedPdfUrl)
			host = u.hostname
			pathSample = `${u.pathname}${u.search}`.replace(/\s+/g, " ").slice(0, 220)
		} catch {
			pathSample = "(invalid-url)"
		}
		let rowDigest = ""
		if (vaultRow && typeof vaultRow === "object") {
			const pick = (k: string) => {
				const v = vaultRow[k]
				if (v === undefined || v === null) return ""
				return `${k}=${String(v).slice(0, 100)}`
			}
			rowDigest = [
				pick("status"),
				pick("name"),
				pick("file_name"),
				pick("fileName"),
				pick("type"),
				pick("document_type"),
				pick("category"),
				pick("category_name"),
				pick("reference_number"),
			]
				.filter(Boolean)
				.join(" ")
		}
		this.log.log(
			`[DocOnChain notarized PDF resolved] source=${resolutionSource} project=${tail} urlHost=${host} urlPathSample=${pathSample}${rowDigest ? ` ${rowDigest}` : ""}`
		)
	}

	/**
	 * Staging `GET …/projects/{uuid}` often returns `file-reference-*-Original.pdf` (pre-notarial seal).
	 * Sealed output is usually on vault download or a non-`-Original` object key.
	 */
	private isLikelyPreSealVaultPdfUrl(url: string): boolean {
		const t = url.trim()
		if (!t) return false
		let path = t
		try {
			path = new URL(t).pathname
		} catch {
			/* use raw */
		}
		const p = path.toLowerCase()
		if (/-original\.pdf$/i.test(p) || /-original\.pdf[?#]/i.test(p)) return true
		if (/\/original(?:\/|$)/i.test(p)) return true
		if (p.includes("pre_seal") || p.includes("pre-seal") || p.includes("presign")) return true
		return false
	}

	private pickPreferredVaultPdfUrl(candidates: Array<string | undefined>): string | undefined {
		const urls = [
			...new Set(
				candidates
					.filter((u): u is string => typeof u === "string" && u.trim().startsWith("http"))
					.map(u => u.trim())
			),
		]
		if (urls.length === 0) return undefined
		return urls.find(u => !this.isLikelyPreSealVaultPdfUrl(u)) ?? urls[0]
	}

	/**
	 * `file-reference-*-BXQ.pdf` and similar: all parties signed on DocOnChain but **no notarial seal** yet.
	 * Prefer `files[].type` = `Document Completed` instead (legacy vault/project pick order).
	 */
	private isLikelyInterimSignedWithoutNotarialSeal(url: string): boolean {
		if (this.isLikelyPreSealVaultPdfUrl(url)) return true
		let path = url.trim()
		try {
			path = new URL(url).pathname
		} catch {
			/* use raw */
		}
		const p = path.toLowerCase()
		if (!p.includes("file-reference-")) return false
		// Staging S3 keys use `DocumentCompleted` / `-Protect.pdf` (no dot/hyphen between words).
		if (
			/notari|notarized|sealed|certification|document[.\-_]?completed|documentcompleted|-protect\.pdf/.test(
				p
			)
		)
			return false
		return true
	}

	/** Pick HTTPS URL from DocOnChain `files[]` using `type` labels (see {@link DC_NOTARIZED_FILE_TYPE_PRIORITY}). */
	private extractPdfUrlFromDcFilesByTypePriority(
		files: unknown,
		typePriority: readonly string[]
	): string | undefined {
		if (!Array.isArray(files)) return undefined
		const byType = new Map<string, string>()
		for (const raw of files) {
			if (!raw || typeof raw !== "object") continue
			const f = raw as Record<string, unknown>
			const ft = String(f.type ?? f.file_type ?? f.fileType ?? "").trim()
			const u =
				(typeof f.url === "string" && f.url) ||
				(typeof f.file_url === "string" && f.file_url) ||
				(typeof f.fileUrl === "string" && f.fileUrl)
			if (ft && typeof u === "string" && u.trim().startsWith("http")) {
				byType.set(ft, u.trim())
			}
		}
		for (const t of typePriority) {
			const hit = byType.get(t)
			if (hit) return hit
		}
		return undefined
	}

	/** Vault detail / list row: notarized file types, then top-level `url` (DC vault spec: sealed PDF on `data.url`). */
	private extractNotarizedPdfUrlFromVaultRecord(
		record: Record<string, unknown>
	): string | undefined {
		const fromFiles = this.extractPdfUrlFromDcFilesByTypePriority(
			record.files,
			DC_NOTARIZED_FILE_TYPE_PRIORITY
		)
		if (fromFiles) return fromFiles
		const topUrl = typeof record.url === "string" ? record.url.trim() : ""
		if (topUrl.startsWith("http") && !this.isLikelyInterimSignedWithoutNotarialSeal(topUrl)) {
			return topUrl
		}
		return undefined
	}

	/** Project GET: only notarized types — never the first generic `file-reference-*` (often sign-only). */
	private extractNotarizedPdfUrlFromProjectRecord(
		record: Record<string, unknown>
	): string | undefined {
		return this.extractPdfUrlFromDcFilesByTypePriority(
			record.files,
			DC_NOTARIZED_FILE_TYPE_PRIORITY
		)
	}

	/**
	 * Unwraps DocOnChain “Get Specific Project In Vault” body: `{ message, data: { … }, meta }`.
	 * Canonical HTTPS PDF fields on `data` include `url` and `files[].file_url` (see {@link extractVaultDocumentUrl}).
	 * Staging sometimes returns `data` as a **single-element array** or omits nested `url` while the envelope still contains a link elsewhere.
	 */
	private parseVaultDetailData(bodyText: string): Record<string, unknown> | null {
		try {
			const j = JSON.parse(bodyText) as { data?: unknown }
			const d = j.data
			if (Array.isArray(d) && d[0] && typeof d[0] === "object" && !Array.isArray(d[0])) {
				return d[0] as Record<string, unknown>
			}
			if (d && typeof d === "object" && !Array.isArray(d)) return d as Record<string, unknown>
		} catch {
			return null
		}
		return null
	}

	/** Deep-scan entire Get Specific JSON (including `meta`, siblings of `data`) for an https PDF link. */
	private extractHttpsPdfFromVaultDetailJsonBody(
		bodyText: string,
		vaultPublicRoot: string
	): string | undefined {
		try {
			const parsed = JSON.parse(bodyText) as unknown
			const hit = this.extractVaultDocumentUrlDeep(parsed, 12, vaultPublicRoot)
			if (!hit?.startsWith("http")) return undefined
			if (
				this.isLikelyPreSealVaultPdfUrl(hit) ||
				this.isLikelyInterimSignedWithoutNotarialSeal(hit)
			) {
				return undefined
			}
			return hit
		} catch {
			return undefined
		}
	}

	private isSealedNotarizedPdfUrl(url: string): boolean {
		return (
			url.trim().startsWith("http") &&
			!this.isLikelyPreSealVaultPdfUrl(url) &&
			!this.isLikelyInterimSignedWithoutNotarialSeal(url)
		)
	}

	/**
	 * `GET /api/v2/projects/{uuid}?user_type=ENTERPRISE_API` (and legacy `/projects/...`) — staging often omits `url` on vault detail
	 * but still exposes the sealed file on the enterprise **project** resource.
	 */
	private async tryFetchSignedPdfUrlFromProjectGet(
		token: string,
		apiBaseUrl: string,
		projectUuid: string
	): Promise<string | undefined> {
		const root = apiBaseUrl.trim().replace(/\/$/, "")
		const apiPrefix = this.doconchainApiV2Prefix(apiBaseUrl)
		const enc = encodeURIComponent(projectUuid.trim())
		const qs = new URLSearchParams({ user_type: "ENTERPRISE_API" }).toString()
		const vaultRoot = this.doconchainVaultListHostRoot(apiBaseUrl)
		const urls = [`${apiPrefix}/projects/${enc}?${qs}`, `${root}/projects/${enc}?${qs}`]
		for (const url of urls) {
			let res: Response
			try {
				res = await fetch(url, {
					headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
				})
			} catch {
				continue
			}
			if (!res.ok) continue
			let raw: string
			try {
				raw = await res.text()
			} catch {
				continue
			}
			let parsed: unknown
			try {
				parsed = JSON.parse(raw) as unknown
			} catch {
				continue
			}
			const data = (parsed as { data?: unknown }).data
			const record =
				data && typeof data === "object" && !Array.isArray(data)
					? (data as Record<string, unknown>)
					: typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
						? (parsed as Record<string, unknown>)
						: null
			if (record) {
				const fromNotarizedTypes = this.extractNotarizedPdfUrlFromProjectRecord(record)
				if (fromNotarizedTypes?.startsWith("http")) return fromNotarizedTypes
				const fromGeneralTypes = this.extractPdfUrlFromDcFilesByTypePriority(
					record.files,
					DC_GENERAL_FILE_TYPE_PRIORITY
				)
				const fromRecord =
					fromGeneralTypes ??
					this.extractVaultDocumentUrlDeep(record, 10, vaultRoot) ??
					this.extractVaultDocumentUrl(record)
				const fromTree = this.extractVaultDocumentUrlDeep(parsed, 12, vaultRoot)
				const picked = this.pickPreferredVaultPdfUrl([fromRecord, fromTree])
				if (picked?.startsWith("http")) return picked
			}
		}
		return undefined
	}

	/**
	 * `GET /api/v2/projects/{uuid}?user_type=ENTERPRISE_API` — project status, completion time, signers.
	 * Used when populating the notarial registry on meeting end (no vault/download).
	 */
	async getProjectDetails(args: {
		token: string
		projectUuid: string
	}): Promise<DoconchainProjectDetailsSnapshot | null> {
		const parsed = await this.fetchProjectGetJson(args.token, args.projectUuid.trim())
		if (!parsed) return null
		return parseDoconchainProjectDetailsBody(parsed)
	}

	private async fetchProjectGetJson(token: string, projectUuid: string): Promise<unknown | null> {
		const baseUrl = env.DOCONCHAIN_API_URL?.trim()
		if (!baseUrl || !projectUuid || token.startsWith("mock_dc_token_")) return null

		const root = baseUrl.replace(/\/$/, "")
		const apiPrefix = this.doconchainApiV2Prefix(baseUrl)
		const enc = encodeURIComponent(projectUuid)
		const qs = new URLSearchParams({ user_type: "ENTERPRISE_API" }).toString()
		const urls = [`${apiPrefix}/projects/${enc}?${qs}`, `${root}/projects/${enc}?${qs}`]

		for (const url of urls) {
			let res: Response
			try {
				res = await fetch(url, {
					headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
				})
			} catch {
				continue
			}
			if (!res.ok) continue
			try {
				return (await res.json()) as unknown
			} catch {
				continue
			}
		}
		return null
	}

	/** Project GET: `Document Completed` / `Document Certification` only (not sign-only `file-reference-*-BXQ`). */
	async tryFetchSealedPdfUrlFromProjectGet(
		token: string,
		apiBaseUrl: string,
		projectUuid: string
	): Promise<string | undefined> {
		const baseUrl = apiBaseUrl.trim().replace(/\/$/, "")
		const apiPrefix = this.doconchainApiV2Prefix(apiBaseUrl)
		const enc = encodeURIComponent(projectUuid.trim())
		const qs = new URLSearchParams({ user_type: "ENTERPRISE_API" }).toString()
		const urls = [`${apiPrefix}/projects/${enc}?${qs}`, `${baseUrl}/projects/${enc}?${qs}`]
		for (const url of urls) {
			let res: Response
			try {
				res = await fetch(url, {
					headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
				})
			} catch {
				continue
			}
			if (!res.ok) continue
			let parsed: unknown
			try {
				parsed = (await res.json()) as unknown
			} catch {
				continue
			}
			const data = (parsed as { data?: unknown }).data
			const record =
				data && typeof data === "object" && !Array.isArray(data)
					? (data as Record<string, unknown>)
					: typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
						? (parsed as Record<string, unknown>)
						: null
			if (!record) continue
			const hit = this.extractNotarizedPdfUrlFromProjectRecord(record)
			// Typed `files[]` entries (`Document Completed`, etc.) are authoritative — do not re-filter by URL shape.
			if (hit?.startsWith("http")) return hit
		}
		return undefined
	}

	/**
	 * Vault list is documented as `GET https://{host}/vault/items?...` (no `/api/v2` prefix on that path).
	 * If `DOCONCHAIN_API_URL` ends with `/api/v2`, strip it so we do not call `/api/v2/vault/items` by mistake.
	 */
	private doconchainVaultListHostRoot(apiUrl: string): string {
		let u = apiUrl.trim().replace(/\/+$/, "")
		if (/\/api\/v2$/i.test(u)) u = u.replace(/\/api\/v2$/i, "").replace(/\/+$/, "")
		return u.replace(/\/+$/, "")
	}

	/** Base URL that already includes `/api/v2` or gets it appended (matches {@link createProjectFromPdf} host rules). */
	private doconchainApiV2Prefix(apiUrl: string): string {
		const u = apiUrl.trim().replace(/\/+$/, "")
		if (/\/api\/v2$/i.test(u)) return u
		return `${u}/api/v2`
	}

	/**
	 * Published “Get Projects In Vault” query string: `user_type`, `per_page`, `page`, `user_items_only`, `api_integrated_projects_only`
	 * (string `yes` | `no`). Same shape as `GET https://stg-api2.doconchain.com/vault/items?...`.
	 */
	private buildVaultListQueryString(
		page: number,
		apiIntegratedProjectsOnly: "yes" | "no" = "no"
	): string {
		return new URLSearchParams({
			user_type: "ENTERPRISE_API",
			per_page: String(VAULT_LIST_PER_PAGE),
			page: String(page),
			user_items_only: "no",
			api_integrated_projects_only: apiIntegratedProjectsOnly,
		}).toString()
	}

	private vaultDetailResponseLooksNotFound(res: Response, errBody: string): boolean {
		if (res.status === 400 || res.status === 404) return true
		const t = errBody.toLowerCase()
		return t.includes("no item found") || t.includes("not found")
	}

	/**
	 * DocOnChain: `GET /vault/items` (paged) until we find a row that {@link vaultStoredIdMatchesVaultListRow matches} the stored id.
	 * Returns the list row **`uuid`** plus the **row** so {@link vaultDetailFetch} can add `category_id` / `client_id` query params (staging may 500 with `findOrganization` without that context).
	 */
	/** True when vault list has a completed row for this create-project id (proxy stream is likely to work). */
	async hasCompletedVaultListRowForProject(token: string, projectUuid: string): Promise<boolean> {
		const baseUrl = env.DOCONCHAIN_API_URL
		if (!baseUrl?.trim() || token.startsWith("mock_dc_token_")) return false
		const hit = await this.findVaultListRowForCreateProjectId(
			token,
			baseUrl,
			projectUuid.trim(),
			MEETING_VAULT_LIST_MAX_PAGES
		)
		return Boolean(hit && this.vaultItemStrictlyCompleted(hit.row))
	}

	/**
	 * Meeting poll: DocOnChain has published the sealed notarized PDF (not a sign-only interim copy).
	 * True when project GET exposes `Document Completed` / `Document Certification`, or vault has a completed row.
	 */
	async isSealedNotarizedPdfPublished(args: {
		token: string
		projectUuid: string
	}): Promise<boolean> {
		const projectUuid = args.projectUuid.trim()
		const baseUrl = env.DOCONCHAIN_API_URL?.trim()
		if (!baseUrl || !projectUuid || args.token.startsWith("mock_dc_token_")) return false

		const sealedFromProject = await this.tryFetchSealedPdfUrlFromProjectGet(
			args.token,
			baseUrl,
			projectUuid
		)
		if (sealedFromProject?.startsWith("http")) return true

		return this.hasCompletedVaultListRowForProject(args.token, projectUuid)
	}

	private sendNotarizedPdfBufferToResponse(
		res: ExpressResponse,
		buf: Buffer,
		opts?: { asAttachment?: boolean; cacheProjectUuid?: string }
	): boolean {
		if (this.isInterimSignOnlyNotarizedPdf(buf)) return false
		if (opts?.cacheProjectUuid?.trim()) {
			void writeNotarizedPdfBytesCache(opts.cacheProjectUuid, buf)
		}
		res.setHeader("Content-Type", "application/pdf")
		res.setHeader(
			"Content-Disposition",
			opts?.asAttachment
				? 'attachment; filename="notarized-document.pdf"'
				: 'inline; filename="notarized-document.pdf"'
		)
		res.setHeader("Cache-Control", "private, max-age=86400")
		res.status(200).send(buf)
		return true
	}

	async trySendCachedNotarizedPdfToResponse(
		projectUuid: string,
		res: ExpressResponse,
		opts?: { asAttachment?: boolean }
	): Promise<boolean> {
		const cached = await readNotarizedPdfBytesCache(projectUuid)
		if (!cached?.length || cached.subarray(0, 4).toString("ascii") !== "%PDF") return false
		if (this.isInterimSignOnlyNotarizedPdf(cached)) {
			await deleteNotarizedPdfBytesCache(projectUuid)
			return false
		}
		const sent = this.sendNotarizedPdfBufferToResponse(res, cached, {
			asAttachment: opts?.asAttachment,
			cacheProjectUuid: projectUuid,
		})
		if (!sent) return false
		this.logDcVerbose(
			`[DocOnChain] notarized PDF bytes cache hit …${projectUuid.trim().slice(-12)}`
		)
		return true
	}

	streamPdfBufferToExpressResponse(
		res: ExpressResponse,
		buf: Buffer,
		opts?: { asAttachment?: boolean; filename?: string }
	): void {
		const filename = opts?.filename?.trim() || "document.pdf"
		res.setHeader("Content-Type", "application/pdf")
		res.setHeader(
			"Content-Disposition",
			opts?.asAttachment ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`
		)
		res.setHeader("Cache-Control", "private, max-age=3600")
		res.status(200).send(buf)
	}

	private resolveDoconchainAbsoluteUrl(url: string): string | null {
		const trimmed = url.trim()
		if (!trimmed) return null
		if (/^https?:\/\//i.test(trimmed)) return trimmed
		const baseUrl = env.DOCONCHAIN_API_URL?.trim()
		if (!baseUrl) return null
		try {
			return new URL(trimmed.startsWith("/") ? trimmed : `/${trimmed}`, baseUrl).href
		} catch {
			return null
		}
	}

	/** S3 presigned URLs break when Authorization is sent (returns 400 XML). */
	private isPresignedObjectStorageUrl(url: string): boolean {
		try {
			const u = new URL(url)
			if (/amazonaws\.com$/i.test(u.hostname) || u.hostname.endsWith(".amazonaws.com")) {
				return true
			}
			return u.searchParams.has("X-Amz-Signature") || u.searchParams.has("X-Amz-Algorithm")
		} catch {
			return /X-Amz-Signature=/i.test(url)
		}
	}

	/** Download PDF bytes from a DocOnChain HTTPS URL (project file, vault redirect, S3 presign). */
	async fetchHttpsPdfBytes(pdfUrl: string, token: string): Promise<Buffer | null> {
		return this.fetchPdfBytesFromUrl(pdfUrl, token)
	}

	private async fetchPdfBytesFromUrl(pdfUrl: string, token: string): Promise<Buffer | null> {
		const resolved = this.resolveDoconchainAbsoluteUrl(pdfUrl)
		if (!resolved) return null
		const presigned = this.isPresignedObjectStorageUrl(resolved)
		const headers: Record<string, string> = presigned
			? { Accept: "application/pdf, */*" }
			: {
					"Authorization": `Bearer ${token}`,
					"user-token": token,
					"Accept": "application/pdf, application/json, */*",
				}
		try {
			const pdfRes = await fetch(resolved, { headers, redirect: "follow" })
			if (!pdfRes.ok) return null
			const contentType = pdfRes.headers.get("content-type") ?? ""
			const buf = Buffer.from(await pdfRes.arrayBuffer())
			if (buf.length >= 5 && buf.subarray(0, 4).toString("ascii") === "%PDF") return buf
			if (contentType.includes("json") || buf[0] === 0x7b) {
				try {
					const json = JSON.parse(buf.toString("utf8")) as unknown
					const embedded = extractPdfBufferFromDoconchainPayload(json)
					if (embedded) return embedded
					const nestedUrl = extractHttpsUrlFromPassportPayload(json)
					if (nestedUrl && nestedUrl !== resolved) {
						return this.fetchPdfBytesFromUrl(nestedUrl, token)
					}
				} catch {
					/* ignore */
				}
			}
			return null
		} catch {
			return null
		}
	}

	async pipeHttpsPdfToExpressResponse(
		pdfUrl: string,
		token: string,
		res: ExpressResponse,
		opts?: { asAttachment?: boolean; cacheProjectUuid?: string; filename?: string }
	): Promise<boolean> {
		const buf = await this.fetchPdfBytesFromUrl(pdfUrl, token)
		if (!buf || this.isInterimSignOnlyNotarizedPdf(buf)) return false
		if (opts?.cacheProjectUuid?.trim()) {
			void writeNotarizedPdfBytesCache(opts.cacheProjectUuid, buf)
		}
		this.streamPdfBufferToExpressResponse(res, buf, {
			asAttachment: opts?.asAttachment,
			filename: opts?.filename,
		})
		return true
	}

	/** Public for meeting vault PDF proxy and registry flows. */
	async findVaultListRowForCreateProjectId(
		token: string,
		baseUrl: string,
		projectUuid: string,
		maxPagesOverride?: number
	): Promise<{ listRowUuid: string; row: Record<string, unknown> } | null> {
		const listHost = this.doconchainVaultListHostRoot(baseUrl)
		const want = projectUuid.trim()
		const maxPages = Math.min(
			Math.max(
				1,
				typeof maxPagesOverride === "number"
					? maxPagesOverride
					: VAULT_LIST_PROJECT_UUID_LOOKUP_MAX_PAGES
			),
			VAULT_LIST_MAX_PAGES
		)
		for (const apiIntegratedMode of ["no", "yes"] as const) {
			let listLastPageFromMeta: number | undefined
			for (let page = 1; page <= maxPages; page++) {
				const qs = this.buildVaultListQueryString(page, apiIntegratedMode)
				const listCandidates = [
					`${listHost}/vault/items?${qs}`,
					`${listHost}/api/v2/vault/items?${qs}`,
				]
				let res: Response | null = null
				for (const listUrl of listCandidates) {
					const r = await fetch(listUrl, {
						headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
					})
					if (r.status === 401 || r.status === 403) return null
					if (r.ok) {
						res = r
						break
					}
					res = r
				}
				if (!res?.ok) break

				let json: { data?: Array<Record<string, unknown>>; meta?: { last_page?: number } }
				try {
					json = (await res.json()) as {
						data?: Array<Record<string, unknown>>
						meta?: { last_page?: number }
					}
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e)
					this.log.warn(
						`DC vault list (find row): invalid JSON page ${page} for …${want.slice(-12)} — ${msg.slice(0, 160)}`
					)
					break
				}
				if (
					listLastPageFromMeta === undefined &&
					typeof json.meta?.last_page === "number" &&
					json.meta.last_page >= 1
				) {
					listLastPageFromMeta = json.meta.last_page
				}
				const items = json.data ?? []
				for (const it of items) {
					const vu = this.vaultRowVaultItemUuid(it)
					if (vu && this.vaultStoredIdMatchesVaultListRow(want, it)) {
						return { listRowUuid: vu.trim(), row: it }
					}
				}
				if (listLastPageFromMeta !== undefined && page >= listLastPageFromMeta) break
				if (items.length < VAULT_LIST_PER_PAGE) break
			}
		}
		return null
	}

	/**
	 * DocOnChain **Get Specific Project In Vault** query strings (see DC docs): official example is only
	 * `user_type=ENTERPRISE_API`. Some stacks need `category_id` / `client_id` from the list row — try **doc-first**
	 * minimal query, then extended, so we do not skip a 200 body with `url` / `files[].file_url` when extra params confuse the route.
	 */
	private buildVaultItemDetailQueryVariants(listRow?: Record<string, unknown>): string[] {
		const minimal = new URLSearchParams({ user_type: "ENTERPRISE_API" }).toString()
		if (!listRow) return [minimal]
		const p = new URLSearchParams({ user_type: "ENTERPRISE_API" })
		const cidRaw = listRow.category_id ?? listRow.categoryId
		const clidRaw = listRow.client_id ?? listRow.clientId
		if (cidRaw !== undefined && cidRaw !== null && String(cidRaw).trim() !== "") {
			p.set("category_id", String(cidRaw).trim())
		}
		if (clidRaw !== undefined && clidRaw !== null && String(clidRaw).trim() !== "") {
			p.set("client_id", String(clidRaw).trim())
		}
		const extended = p.toString()
		return extended === minimal ? [minimal] : [minimal, extended]
	}

	/**
	 * DocOnChain **Get Specific Project In Vault** (enterprise API):
	 * `GET https://{host}/vault/items/{uuid}?user_type=ENTERPRISE_API` — same path is tried first; then
	 * `GET {host}/api/v2/vault/items/{uuid}?…` if the host-root mount differs on a stack.
	 * Published docs describe `{uuid}` as the **project** id (`project_uuid`); **staging** sometimes needs the vault list row `uuid` from `GET /vault/items` (see {@link findVaultListRowForCreateProjectId}).
	 * **401 / 403:** caller should try another token / ENP email; this method tries every query + URL combination before returning the last response (minimal `user_type` may succeed where extended params returned 401 on some stacks).
	 * Uses {@link doconchainVaultListHostRoot} so `DOCONCHAIN_API_URL` may end with `/api/v2` without doubling the path.
	 */
	private async vaultDetailFetch(
		token: string,
		apiBaseUrl: string,
		projectOrFallbackUuid: string,
		listRow?: Record<string, unknown>
	): Promise<Response> {
		const listHost = this.doconchainVaultListHostRoot(apiBaseUrl)
		const enc = encodeURIComponent(projectOrFallbackUuid)
		const bases = [`${listHost}/vault/items/${enc}`, `${listHost}/api/v2/vault/items/${enc}`]
		const variants = this.buildVaultItemDetailQueryVariants(listRow)
		const headers = {
			Authorization: `Bearer ${token}`,
			Accept: "application/json",
		} as const
		let last: Response | null = null
		for (const base of bases) {
			for (const qs of variants) {
				const url = `${base}?${qs}`
				const res = await fetch(url, { headers })
				last = res
				if (res.ok) return res
				if (res.status === 404 || res.status === 400) continue
				if (res.status >= 500 && res.status < 600) continue
				if (res.status === 401 || res.status === 403) continue
				return res
			}
		}
		return last!
	}

	/**
	 * Some environments omit HTTPS URLs on vault list/detail JSON but expose a download route (redirect or JSON link).
	 */
	private absolutizeDcLocation(root: string, locRaw: string): string | undefined {
		const loc = locRaw.trim()
		if (/^https?:\/\//i.test(loc)) return loc
		if (loc.startsWith("//")) return `https:${loc}`
		if (loc.startsWith("/")) {
			const abs = `${root.replace(/\/$/, "")}${loc}`
			if (/^https?:\/\//i.test(abs)) return abs
		}
		return undefined
	}

	/**
	 * GET vault sealed PDF. Tries **host-root** `GET /vault/items/{slug}/…` (same tree as list/detail) and **`/api/v2/vault/items/…`**
	 * on stacks that only mount routes under the versioned prefix. Several path suffixes are probed because staging has returned
	 * `E_ROUTE_NOT_FOUND` for `/api/v2/vault/items/{id}/download` while other shapes exist on other stacks.
	 */
	private vaultDownloadCandidateUrls(
		apiBaseUrl: string,
		vaultSlug: string,
		vaultRow?: Record<string, unknown>
	): string[] {
		const listHost = this.doconchainVaultListHostRoot(apiBaseUrl).replace(/\/$/, "")
		const apiV2 = this.doconchainApiV2Prefix(apiBaseUrl).replace(/\/$/, "")
		const enc = encodeURIComponent(vaultSlug)
		// Staging returns E_ROUTE_NOT_FOUND for /document/download and /sealed/download — only probe /download.
		const pathSuffixes = [`/vault/items/${enc}/download`]
		const urls: string[] = []
		const cidRaw = vaultRow?.category_id ?? vaultRow?.categoryId
		const clidRaw = vaultRow?.client_id ?? vaultRow?.clientId
		const cid =
			cidRaw !== undefined && cidRaw !== null && String(cidRaw).trim() !== "" ? String(cidRaw) : ""
		const clid =
			clidRaw !== undefined && clidRaw !== null && String(clidRaw).trim() !== ""
				? String(clidRaw)
				: ""

		const paramSets: Record<string, string>[] = [{ user_type: "ENTERPRISE_API" }]
		if (cid) paramSets.push({ user_type: "ENTERPRISE_API", category_id: cid })
		if (clid) paramSets.push({ user_type: "ENTERPRISE_API", client_id: clid })
		if (cid && clid)
			paramSets.push({ user_type: "ENTERPRISE_API", category_id: cid, client_id: clid })

		const roots = listHost === apiV2 ? [listHost] : [...new Set([listHost, apiV2])]
		for (const pathSuffix of pathSuffixes) {
			for (const root of roots) {
				for (const params of paramSets) {
					const u = new URL(`${root}${pathSuffix}`)
					for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
					urls.push(u.toString())
				}
			}
		}
		return [...new Set(urls)]
	}

	private recordDownloadDiag(
		diag: DcDownloadProbeDiag | undefined,
		res: Response,
		method: string,
		url: string,
		raw: string
	): void {
		if (!diag) return
		const entry: DcDownloadProbeEntry = {
			status: res.status,
			method,
			url: url.length > 180 ? `…${url.slice(-140)}` : url,
			snippet: raw.replace(/\s+/g, " ").slice(0, 160),
		}
		diag.last = entry
		if (url.includes("/api/v2/")) diag.lastApiV2Mount = entry
		else diag.lastHostMount = entry
	}

	/**
	 * Single GET URL: manual redirect, JSON link extraction, then follow redirect (same behavior as vault download probes).
	 */
	private async tryGetSealedPdfFromSingleDownloadUrl(
		token: string,
		url: string,
		absolutizeRoot: string,
		diag?: DcDownloadProbeDiag
	): Promise<string | undefined> {
		const headers = {
			Authorization: `Bearer ${token}`,
			Accept: "application/json, application/pdf, */*",
		} as const
		try {
			const res = await fetch(url, { method: "GET", headers, redirect: "manual" })
			const locHdr = res.headers.get("location")
			const locTrim = locHdr?.trim()
			if (locTrim) {
				const absLoc = /^https?:\/\//i.test(locTrim)
					? locTrim
					: this.absolutizeDcLocation(absolutizeRoot, locHdr!)
				if (absLoc) return absLoc
			}
			const raw = await res.text().catch(() => "")
			if (!res.ok) {
				this.recordDownloadDiag(diag, res, "GET", url, raw)
				if (res.status === 404 || res.status === 400) return undefined
			} else {
				const fromJson = this.parseDownloadJsonBody(raw, absolutizeRoot)
				if (fromJson) return fromJson
			}
			try {
				const resFollow = await fetch(url, { method: "GET", headers, redirect: "follow" })
				const finalUrl = resFollow.url
				const rawFollow = await resFollow.text().catch(() => "")
				if (!resFollow.ok) this.recordDownloadDiag(diag, resFollow, "GET+follow", url, rawFollow)
				else {
					let leftOrigin = false
					try {
						leftOrigin = new URL(finalUrl).origin !== new URL(url).origin
					} catch {
						leftOrigin = false
					}
					if (leftOrigin && finalUrl.startsWith("http")) return finalUrl
					const fromJsonFollow = this.parseDownloadJsonBody(rawFollow, absolutizeRoot)
					if (fromJsonFollow) return fromJsonFollow
				}
			} catch {
				/* continue */
			}
		} catch {
			/* continue */
		}
		return undefined
	}

	/**
	 * Some staging stacks expose the sealed PDF at project scope (`GET …/api/v2/projects/{uuid}/download`) instead of vault item download.
	 */
	private async tryProjectSealedPdfFromDownloadEndpoints(
		token: string,
		apiBaseUrl: string,
		projectUuid: string,
		diag?: DcDownloadProbeDiag
	): Promise<string | undefined> {
		const apiPrefix = this.doconchainApiV2Prefix(apiBaseUrl)
		const listHost = this.doconchainVaultListHostRoot(apiBaseUrl)
		const enc = encodeURIComponent(projectUuid)
		const qs = new URLSearchParams({ user_type: "ENTERPRISE_API" }).toString()
		// Do not use `${listHost}/projects/.../download` or `/sealed/download` — staging returns E_ROUTE_NOT_FOUND.
		const candidates = [`${apiPrefix}/projects/${enc}/download?${qs}`]
		for (const url of candidates) {
			const hit = await this.tryGetSealedPdfFromSingleDownloadUrl(token, url, listHost, diag)
			if (hit?.startsWith("http") && this.isSealedNotarizedPdfUrl(hit)) return hit
		}
		return undefined
	}

	private parseDownloadJsonBody(raw: string, root: string): string | undefined {
		let j: unknown
		try {
			j = JSON.parse(raw) as unknown
		} catch {
			return undefined
		}
		const link = this.extractDoconchainLinkPayload(j)
		if (link) return link
		const d = (j as { data?: unknown }).data
		if (d && typeof d === "object") {
			const nested =
				this.extractVaultDocumentUrlDeep(d, 6, root) ??
				this.extractVaultDocumentUrl(d as Record<string, unknown>)
			if (nested?.startsWith("http")) return nested
		}
		return undefined
	}

	/**
	 * **GET only** on `{host}/vault/items/{slug}/download?user_type=ENTERPRISE_API` (+ optional category_id/client_id).
	 * Use `redirect: "manual"` then `redirect: "follow"` to capture `Location` / final URL (e.g. S3).
	 */
	private async tryVaultSealedPdfFromDownloadEndpoints(
		token: string,
		apiBaseUrl: string,
		itemSlugs: string[],
		vaultRow?: Record<string, unknown>,
		diag?: DcDownloadProbeDiag
	): Promise<string | undefined> {
		const listHost = this.doconchainVaultListHostRoot(apiBaseUrl)

		const slugs = [...new Set(itemSlugs.map(s => String(s).trim()).filter(Boolean))]
		for (const vaultSlug of slugs) {
			const candidates = this.vaultDownloadCandidateUrls(apiBaseUrl, vaultSlug, vaultRow)
			for (const url of candidates) {
				const hit = await this.tryGetSealedPdfFromSingleDownloadUrl(token, url, listHost, diag)
				if (hit?.startsWith("http") && this.isSealedNotarizedPdfUrl(hit)) return hit
			}
		}
		return undefined
	}

	private finalizeVaultRowForPdf(
		row: Record<string, unknown>,
		projectUuid: string,
		resolvedVia: string,
		apiRoot: string
	): DoconchainVaultPdfOutcome {
		if (!this.vaultItemStrictlyCompleted(row)) {
			const st = row.status !== undefined && row.status !== null ? String(row.status) : "null"
			return {
				outcome: "still_sealing",
				detail: `Vault status is not definitively completed (${st}). Sealing/notarization may still be processing — retry shortly.`,
			}
		}
		const url =
			this.extractNotarizedPdfUrlFromVaultRecord(row) ??
			this.extractVaultDocumentUrlDeep(row, 8, apiRoot) ??
			this.extractVaultDocumentUrl(row)
		if (
			!url ||
			this.isLikelyPreSealVaultPdfUrl(url) ||
			this.isLikelyInterimSignedWithoutNotarialSeal(url)
		) {
			if (
				url &&
				(this.isLikelyPreSealVaultPdfUrl(url) || this.isLikelyInterimSignedWithoutNotarialSeal(url))
			) {
				this.log.debug(
					`DC vault ${resolvedVia}: row URL looks interim (${url.slice(0, 80)}…) — probing vault/project download for sealed PDF`
				)
			} else {
				this.logVaultMissingUrl(`DC vault ${resolvedVia}`, projectUuid, row, {
					dumpFullJson: resolvedVia === "detail",
				})
			}
			return {
				outcome: "ready_but_no_download_url",
				detail:
					url &&
					(this.isLikelyPreSealVaultPdfUrl(url) ||
						this.isLikelyInterimSignedWithoutNotarialSeal(url))
						? "Vault row only exposed a pre-seal or sign-only PDF URL — try vault download or wait for Document Completed."
						: "DocOnChain vault row appears completed but no HTTPS PDF URL was found — check staging field names (see server log keySample).",
				keySample: this.vaultPayloadKeySample(row),
			}
		}
		this.logResolvedNotarizedPdf(`vault_row_url_fields:${resolvedVia}`, projectUuid, url, row)
		return { outcome: "ok", signedPdfUrl: url, doconchainProjectUuid: projectUuid }
	}

	/**
	 * Full vault resolution for one **create-project** id: the same string stored as `doconchainProjectUuid` from `POST /api/v2/projects` (`data.uuid`).
	 * **DocOnChain pattern:** `GET /vault/items/{id}` is tried first with that id; when DC responds “not found” (400/404 / message), we page `GET /vault/items`, find the row where `project_uuid` matches (with short-ref prefix tolerance), then call **get specific** again with that row’s **`uuid`** plus **`category_id` / `client_id`** query params from the list row when present (may avoid staging `500 findOrganization`). The list row `uuid` is never persisted as `doconchainProjectUuid`.
	 */
	async resolveVaultNotarizedPdf(args: {
		token: string
		/** Create-project `data.uuid` / DB `doconchainProjectUuid` — not a plotted/signing-only id, not the vault list row `uuid`. */
		projectUuid: string
		/**
		 * Max `GET /vault/items` pages for this resolution (default {@link VAULT_LIST_MAX_PAGES}).
		 * Lower for latency-sensitive HTTP handlers (meeting signers) to reduce proxy timeouts while still probing recent vault rows.
		 */
		maxVaultListPages?: number
	}): Promise<DoconchainVaultPdfOutcome> {
		const baseUrl = env.DOCONCHAIN_API_URL
		if (!baseUrl || args.token.startsWith("mock_dc_token_")) {
			return { outcome: "vault_item_not_found", detail: "DocOnChain not configured or mock token" }
		}
		const root = baseUrl.replace(/\/$/, "")
		/** Host for vault HTTP only (strips trailing `/api/v2`). Use for resolving relative PDF paths — not the versioned project API base. */
		const vaultPublicRoot = this.doconchainVaultListHostRoot(baseUrl)
		const { token, projectUuid } = args
		const listPageCap = Math.min(
			Math.max(1, args.maxVaultListPages ?? VAULT_LIST_MAX_PAGES),
			VAULT_LIST_MAX_PAGES
		)
		let detailHadProjectMismatch = false

		try {
			let res = await this.vaultDetailFetch(token, root, projectUuid)
			const firstDetailStatus = res.status
			let detailBody: string | null = null

			if (res.ok) {
				detailBody = await res.text()
			} else if (res.status === 401 || res.status === 403) {
				const t = await res.text().catch(() => "")
				this.logDcVerbose(
					`DC vault detail HTTP ${res.status} for create-project id …${projectUuid.slice(-12)} (${t.slice(0, 120)}) — continuing with vault list + download probes.`
				)
				// Same token can still list the row; retry Get Specific with **list folder context** on the project id (minimal vs extended query order is handled inside {@link vaultDetailFetch}).
				try {
					const hit401 = await this.findVaultListRowForCreateProjectId(
						token,
						baseUrl,
						projectUuid,
						listPageCap
					)
					if (hit401) {
						const res2 = await this.vaultDetailFetch(token, root, projectUuid, hit401.row)
						if (res2.ok) {
							detailBody = await res2.text()
						}
					}
				} catch {
					/* fall through to vault list scan */
				}
			} else {
				const errText = await res.text().catch(() => "")
				const notFoundish = this.vaultDetailResponseLooksNotFound(res, errText)
				if (notFoundish) {
					const listHit = await this.findVaultListRowForCreateProjectId(
						token,
						baseUrl,
						projectUuid,
						listPageCap
					)
					if (listHit) {
						this.logDcVerbose(
							`DC vault detail: create-project id not found; retrying with list row context …${listHit.listRowUuid.slice(-12)}`
						)
						res = await this.vaultDetailFetch(token, root, projectUuid, listHit.row)
						if (res.ok) {
							detailBody = await res.text()
						} else {
							const errWithCtx = await res.text().catch(() => "")
							const tryRowSegment =
								this.vaultDetailResponseLooksNotFound(res, errWithCtx) ||
								(res.status >= 500 && res.status < 600) ||
								res.status === 401 ||
								res.status === 403
							if (tryRowSegment) {
								res = await this.vaultDetailFetch(token, root, listHit.listRowUuid, listHit.row)
								if (res.ok) {
									detailBody = await res.text()
								} else {
									const t2 = await res.text().catch(() => "")
									const t2c = t2.replace(/\s+/g, " ")
									if (
										res.status >= 500 &&
										res.status < 600 &&
										t2c.toLowerCase().includes("findorganization")
									) {
										this.logDcVerbose(
											`DC vault detail (after list uuid): HTTP ${res.status} findOrganization — continuing. ${t2c.slice(0, 120)}`
										)
									} else if (
										res.status !== 400 &&
										res.status !== 404 &&
										res.status !== 401 &&
										res.status !== 403
									) {
										this.log.warn(
											`DC vault detail (after list uuid): HTTP ${res.status} ${t2c.slice(0, 180)}`
										)
									}
								}
							}
						}
					} else {
						this.logVaultDiagOnce(
							`vault-not-found:${projectUuid.slice(-12)}`,
							`DC vault detail: not found for create-project id …${projectUuid.slice(-12)} after ${listPageCap} list page(s).`,
							"warn"
						)
					}
				}
				if (
					!detailBody &&
					firstDetailStatus !== 401 &&
					firstDetailStatus !== 403 &&
					firstDetailStatus !== 400 &&
					firstDetailStatus !== 404
				) {
					this.log.warn(
						`DC vault detail ${projectUuid}: HTTP ${firstDetailStatus} ${errText.slice(0, 160)}`
					)
				}
			}

			if (detailBody) {
				const data = this.parseVaultDetailData(detailBody)
				if (data) {
					const rowPu = this.vaultRowProjectUuid(data)
					if (rowPu && !this.vaultIdsEquivalent(rowPu, projectUuid)) {
						detailHadProjectMismatch = true
						this.log.warn(
							`DC vault: stored id …${projectUuid.slice(-12)} resolves to different project_uuid=${rowPu.slice(0, 12)}… — using vault list`
						)
					} else {
						const finalized = this.finalizeVaultRowForPdf(
							data,
							projectUuid,
							"detail",
							vaultPublicRoot
						)
						if (finalized.outcome === "ok") return finalized
						if (finalized.outcome === "still_sealing") return finalized
						if (finalized.outcome === "ready_but_no_download_url") {
							const fromEnvelope = this.extractHttpsPdfFromVaultDetailJsonBody(
								detailBody,
								vaultPublicRoot
							)
							if (fromEnvelope?.startsWith("http") && this.isSealedNotarizedPdfUrl(fromEnvelope)) {
								this.logResolvedNotarizedPdf(
									"detail_json_envelope_https_scan",
									projectUuid,
									fromEnvelope,
									data
								)
								return {
									outcome: "ok",
									signedPdfUrl: fromEnvelope,
									doconchainProjectUuid: projectUuid,
								}
							}
							/** Prefer vault HTTP download before `GET …/projects/{uuid}` — project payloads often expose `file-reference-*` (signed) before notarial seal is on the vault object. */
							const slugs = this.buildVaultItemDownloadSlugs(projectUuid, data)
							const fromDl = await this.tryVaultSealedPdfFromDownloadEndpoints(
								token,
								baseUrl,
								slugs,
								data
							)
							if (fromDl?.startsWith("http") && this.isSealedNotarizedPdfUrl(fromDl)) {
								this.logResolvedNotarizedPdf(
									"detail_fallback_vault_item_download",
									projectUuid,
									fromDl,
									data
								)
								return {
									outcome: "ok",
									signedPdfUrl: fromDl,
									doconchainProjectUuid: projectUuid,
								}
							}
							const fromProjectGet = await this.tryFetchSealedPdfUrlFromProjectGet(
								token,
								baseUrl,
								projectUuid
							)
							if (fromProjectGet?.startsWith("http")) {
								this.logResolvedNotarizedPdf(
									"detail_fallback_project_get",
									projectUuid,
									fromProjectGet,
									data
								)
								return {
									outcome: "ok",
									signedPdfUrl: fromProjectGet,
									doconchainProjectUuid: projectUuid,
								}
							}
							const fromProject = await this.tryProjectSealedPdfFromDownloadEndpoints(
								token,
								baseUrl,
								projectUuid
							)
							if (fromProject?.startsWith("http")) {
								this.logResolvedNotarizedPdf(
									"detail_fallback_project_download_endpoints",
									projectUuid,
									fromProject,
									data
								)
								return {
									outcome: "ok",
									signedPdfUrl: fromProject,
									doconchainProjectUuid: projectUuid,
								}
							}
							/* list scan below often has numeric `id` + download route when detail JSON lacks a URL */
						}
					}
				}
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.warn(`DC vault detail failed ${projectUuid}: ${msg.slice(0, 200)}`)
		}

		type ListMatch = Record<string, unknown>
		let listUnauthorized: DoconchainVaultPdfOutcome | null = null
		const matches: ListMatch[] = []

		const listHost = vaultPublicRoot

		listScan: for (const apiIntegratedMode of ["no", "yes"] as const) {
			if (apiIntegratedMode === "yes" && matches.length > 0) break
			let listLastPageFromMeta: number | undefined
			for (let page = 1; page <= listPageCap; page++) {
				const qs = this.buildVaultListQueryString(page, apiIntegratedMode)
				// Doc: **Get Projects In Vault** — `GET {host}/vault/items?user_type=ENTERPRISE_API&per_page&page&user_items_only&api_integrated_projects_only`
				const listCandidates = [
					`${listHost}/vault/items?${qs}`,
					`${listHost}/api/v2/vault/items?${qs}`,
				]
				let res: Response | null = null
				for (const listUrl of listCandidates) {
					const r = await fetch(listUrl, {
						headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
					})
					if (r.status === 401 || r.status === 403) {
						const t = await r.text().catch(() => "")
						listUnauthorized = {
							outcome: "unauthorized",
							httpStatus: r.status,
							detail: `DocOnChain vault list unauthorized (${r.status}). ${t.slice(0, 200)} — Bearer must be the same DC user that owns these vault rows (token mint email, DOCONCHAIN_API_TOKEN, org/sub-org).`,
						}
						res = r
						break
					}
					if (r.ok) {
						res = r
						break
					}
					res = r
				}
				if (listUnauthorized) break listScan
				if (!res?.ok) break

				let json: {
					data?: Array<Record<string, unknown>>
					meta?: { last_page?: number; per_page?: number; current_page?: number; total?: number }
				}
				try {
					json = (await res.json()) as {
						data?: Array<Record<string, unknown>>
						meta?: { last_page?: number; per_page?: number; current_page?: number; total?: number }
					}
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e)
					this.log.warn(
						`DC vault list: invalid JSON on page ${page} for project …${projectUuid.slice(-12)} — ${msg.slice(0, 160)}`
					)
					break
				}
				if (
					listLastPageFromMeta === undefined &&
					typeof json.meta?.last_page === "number" &&
					json.meta.last_page >= 1
				) {
					listLastPageFromMeta = json.meta.last_page
				}
				const items = json.data ?? []
				for (const item of items) {
					if (!this.vaultStoredIdMatchesVaultListRow(projectUuid, item)) continue
					matches.push(item)

					let rowForPdf = item
					const hasUrlDeep =
						Boolean(this.extractVaultDocumentUrlDeep(item, 8, vaultPublicRoot)) ||
						Boolean(this.extractVaultDocumentUrl(item))
					// Vault detail: Doc path param is **project_uuid**; merge list row folder context for every try (category_id/client_id were previously omitted for the primary project id).
					if (this.vaultItemStrictlyCompleted(item) && !hasUrlDeep) {
						const rowVaultUuid = this.vaultRowVaultItemUuid(item)
						const detailIdsOrdered: string[] = []
						const pushDetailId = (s: string | undefined) => {
							const t = s?.trim()
							if (t && !detailIdsOrdered.includes(t)) detailIdsOrdered.push(t)
						}
						pushDetailId(projectUuid)
						pushDetailId(this.vaultRowProjectUuid(item))
						pushDetailId(rowVaultUuid)
						for (const tryId of detailIdsOrdered) {
							try {
								const dres = await this.vaultDetailFetch(token, root, tryId, item)
								if (!dres.ok) continue
								const raw = await dres.text()
								const nested = this.parseVaultDetailData(raw)
								const fromEnvelope = this.extractHttpsPdfFromVaultDetailJsonBody(
									raw,
									vaultPublicRoot
								)
								if (!nested && !fromEnvelope) continue
								const merged = { ...item, ...(nested ?? {}) } as Record<string, unknown>
								if (fromEnvelope) {
									const has = Boolean(
										this.extractVaultDocumentUrl(merged) ||
										this.extractVaultDocumentUrlDeep(merged, 4, vaultPublicRoot)
									)
									if (!has) merged.url = fromEnvelope
								}
								rowForPdf = merged
								break
							} catch {
								/* try next id or keep list row */
							}
						}
					}

					const o = this.finalizeVaultRowForPdf(rowForPdf, projectUuid, "list", vaultPublicRoot)
					if (o.outcome === "ok") return o
					if (o.outcome === "still_sealing") continue
					if (o.outcome === "ready_but_no_download_url") {
						/** Same ordering as detail fallback: vault download tends to carry the sealed notarial PDF; project GET often returns `file-reference-*` (interim signed). */
						const slugs = this.buildVaultItemDownloadSlugs(projectUuid, rowForPdf)
						const fromDl = await this.tryVaultSealedPdfFromDownloadEndpoints(
							token,
							baseUrl,
							slugs,
							rowForPdf
						)
						if (fromDl?.startsWith("http") && this.isSealedNotarizedPdfUrl(fromDl)) {
							this.logResolvedNotarizedPdf(
								"list_row_fallback_vault_item_download",
								projectUuid,
								fromDl,
								rowForPdf
							)
							return {
								outcome: "ok",
								signedPdfUrl: fromDl,
								doconchainProjectUuid: projectUuid,
							}
						}
						this.log.warn(
							`DC vault download: no sealed PDF redirect for …${projectUuid.slice(-12)} (slugs=${slugs.length}) — will not use sign-only project GET`
						)
						const fromProjectGet = await this.tryFetchSealedPdfUrlFromProjectGet(
							token,
							baseUrl,
							projectUuid
						)
						if (fromProjectGet?.startsWith("http")) {
							this.logResolvedNotarizedPdf(
								"list_row_fallback_project_get",
								projectUuid,
								fromProjectGet,
								rowForPdf
							)
							return {
								outcome: "ok",
								signedPdfUrl: fromProjectGet,
								doconchainProjectUuid: projectUuid,
							}
						}
						const fromProjectDl = await this.tryProjectSealedPdfFromDownloadEndpoints(
							token,
							baseUrl,
							projectUuid
						)
						if (fromProjectDl?.startsWith("http")) {
							this.logResolvedNotarizedPdf(
								"list_row_fallback_project_download_endpoints",
								projectUuid,
								fromProjectDl,
								rowForPdf
							)
							return {
								outcome: "ok",
								signedPdfUrl: fromProjectDl,
								doconchainProjectUuid: projectUuid,
							}
						}
						continue
					}
				}
				if (listLastPageFromMeta !== undefined && page >= listLastPageFromMeta) break
				if (items.length < VAULT_LIST_PER_PAGE) break
			}
		}

		if (listUnauthorized) return listUnauthorized
		if (matches.length === 0) {
			const fromProjectNoList = await this.tryProjectSealedPdfFromDownloadEndpoints(
				token,
				baseUrl,
				projectUuid
			)
			if (fromProjectNoList?.startsWith("http")) {
				this.logResolvedNotarizedPdf(
					"no_list_match_project_download_endpoints",
					projectUuid,
					fromProjectNoList
				)
				return {
					outcome: "ok",
					signedPdfUrl: fromProjectNoList,
					doconchainProjectUuid: projectUuid,
				}
			}
			const fromProjectGetNoList = await this.tryFetchSealedPdfUrlFromProjectGet(
				token,
				baseUrl,
				projectUuid
			)
			if (fromProjectGetNoList?.startsWith("http")) {
				this.logResolvedNotarizedPdf("no_list_match_project_get", projectUuid, fromProjectGetNoList)
				return {
					outcome: "ok",
					signedPdfUrl: fromProjectGetNoList,
					doconchainProjectUuid: projectUuid,
				}
			}
			if (detailHadProjectMismatch) {
				return {
					outcome: "stored_uuid_mismatches_vault_project",
					detail:
						"Stored DocOnChain id does not match vault project_uuid for this row, and no vault list row matched the stored project UUID. Fix doconchainProjectUuid on this act.",
				}
			}
			return {
				outcome: "vault_item_not_found",
				detail:
					"No vault list row matched this project UUID yet (wrong id in DB vs DocOnChain, or vault not synced). Retry after completion.",
			}
		}
		const anyCompleted = matches.some(m => this.vaultItemStrictlyCompleted(m))
		if (!anyCompleted) {
			return {
				outcome: "still_sealing",
				detail:
					"This project appears in the vault list but nothing is marked completed yet — wait for sealing, then retry.",
			}
		}
		const primary = matches.find(m => this.vaultItemStrictlyCompleted(m)) ?? matches[0]!
		const vaultDlDiag: DcDownloadProbeDiag = {}
		const projectDlDiag: DcDownloadProbeDiag = {}
		const fromDownload = await this.tryVaultSealedPdfFromDownloadEndpoints(
			token,
			baseUrl,
			this.buildVaultItemDownloadSlugs(projectUuid, primary),
			primary,
			vaultDlDiag
		)
		if (fromDownload?.startsWith("http")) {
			this.logResolvedNotarizedPdf(
				"aggregate_vault_item_download",
				projectUuid,
				fromDownload,
				primary
			)
			return { outcome: "ok", signedPdfUrl: fromDownload, doconchainProjectUuid: projectUuid }
		}
		const fromProjectGetAgg = await this.tryFetchSealedPdfUrlFromProjectGet(
			token,
			baseUrl,
			projectUuid
		)
		if (fromProjectGetAgg?.startsWith("http")) {
			this.logResolvedNotarizedPdf("aggregate_project_get", projectUuid, fromProjectGetAgg, primary)
			return { outcome: "ok", signedPdfUrl: fromProjectGetAgg, doconchainProjectUuid: projectUuid }
		}
		const fromProjectAgg = await this.tryProjectSealedPdfFromDownloadEndpoints(
			token,
			baseUrl,
			projectUuid,
			projectDlDiag
		)
		if (fromProjectAgg?.startsWith("http")) {
			this.logResolvedNotarizedPdf(
				"aggregate_project_download_endpoints",
				projectUuid,
				fromProjectAgg,
				primary
			)
			return { outcome: "ok", signedPdfUrl: fromProjectAgg, doconchainProjectUuid: projectUuid }
		}
		this.logVaultRowJsonBlock("vault_list_aggregate_primary_row", projectUuid, primary)
		const probeSummary = [
			vaultDlDiag.lastApiV2Mount ?? vaultDlDiag.lastHostMount ?? vaultDlDiag.last,
			projectDlDiag.lastApiV2Mount ?? projectDlDiag.lastHostMount ?? projectDlDiag.last,
		]
			.filter((p): p is DcDownloadProbeEntry => Boolean(p))
			.map(p => `HTTP ${p.status} ${p.method} ${p.url}`)
			.join(" | ")
		this.logVaultDiagOnce(
			`vault-download-miss:${projectUuid.slice(-12)}`,
			`DocOnChain vault download probes missed for …${projectUuid.slice(-12)}${probeSummary ? ` (${probeSummary})` : ""}`,
			env.DOCONCHAIN_VERBOSE_LOGS === "true" ? "warn" : "debug"
		)
		return {
			outcome: "ready_but_no_download_url",
			detail:
				"Vault rows matched this project and look completed, but no HTTPS PDF URL was parsed. Inspect DC payload shapes in staging.",
			keySample: this.vaultPayloadKeySample(matches[0]!),
		}
	}

	/**
	 * Same as {@link fetchVaultItemForProject} but returns the full {@link DoconchainVaultPdfOutcome} for 401 handling / metrics.
	 */
	async fetchVaultItemForProjectWithOutcome(args: {
		token: string
		projectUuid: string
		maxVaultListPages?: number
	}): Promise<{
		result: { doconchainProjectUuid: string; signedPdfUrl?: string } | null
		outcome: DoconchainVaultPdfOutcome
	}> {
		const r = await this.resolveVaultNotarizedPdf(args)
		if (r.outcome === "ok") {
			return {
				result: { doconchainProjectUuid: r.doconchainProjectUuid, signedPdfUrl: r.signedPdfUrl },
				outcome: r,
			}
		}
		const tail =
			args.projectUuid.length <= 14 ? args.projectUuid : `…${args.projectUuid.slice(-14)}`
		if (r.outcome === "unauthorized") {
			this.log.warn(
				`fetchVaultItemForProject: DC unauthorized HTTP ${r.httpStatus} (${tail}) — vault list/detail token does not match DocOnChain user that owns this vault (check DOCONCHAIN_API_TOKEN vs project creator, ENP email used for generate/token, DOCONCHAIN_ORG_EMAIL / sub-org).`
			)
		} else if (r.outcome === "ready_but_no_download_url") {
			this.log.warn(
				`fetchVaultItemForProject: (${tail}) ${r.detail} keys=${r.keySample} — full vault row JSON was emitted above between DC_VAULT_ROW_JSON_BEGIN and DC_VAULT_ROW_JSON_END`
			)
		} else {
			const detail = "detail" in r ? r.detail : ""
			this.log.warn(
				`fetchVaultItemForProject: outcome=${r.outcome} (${tail}) ${detail.slice(0, 240)}`
			)
		}
		return { result: null, outcome: r }
	}

	private getMeetingNotarizedPdfCache(
		projectUuid: string
	): MeetingNotarizedPdfCacheEntry | undefined {
		const hit = this.meetingNotarizedPdfCache.get(projectUuid.trim())
		if (!hit) return undefined
		if (hit.expiresAt <= Date.now()) {
			this.meetingNotarizedPdfCache.delete(projectUuid.trim())
			return undefined
		}
		return hit
	}

	private setMeetingNotarizedPdfCache(
		projectUuid: string,
		url: string | null,
		opts?: { vaultAttempted?: boolean }
	) {
		const key = projectUuid.trim()
		const prev = this.meetingNotarizedPdfCache.get(key)
		const now = Date.now()
		this.meetingNotarizedPdfCache.set(key, {
			url,
			expiresAt: now + (url ? MEETING_NOTARIZED_PDF_CACHE_TTL_MS : 20_000),
			lastVaultAttemptAt: opts?.vaultAttempted ? now : (prev?.lastVaultAttemptAt ?? 0),
		})
	}

	/** Download sealed PDF bytes via vault `GET /vault/items/{slug}/download`. */
	private async tryDownloadVaultPdfBytes(args: {
		token: string
		baseUrl: string
		slug: string
		vaultRow?: Record<string, unknown>
	}): Promise<Buffer | null> {
		const listHost = this.doconchainVaultListHostRoot(args.baseUrl)
		const headers = {
			Authorization: `Bearer ${args.token}`,
			Accept: "application/pdf, application/json, */*",
		} as const
		const candidates = this.vaultDownloadCandidateUrls(args.baseUrl, args.slug, args.vaultRow)
		for (const url of candidates) {
			let dcRes: globalThis.Response
			try {
				dcRes = await fetch(url, { method: "GET", headers, redirect: "follow" })
			} catch {
				continue
			}
			if (!dcRes.ok) continue
			const buf = Buffer.from(await dcRes.arrayBuffer())
			if (buf.length >= 5 && buf.subarray(0, 4).toString("ascii") === "%PDF") {
				return buf
			}
			const fromJson = this.parseDownloadJsonBody(buf.toString("utf8"), listHost)
			if (!fromJson?.startsWith("http")) continue
			try {
				const s3 = await fetch(fromJson, { headers, redirect: "follow" })
				if (!s3.ok) continue
				const s3buf = Buffer.from(await s3.arrayBuffer())
				if (s3buf.subarray(0, 4).toString("ascii") === "%PDF") return s3buf
			} catch {
				continue
			}
		}
		return null
	}

	/**
	 * Stream sealed PDF via `GET /vault/items/{slug}/download` (legacy quanby path).
	 * `slug` is either the persisted create-project id (`doconchainProjectUuid`) or the vault list row `uuid` from {@link findVaultListRowForCreateProjectId} — never stored in DB.
	 */
	private async tryStreamVaultDownloadSlug(args: {
		token: string
		baseUrl: string
		projectUuid: string
		slug: string
		vaultRow?: Record<string, unknown>
		res: ExpressResponse
		disposition: string
	}): Promise<boolean> {
		const listHost = this.doconchainVaultListHostRoot(args.baseUrl)
		const headers = {
			Authorization: `Bearer ${args.token}`,
			Accept: "application/pdf, application/json, */*",
		} as const
		const candidates = this.vaultDownloadCandidateUrls(args.baseUrl, args.slug, args.vaultRow)
		for (const url of candidates) {
			let dcRes: globalThis.Response
			try {
				dcRes = await fetch(url, { method: "GET", headers, redirect: "follow" })
			} catch {
				continue
			}
			if (!dcRes.ok) continue
			const ct = (dcRes.headers.get("content-type") ?? "").toLowerCase()
			const buf = Buffer.from(await dcRes.arrayBuffer())
			if (buf.length < 5 || buf.subarray(0, 4).toString("ascii") !== "%PDF") {
				const fromJson = this.parseDownloadJsonBody(buf.toString("utf8"), listHost)
				if (fromJson?.startsWith("http")) {
					try {
						const s3buf = await this.fetchPdfBytesFromUrl(fromJson, args.token)
						if (!s3buf || s3buf.subarray(0, 4).toString("ascii") !== "%PDF") continue
						if (
							this.sendNotarizedPdfBufferToResponse(args.res, s3buf, {
								asAttachment: args.disposition.includes("attachment"),
								cacheProjectUuid: args.projectUuid,
							})
						) {
							return true
						}
						continue
					} catch {
						continue
					}
				}
				continue
			}
			if (
				!this.sendNotarizedPdfBufferToResponse(args.res, buf, {
					asAttachment: args.disposition.includes("attachment"),
					cacheProjectUuid: args.projectUuid,
				})
			) {
				continue
			}
			this.log.log(
				`[DocOnChain] vault download stream ok project=…${args.projectUuid.slice(-12)} slug=…${args.slug.slice(-12)} bytes=${buf.length}`
			)
			return true
		}
		return false
	}

	/**
	 * Meeting notarized PDF proxy: same vault resolution order as legacy `download-sealed-project.ts`.
	 * 1) `GET /vault/items/{doconchainProjectUuid}/download` when DC uses project id as vault path segment.
	 * 2) Page `GET /vault/items`, match `project_uuid` (or row `uuid` / `id`) to stored create-project id.
	 * 3) Retry download/detail with the list row's `uuid` (+ `category_id` / `client_id` from the row).
	 */
	async streamVaultNotarizedPdfToResponse(args: {
		token: string
		/** Create-project `data.uuid` from `POST /api/v2/projects` — DB `quicksign_projects.doconchainProjectUuid`. */
		projectUuid: string
		res: ExpressResponse
		asAttachment?: boolean
		/** User-initiated view/download: bypass vault list cooldown and scan more pages. */
		forceVaultScan?: boolean
	}): Promise<boolean> {
		const disposition = args.asAttachment
			? 'attachment; filename="notarized-document.pdf"'
			: 'inline; filename="notarized-document.pdf"'
		const baseUrl = env.DOCONCHAIN_API_URL
		if (!baseUrl?.trim() || args.token.startsWith("mock_dc_token_")) return false
		const projectUuid = args.projectUuid.trim()
		if (!projectUuid) return false

		if (
			await this.trySendCachedNotarizedPdfToResponse(projectUuid, args.res, {
				asAttachment: args.asAttachment === true,
			})
		) {
			return true
		}

		const streamArgs = {
			token: args.token,
			baseUrl,
			projectUuid,
			res: args.res,
			disposition,
		}

		const isSealedPdfUrl = (u: string) => this.isSealedNotarizedPdfUrl(u)

		const meetingCache = this.getMeetingNotarizedPdfCache(projectUuid)
		const vaultOnCooldown =
			!args.forceVaultScan &&
			meetingCache?.lastVaultAttemptAt &&
			Date.now() - meetingCache.lastVaultAttemptAt < MEETING_VAULT_RETRY_COOLDOWN_MS

		const vaultListPages = args.forceVaultScan
			? Math.min(VAULT_LIST_MAX_PAGES, MEETING_VAULT_LIST_MAX_PAGES * 3)
			: MEETING_VAULT_LIST_MAX_PAGES

		// Step 1 — vault list row first (staging often binds download to list `uuid`, not create-project id).
		if (!vaultOnCooldown) {
			const hit = await this.findVaultListRowForCreateProjectId(
				args.token,
				baseUrl,
				projectUuid,
				vaultListPages
			)
			if (hit) {
				for (const slug of this.buildVaultItemDownloadSlugs(projectUuid, hit.row)) {
					if (await this.tryStreamVaultDownloadSlug({ ...streamArgs, slug, vaultRow: hit.row })) {
						return true
					}
				}
			}
		} else {
			this.logDcVerbose(
				`[DocOnChain] vault list scan skipped (cooldown) for …${projectUuid.slice(-12)}`
			)
		}

		// Step 2 — direct download using persisted create-project id.
		if (await this.tryStreamVaultDownloadSlug({ ...streamArgs, slug: projectUuid })) {
			return true
		}

		// Step 3 — project download/GET.
		const fromDl = await this.tryProjectSealedPdfFromDownloadEndpoints(
			args.token,
			baseUrl,
			projectUuid
		)
		if (fromDl?.startsWith("http") && isSealedPdfUrl(fromDl)) {
			const ok = await this.pipeHttpsPdfToExpressResponse(fromDl, args.token, args.res, {
				asAttachment: args.asAttachment === true,
				cacheProjectUuid: projectUuid,
			})
			if (ok) {
				this.setMeetingNotarizedPdfCache(projectUuid, fromDl)
				return true
			}
		}

		const sealedFromProject = await this.tryFetchSealedPdfUrlFromProjectGet(
			args.token,
			baseUrl,
			projectUuid
		)
		if (sealedFromProject?.startsWith("http") && isSealedPdfUrl(sealedFromProject)) {
			const ok = await this.pipeHttpsPdfToExpressResponse(sealedFromProject, args.token, args.res, {
				asAttachment: args.asAttachment === true,
				cacheProjectUuid: projectUuid,
			})
			if (ok) {
				this.setMeetingNotarizedPdfCache(projectUuid, sealedFromProject)
				this.log.log(
					`[DocOnChain] project GET Document Completed stream ok project=…${projectUuid.slice(-12)}`
				)
				return true
			}
		}

		if (!vaultOnCooldown) {
			this.setMeetingNotarizedPdfCache(projectUuid, null, { vaultAttempted: true })
		}

		return false
	}

	/** Reject DocOnChain sign-only PDFs that still show blank SC notarial template lines. */
	private isInterimSignOnlyNotarizedPdf(buf: Buffer): boolean {
		return looksLikePdfMissingDoconchainNotarialSeal(buf)
	}

	/** Download sealed notarized PDF bytes (cache → project fast URL → optional vault in fast path). */
	async fetchNotarizedPdfBytes(args: {
		token: string
		projectUuid: string
		/** When true, run a vault scan if the fast project path has no sealed PDF yet. */
		tryVault?: boolean
		/** When true, bypass URL/bytes cache and scan vault more aggressively (user-initiated view). */
		forceVaultScan?: boolean
	}): Promise<Buffer | null> {
		const projectUuid = args.projectUuid.trim()
		if (!projectUuid || args.token.startsWith("mock_dc_token_")) return null

		if (!args.forceVaultScan) {
			const cached = await readNotarizedPdfBytesCache(projectUuid)
			if (cached?.length && cached.subarray(0, 4).toString("ascii") === "%PDF") {
				if (!this.isInterimSignOnlyNotarizedPdf(cached)) return cached
				await deleteNotarizedPdfBytesCache(projectUuid)
			}
		}

		const isSealedPdfUrl = (u: string) =>
			!this.isLikelyPreSealVaultPdfUrl(u) && !this.isLikelyInterimSignedWithoutNotarialSeal(u)

		const downloadValidated = async (url: string): Promise<Buffer | null> => {
			try {
				const buf = await this.fetchPdfBytesFromUrl(url, args.token)
				if (!buf || buf.length < 5 || buf.subarray(0, 4).toString("ascii") !== "%PDF") return null
				if (this.isInterimSignOnlyNotarizedPdf(buf)) {
					this.log.debug(
						`[DocOnChain] interim sign-only PDF rejected (no notarial seal) project=…${projectUuid.slice(-12)}`
					)
					return null
				}
				await writeNotarizedPdfBytesCache(projectUuid, buf)
				return buf
			} catch {
				return null
			}
		}

		const vaultListPages = args.forceVaultScan
			? Math.min(VAULT_LIST_MAX_PAGES, MEETING_VAULT_LIST_MAX_PAGES * 3)
			: MEETING_VAULT_LIST_MAX_PAGES

		const tryVaultDownloadBytes = async (): Promise<Buffer | null> => {
			const baseUrl = env.DOCONCHAIN_API_URL
			if (!baseUrl?.trim()) return null
			const hit = await this.findVaultListRowForCreateProjectId(
				args.token,
				baseUrl,
				projectUuid,
				vaultListPages
			)
			const slugs = hit ? this.buildVaultItemDownloadSlugs(projectUuid, hit.row) : [projectUuid]
			for (const slug of slugs) {
				const buf = await this.tryDownloadVaultPdfBytes({
					token: args.token,
					baseUrl,
					slug,
					vaultRow: hit?.row,
				})
				if (!buf) continue
				if (buf.length < 5 || buf.subarray(0, 4).toString("ascii") !== "%PDF") continue
				if (this.isInterimSignOnlyNotarizedPdf(buf)) continue
				await writeNotarizedPdfBytesCache(projectUuid, buf)
				return buf
			}
			return null
		}

		const baseUrl = env.DOCONCHAIN_API_URL?.trim()
		if (baseUrl) {
			const fromProjectDl = await this.tryProjectSealedPdfFromDownloadEndpoints(
				args.token,
				baseUrl,
				projectUuid
			)
			if (fromProjectDl?.startsWith("http")) {
				const buf = await downloadValidated(fromProjectDl)
				if (buf) return buf
			}

			const fromProjectGet = await this.tryFetchSealedPdfUrlFromProjectGet(
				args.token,
				baseUrl,
				projectUuid
			)
			if (fromProjectGet?.startsWith("http")) {
				const buf = await downloadValidated(fromProjectGet)
				if (buf) return buf
			}
		}

		let url = await this.fetchSignedPdfUrlFromProjectFast(args)
		if (!url?.startsWith("http") && args.tryVault) {
			const vault = await this.resolveVaultNotarizedPdf({
				token: args.token,
				projectUuid,
				maxVaultListPages: vaultListPages,
			})
			if (
				vault.outcome === "ok" &&
				vault.signedPdfUrl?.startsWith("http") &&
				isSealedPdfUrl(vault.signedPdfUrl)
			) {
				url = vault.signedPdfUrl
				this.setMeetingNotarizedPdfCache(projectUuid, url)
			}
		}
		if (url?.startsWith("http")) {
			const buf = await downloadValidated(url)
			if (buf) return buf
		}

		if (args.tryVault || args.forceVaultScan) {
			const fromVault = await tryVaultDownloadBytes()
			if (fromVault) return fromVault
		}

		return null
	}

	/**
	 * In-meeting notarized PDF: cache → quick project download/GET (`Document Completed`) → throttled vault scan.
	 * Vault list paging is expensive; do not run it on every meeting poll or page refresh.
	 */
	async fetchSignedPdfUrlFromProjectFast(args: {
		token: string
		projectUuid: string
	}): Promise<string | undefined> {
		const baseUrl = env.DOCONCHAIN_API_URL
		if (!baseUrl?.trim() || args.token.startsWith("mock_dc_token_")) return undefined
		const projectUuid = args.projectUuid.trim()
		if (!projectUuid) return undefined

		const cached = this.getMeetingNotarizedPdfCache(projectUuid)
		if (cached?.url) {
			this.logDcVerbose(`[DocOnChain] meeting notarized PDF cache hit …${projectUuid.slice(-12)}`)
			return cached.url
		}

		const isSealedPdfUrl = (u: string) =>
			!this.isLikelyPreSealVaultPdfUrl(u) && !this.isLikelyInterimSignedWithoutNotarialSeal(u)

		const fromDl = await this.tryProjectSealedPdfFromDownloadEndpoints(
			args.token,
			baseUrl,
			projectUuid
		)
		if (fromDl?.startsWith("http") && isSealedPdfUrl(fromDl)) {
			this.logResolvedNotarizedPdf("meeting_fast_project_download", projectUuid, fromDl)
			this.setMeetingNotarizedPdfCache(projectUuid, fromDl)
			return fromDl
		}

		const fromGet = await this.tryFetchSealedPdfUrlFromProjectGet(args.token, baseUrl, projectUuid)
		if (fromGet?.startsWith("http") && this.isSealedNotarizedPdfUrl(fromGet)) {
			this.logResolvedNotarizedPdf("meeting_fast_project_get", projectUuid, fromGet)
			this.setMeetingNotarizedPdfCache(projectUuid, fromGet)
			return fromGet
		}

		const now = Date.now()
		const vaultCooldown =
			cached?.lastVaultAttemptAt &&
			now - cached.lastVaultAttemptAt < MEETING_VAULT_RETRY_COOLDOWN_MS
		if (vaultCooldown) {
			return undefined
		}

		this.setMeetingNotarizedPdfCache(projectUuid, null, { vaultAttempted: true })
		const vault = await this.resolveVaultNotarizedPdf({
			token: args.token,
			projectUuid,
			maxVaultListPages: MEETING_VAULT_LIST_MAX_PAGES,
		})
		if (
			vault.outcome === "ok" &&
			vault.signedPdfUrl?.startsWith("http") &&
			isSealedPdfUrl(vault.signedPdfUrl)
		) {
			this.setMeetingNotarizedPdfCache(projectUuid, vault.signedPdfUrl)
			return vault.signedPdfUrl
		}

		this.logVaultDiagOnce(
			`meeting-sealed-not-ready:${projectUuid.slice(-12)}`,
			`[DocOnChain] meeting sealed PDF not ready for …${projectUuid.slice(-12)} (vault=${vault.outcome})`,
			"warn"
		)
		return undefined
	}

	/**
	 * Silent path for meetings: discards typed outcomes (see {@link resolveVaultNotarizedPdf}).
	 */
	async fetchVaultItemForProject(args: {
		token: string
		projectUuid: string
		maxVaultListPages?: number
	}): Promise<{ doconchainProjectUuid: string; signedPdfUrl?: string } | null> {
		const { result } = await this.fetchVaultItemForProjectWithOutcome(args)
		return result
	}

	/**
	 * Vault document code for DOC Verify (`code` on sealed PDF / DOC Vault).
	 * Uses the same vault detail + list scan as notarized PDF resolution, without downloading the PDF.
	 */
	async fetchVaultDocumentCode(args: {
		token: string
		projectUuid: string
		maxVaultListPages?: number
	}): Promise<string | null> {
		const baseUrl = env.DOCONCHAIN_API_URL
		if (!baseUrl?.trim() || args.token.startsWith("mock_dc_token_")) return null

		const root = baseUrl.replace(/\/$/, "")
		const projectUuid = args.projectUuid.trim()
		if (!projectUuid) return null

		const readCodeFromDetailBody = (bodyText: string | null): string | null => {
			if (!bodyText) return null
			const data = this.parseVaultDetailData(bodyText)
			return data ? extractDoconchainDocumentCode(data) : null
		}

		let res = await this.vaultDetailFetch(args.token, root, projectUuid)
		if (res.ok) {
			const code = readCodeFromDetailBody(await res.text())
			if (code) return code
		}

		const listPageCap = Math.min(Math.max(1, args.maxVaultListPages ?? 5), VAULT_LIST_MAX_PAGES)
		const listHit = await this.findVaultListRowForCreateProjectId(
			args.token,
			baseUrl,
			projectUuid,
			listPageCap
		)
		if (!listHit) return null

		const fromList = extractDoconchainDocumentCode(listHit.row)
		if (fromList) return fromList

		res = await this.vaultDetailFetch(args.token, root, listHit.listRowUuid, listHit.row)
		if (res.ok) {
			return readCodeFromDetailBody(await res.text())
		}
		return null
	}

	/**
	 * DocOnChain DOC Verify — `POST /api/v2/verifications/document/verify?user_type=ENTERPRISE_API`.
	 * Confirms a notarized PDF or vault document code is authentic and untampered.
	 */
	async verifyDocumentAuthenticity(args: {
		token: string
		userUuid: string
		code?: string
		pdf?: Buffer
		filename?: string
		allowMock?: boolean
	}): Promise<{
		ok: boolean
		status: string
		message: string
		documentCode: string | null
		projectUuid: string | null
		verificationUuid: string | null
		verifiedAt: string | null
		httpStatus: number
	}> {
		const code = args.code?.trim()
		const hasFile = Boolean(args.pdf && args.pdf.length > 0)
		if (!code && !hasFile) {
			return {
				ok: false,
				status: "invalid_request",
				message: "Provide a document code or upload a PDF to verify.",
				documentCode: null,
				projectUuid: null,
				verificationUuid: null,
				verifiedAt: null,
				httpStatus: 400,
			}
		}

		const userUuid = args.userUuid.trim()
		if (!userUuid) {
			return {
				ok: false,
				status: "invalid_request",
				message: "DocOnChain user context is not configured for verification.",
				documentCode: code ?? null,
				projectUuid: null,
				verificationUuid: null,
				verifiedAt: null,
				httpStatus: 400,
			}
		}

		const allowMock = args.allowMock ?? true
		if (allowMock && (!this.isConfigured() || args.token.startsWith("mock_dc_token_"))) {
			const mockOk = Boolean(code || hasFile)
			return {
				ok: mockOk,
				status: mockOk ? "verified" : "failed",
				message: mockOk
					? "Document verified (local mock — DocOnChain not configured)."
					: "Document could not be verified (mock).",
				documentCode: code ?? "MOCK-VERIFY",
				projectUuid: mockOk ? "mock-project-uuid" : null,
				verificationUuid: null,
				verifiedAt: mockOk ? new Date().toISOString() : null,
				httpStatus: mockOk ? 200 : 422,
			}
		}

		const baseUrl = env.DOCONCHAIN_API_URL
		if (!baseUrl?.trim()) {
			return {
				ok: false,
				status: "unavailable",
				message: "Document verification is not configured.",
				documentCode: code ?? null,
				projectUuid: null,
				verificationUuid: null,
				verifiedAt: null,
				httpStatus: 503,
			}
		}

		const apiV2 = this.doconchainApiV2Prefix(baseUrl)
		const boundary = `QLDCV${randomUUID().replace(/-/g, "")}`
		const fields: Record<string, string> = { user_uuid: userUuid }
		if (code) fields.code = code
		const files =
			hasFile && args.pdf
				? {
						file: {
							filename: args.filename?.trim() || "document.pdf",
							contentType: "application/pdf",
							data: args.pdf,
						},
					}
				: undefined
		const body = buildMultipartBody(boundary, fields, files)
		const url = `${apiV2}/verifications/document/verify?user_type=ENTERPRISE_API`

		let res: Response
		try {
			res = await fetch(url, {
				method: "POST",
				headers: {
					"Authorization": `Bearer ${args.token}`,
					"Content-Type": `multipart/form-data; boundary=${boundary}`,
					"Accept": "application/json",
				},
				body,
			})
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.warn(`DC document verify network error: ${msg.slice(0, 200)}`)
			return {
				ok: false,
				status: "unavailable",
				message: "Could not reach DocOnChain verification service. Try again shortly.",
				documentCode: code ?? null,
				projectUuid: null,
				verificationUuid: null,
				verifiedAt: null,
				httpStatus: 503,
			}
		}

		const raw = await res.text()
		let json: Record<string, unknown> = {}
		try {
			json = JSON.parse(raw) as Record<string, unknown>
		} catch {
			json = {}
		}

		const envelope = parseDoconchainVerifyEnvelope(json)
		const doc =
			json.document && typeof json.document === "object"
				? (json.document as Record<string, unknown>)
				: envelope.data
		const documentCode =
			(typeof doc?.code === "string" && doc.code) ||
			(typeof envelope.data?.code === "string" && envelope.data.code) ||
			(typeof json.code === "string" && json.code) ||
			code ||
			null
		const verifiedAt =
			(typeof doc?.verified_at === "string" && doc.verified_at) ||
			(typeof envelope.data?.verified_at === "string" && envelope.data.verified_at) ||
			(typeof json.verified_at === "string" && json.verified_at) ||
			null
		const apiStatus = envelope.status
		const apiMessage =
			envelope.message || (typeof json.error === "string" && json.error) || raw.slice(0, 240)
		const projectUuid =
			(typeof envelope.data?.project_uuid === "string" && envelope.data.project_uuid.trim()) ||
			(typeof envelope.data?.projectUuid === "string" && envelope.data.projectUuid.trim()) ||
			(typeof doc?.project_uuid === "string" && doc.project_uuid.trim()) ||
			(typeof doc?.projectUuid === "string" && doc.projectUuid.trim()) ||
			null
		const verificationUuid =
			(typeof envelope.data?.verification_uuid === "string" &&
				envelope.data.verification_uuid.trim()) ||
			(typeof envelope.data?.verificationUuid === "string" &&
				envelope.data.verificationUuid.trim()) ||
			(typeof doc?.verification_uuid === "string" && doc.verification_uuid.trim()) ||
			null

		if (res.ok && isDoconchainVerifySuccessStatus(apiStatus)) {
			const friendlyMessage =
				apiMessage && apiMessage.toLowerCase() !== "ok"
					? apiMessage
					: "Document successfully verified with DocOnChain."
			this.logDcVerbose(
				`DC document verify OK status=${apiStatus} project=${String(projectUuid ?? "").slice(0, 12)}`
			)
			return {
				ok: true,
				status: apiStatus || "verified",
				message: friendlyMessage,
				documentCode,
				projectUuid,
				verificationUuid,
				verifiedAt,
				httpStatus: res.status,
			}
		}

		if (res.status === 404) {
			return {
				ok: false,
				status: "not_found",
				message: apiMessage || "Document not found in DocOnChain.",
				documentCode,
				projectUuid,
				verificationUuid,
				verifiedAt: null,
				httpStatus: 404,
			}
		}

		if (res.status === 422) {
			return {
				ok: false,
				status: "not_verified",
				message: apiMessage || "Document could not be verified (may be altered or unknown).",
				documentCode,
				projectUuid,
				verificationUuid,
				verifiedAt: null,
				httpStatus: 422,
			}
		}

		if (res.status === 401 || res.status === 403) {
			return {
				ok: false,
				status: "unauthorized",
				message: "Verification service rejected the request. Check DocOnChain credentials.",
				documentCode,
				projectUuid,
				verificationUuid,
				verifiedAt: null,
				httpStatus: res.status,
			}
		}

		this.log.warn(
			`DC document verify failed HTTP ${res.status} status=${apiStatus || "—"}: ${raw.slice(0, 280)}`
		)
		return {
			ok: false,
			status: apiStatus || "error",
			message:
				apiStatus && !isDoconchainVerifySuccessStatus(apiStatus)
					? `DocOnChain verification status: ${apiStatus}`
					: apiMessage || `DocOnChain verification failed (${res.status}).`,
			documentCode,
			projectUuid,
			verificationUuid,
			verifiedAt: null,
			httpStatus: res.status >= 400 ? res.status : 502,
		}
	}

	private emptyVerificationDetails(verificationUuid: string | null): DoconchainVerificationDetails {
		return {
			verificationUuid,
			projectUuid: null,
			status: null,
			documentName: null,
			verificationDate: null,
			projectName: null,
			projectReferenceNumber: null,
			signers: [],
		}
	}

	/**
	 * `GET /api/v2/verifications/:uuid` — Show Verification (project uuid + audit metadata).
	 */
	async fetchDoconchainVerificationDetails(args: {
		token: string
		verificationUuid: string
	}): Promise<DoconchainVerificationDetails> {
		const verificationUuid = args.verificationUuid.trim()
		if (!verificationUuid) return this.emptyVerificationDetails(null)

		const baseUrl = env.DOCONCHAIN_API_URL?.trim()
		if (!baseUrl) return this.emptyVerificationDetails(verificationUuid)

		const apiV2 = this.doconchainApiV2Prefix(baseUrl)
		const url = `${apiV2}/verifications/${encodeURIComponent(verificationUuid)}?user_type=ENTERPRISE_API`
		const authHeaders = {
			"Authorization": `Bearer ${args.token}`,
			"user-token": args.token,
			"Accept": "application/json",
		} as const

		let res: Response
		try {
			res = await fetch(url, { headers: authHeaders })
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.warn(`DC show verification network error: ${msg.slice(0, 160)}`)
			return this.emptyVerificationDetails(verificationUuid)
		}

		if (!res.ok) {
			this.log.warn(`DC show verification HTTP ${res.status} uuid=${verificationUuid.slice(0, 12)}`)
			return this.emptyVerificationDetails(verificationUuid)
		}

		let json: unknown
		try {
			json = await res.json()
		} catch {
			return this.emptyVerificationDetails(verificationUuid)
		}

		const parsed = parseDoconchainVerificationDetails(json)
		this.logDcVerbose(
			`DC show verification project=${String(parsed.projectUuid ?? "").slice(0, 12)} signers=${parsed.signers.length}`
		)
		return {
			...parsed,
			verificationUuid: parsed.verificationUuid ?? verificationUuid,
		}
	}

	private async fetchPassportViewPdfBytes(args: {
		token: string
		projectUuid: string
		view: string
	}): Promise<Buffer | null> {
		const baseUrl = env.DOCONCHAIN_API_URL?.trim()
		if (!baseUrl) return null
		const apiV2 = this.doconchainApiV2Prefix(baseUrl)
		const url = `${apiV2}/projects/${encodeURIComponent(args.projectUuid)}/passport?user_type=ENTERPRISE_API&view=${encodeURIComponent(args.view)}`
		let res: Response
		try {
			res = await fetch(url, {
				headers: {
					"Authorization": `Bearer ${args.token}`,
					"user-token": args.token,
					"Accept": "application/pdf, application/json, */*",
				},
			})
		} catch {
			return null
		}
		if (!res.ok) return null

		const contentType = res.headers.get("content-type") ?? ""
		const buf = Buffer.from(await res.arrayBuffer())
		if (buf.length >= 5 && buf.subarray(0, 4).toString("ascii") === "%PDF") return buf

		const text = buf.toString("utf8").trim()
		if (text.startsWith("http") || text.startsWith("/")) {
			const pdf = await this.fetchPdfBytesFromUrl(text, args.token)
			if (pdf) return pdf
		}

		if (!contentType.includes("json") && buf[0] !== 0x7b) return null

		try {
			const json = JSON.parse(text) as unknown
			const embedded = extractPdfBufferFromDoconchainPayload(json)
			if (embedded) return embedded
			const httpsUrl = extractHttpsUrlFromPassportPayload(json)
			if (httpsUrl) return this.fetchPdfBytesFromUrl(httpsUrl, args.token)
			const stringUrl =
				json &&
				typeof json === "object" &&
				!Array.isArray(json) &&
				typeof (json as Record<string, unknown>).data === "string"
					? String((json as Record<string, unknown>).data)
					: null
			if (stringUrl) {
				const pdf = await this.fetchPdfBytesFromUrl(stringUrl, args.token)
				if (pdf) return pdf
			}
		} catch {
			/* ignore */
		}
		return null
	}

	/**
	 * Certificate PDF: Show Verification → project uuid → passport `certificate_url` → S3 PDF.
	 */
	async fetchCertificateOfCompletionPdf(args: {
		token: string
		projectUuid?: string | null
		verificationUuid?: string | null
		certificateUrl?: string | null
	}): Promise<Buffer | null> {
		let projectUuid = args.projectUuid?.trim() || null
		let certificateUrl = args.certificateUrl?.trim() || null
		const verificationUuid = args.verificationUuid?.trim() || null

		if (verificationUuid && !projectUuid) {
			const details = await this.fetchDoconchainVerificationDetails({
				token: args.token,
				verificationUuid,
			})
			projectUuid = details.projectUuid?.trim() || null
		}

		if (!certificateUrl && projectUuid) {
			const passport = await this.fetchProjectPassportCertificateUrl({
				token: args.token,
				projectUuid,
			})
			certificateUrl = passport.certificateUrl
		}

		if (!certificateUrl) return null
		return this.fetchPdfBytesFromUrl(certificateUrl, args.token)
	}

	async streamCertificateOfCompletionToResponse(
		res: ExpressResponse,
		args: {
			token: string
			projectUuid?: string | null
			verificationUuid?: string | null
			certificateUrl?: string | null
			asAttachment?: boolean
		}
	): Promise<boolean> {
		const buf = await this.fetchCertificateOfCompletionPdf(args)
		if (!buf) return false
		this.streamPdfBufferToExpressResponse(res, buf, {
			asAttachment: args.asAttachment,
			filename: "certificate-of-completion.pdf",
		})
		return true
	}

	/**
	 * `GET /api/v2/projects/:uuid/passport` — Certificate of Completion (view=certificate_url).
	 */
	async fetchProjectPassportCertificateUrl(args: {
		token: string
		projectUuid: string
	}): Promise<{ certificateUrl: string | null; view: string | null }> {
		const projectUuid = args.projectUuid.trim()
		if (!projectUuid) return { certificateUrl: null, view: null }

		const baseUrl = env.DOCONCHAIN_API_URL?.trim()
		if (!baseUrl) return { certificateUrl: null, view: null }

		const apiV2 = this.doconchainApiV2Prefix(baseUrl)
		const views = ["certificate_url", "verifiable_presentation", "history", "blockchain"] as const

		for (const view of views) {
			const url = `${apiV2}/projects/${encodeURIComponent(projectUuid)}/passport?user_type=ENTERPRISE_API&view=${encodeURIComponent(view)}`
			let res: Response
			try {
				res = await fetch(url, {
					headers: {
						Authorization: `Bearer ${args.token}`,
						Accept: "application/json",
					},
				})
			} catch {
				continue
			}
			if (!res.ok) {
				this.logDcVerbose(
					`DC passport view=${view} HTTP ${res.status} project=${projectUuid.slice(0, 12)}`
				)
				continue
			}
			let json: unknown
			try {
				json = await res.json()
			} catch {
				continue
			}
			const certificateUrl = parseDoconchainPassportCertificateUrl(json)
			if (certificateUrl) {
				this.logDcVerbose(
					`DC passport certificate URL from view=${view} project=${projectUuid.slice(0, 12)}`
				)
				return { certificateUrl, view }
			}
		}

		return { certificateUrl: null, view: null }
	}

	/**
	 * `GET /api/v2/my/profile` → `data.uuid` (DOC Verify `user_uuid`).
	 * @see https://stg-api2.doconchain.com — Account Profile / Get User Profile Information
	 */
	private parseDoconchainProfileUuid(json: unknown): string | null {
		if (!json || typeof json !== "object") return null
		const root = json as Record<string, unknown>
		const data =
			root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root
		const uuid = data.uuid
		if (typeof uuid === "string" && uuid.trim().length >= 6) return uuid.trim()
		return null
	}

	async fetchMyProfileUuid(token: string): Promise<string | null> {
		const baseUrl = env.DOCONCHAIN_API_URL
		if (!baseUrl?.trim() || token.startsWith("mock_dc_token_")) return null

		const apiV2 = this.doconchainApiV2Prefix(baseUrl)
		const url = `${apiV2}/my/profile?user_type=ENTERPRISE_API`
		try {
			const res = await fetch(url, {
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: "application/json",
				},
			})
			if (!res.ok) {
				this.logDcVerbose(
					`DC my/profile for verify user_uuid: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`
				)
				return null
			}
			const json: unknown = await res.json()
			return this.parseDoconchainProfileUuid(json)
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.warn(`DC my/profile failed: ${msg.slice(0, 160)}`)
			return null
		}
	}

	/**
	 * Resolves DocOnChain `user_uuid` for DOC Verify (`POST …/verifications/document/verify`).
	 * This is the profile `uuid` from `GET /api/v2/my/profile`, not `DOCONCHAIN_ORGANIZATION_UUID`.
	 */
	async resolveDoconchainVerifyUserUuid(token: string): Promise<string | null> {
		const fromEnv = env.DOCONCHAIN_VERIFY_USER_UUID?.trim()
		if (fromEnv) return fromEnv

		const fromProfile = await this.fetchMyProfileUuid(token)
		if (fromProfile) return fromProfile

		return parseDoconchainUserUuidFromToken(token)
	}
}
