import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { createHmac } from "node:crypto"

import { env, publicAppUrl } from "@/config/env.config"

import {
	formatLmsMisconfigurationHint,
	looksLikeQlegalOrpcErrorBody,
	validateLmsIntegrationBaseUrl,
} from "./lms-base-url"
import {
	buildLmsSsoCreateCodeRequestBody,
	resolveSsoCodeExpiresInSeconds,
	type LmsSsoCreateCodeRequestBody,
} from "./lms-sso-contract"

/**
 * TTL for HMAC-signed SSO tokens. The signature is the credential — keep it short.
 * QLearn rejects tokens past `exp`, so an interception window is ~minutes max.
 */
const SSO_TOKEN_TTL_SECONDS = 120

/**
 * Thin HTTP client for the QLearn LMS integration API (draft §1, §2, §4, §5).
 *
 * Modes:
 *   - **Real mode** (when `LMS_INTEGRATION_BASE_URL` is set): POSTs JSON to
 *     `{baseUrl}/integration/{users/upsert|course-enrollments|progress/query|certificates/query}`
 *     with an optional `Authorization: Bearer ${LMS_INTEGRATION_API_KEY}` header.
 *   - **Stub mode** (when unset): returns deterministic responses so QLegal's
 *     onboarding flow runs end-to-end without a live QLearn deployment.
 *
 * Body shapes mirror the QLearn integration draft exactly. Responses are parsed
 * defensively (we accept common field-name variants: `lmsUserId`/`userId`/`id`,
 * camelCase or snake_case) since the draft documents request bodies only.
 *
 * The HMAC SSO redirect (`createSsoCode`) is independent of the base URL — see
 * `docs/integrations/lms-sso-handshake-spec.md` for the QLearn-side contract.
 */

/** From draft §1: KYC status reported to LMS for audit. */
export type LmsKycStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED"

/** From draft §1 body. */
export interface LmsUpsertUserInput {
	/** QLegal user id; LMS uses it as the universal identifier in subsequent calls. */
	id: string
	email: string
	firstName: string
	middleName: string | null
	lastName: string
	phoneNumber: string | null
	/** Single-line concatenation for display; LMS also stores the broken-down parts below. */
	address: string | null
	homeStreet: string | null
	barangay: string | null
	cityProvince: string | null
	/** QLegal source role for audit only — QLearn must persist the user as learner `student`. */
	role: "ENP" | "PRINCIPAL" | "CLIENT" | "ADMIN"
	kycStatus: LmsKycStatus
	kycVerifiedAt: string | null
}

export interface LmsUpsertUserResult {
	lmsUserId: string
	action: "created" | "updated"
}

/** From draft §2 body. */
export interface LmsEnrollInput {
	id: string
	classCode: string
	courseId?: string
}

/** QLearn `POST /integration/users/upsert` request body (camelCase only). */
export type LmsUpsertRequestBody = {
	id: string
	email: string
	firstName: string
	middleName: string
	lastName: string
	phoneNumber: string
	address: string
	homeStreet: string
	barangay: string
	cityProvince: string
	role: "PRINCIPAL"
	kycStatus: LmsKycStatus
	kycVerifiedAt?: string
}

/** QLearn `POST /integration/course-enrollments` request body. */
export type LmsEnrollRequestBody = {
	id: string
	classCode: string
	courseId: string
}

/** QLearn `POST /integration/progress/query` request body. */
export type LmsProgressRequestBody = {
	id: string
	classCode: string
}

/** QLearn `POST /integration/certificates/query` request body. */
export type LmsCertificateRequestBody = {
	id: string
	classCode: string
}

export interface LmsEnrollResult {
	classId: string
	courseId: string
	alreadyEnrolled: boolean
}

/** From draft §3 body. */
export interface LmsCreateSsoCodeInput {
	id: string
	email: string
	/** Post-SSO landing on QLearn (course view) — sent as create-code `redirectUri`. */
	redirectUri: string
	/** QLegal return URL (`returnTo` on locally built redeem URLs only). */
	qlegalReturnUri?: string
	classCode: string
	courseId?: string
}

export interface LmsCreateSsoCodeResult {
	/** One-time, single-use, bound to user + redirectUri. */
	code: string
	/** Pre-constructed URL the browser should navigate to. */
	redirectUrl: string
	expiresInSeconds: number
	handoffMode: "hmac" | "create_code"
}

/** From draft §4 body. */
export interface LmsProgressInput {
	id: string
	classCode: string
}

export interface LmsProgressResult {
	progressPercent: number
	completion: "not_started" | "in_progress" | "completed"
	passed: boolean
	lastAccessedAt: string | null
}

/** From draft §5 body. */
export interface LmsCertificateInput {
	id: string
	classCode: string
}

export interface LmsCertificateResult {
	issued: boolean
	certificateNumber?: string
	issuedAt?: string
	downloadUrl?: string
	/** Direct PDF link from QLearn (often S3) when integration download route is unavailable. */
	pdfUrl?: string
	verifyUrl?: string
	courseTitle?: string
	studentName?: string
}

/** From draft §6 body — public certificate authenticity check (no user id required). */
export interface LmsValidateCertificateInput {
	certificateNumber: string
	classCode: string
}

export interface LmsValidateCertificateResult {
	valid: boolean
	owner?: { firstName?: string; lastName?: string; email?: string }
	courseTitle?: string
	issuedAt?: string
}

/** Common response wrapper QLearn uses on errors per the screenshots: `{ success, error: { code, message } }`. */
interface LmsErrorEnvelope {
	success?: false
	error?: { code?: string; message?: string }
	timestamp?: string
}

function maskEmail(email: string): string {
	const [name, domain] = email.split("@")
	if (!name || !domain) return "***"
	if (name.length <= 2) return `${name[0] ?? "*"}***@${domain}`
	return `${name.slice(0, 2)}***@${domain}`
}

function isGatewayFailure(message: string): boolean {
	return (
		message.includes("(502") ||
		message.includes("(504") ||
		message.includes("HTTP_502") ||
		message.includes("HTTP_504")
	)
}

/** True when QLearn's redirectUrl is safe to open (has code, not bare /login). */
function isUsableSsoRedirectUrl(url: string, code: string): boolean {
	try {
		const u = new URL(url)
		if (/\/login\/?$/i.test(u.pathname) && !u.searchParams.has("code")) {
			return false
		}
		const param = u.searchParams.get("code")
		return param === code || u.searchParams.has("code")
	} catch {
		return false
	}
}

/** True when a post-SSO redirect target is missing or points at QLearn home/dashboard. */
function shouldOverridePostLoginRedirect(redirectTarget: string | null): boolean {
	if (!redirectTarget?.trim()) return true
	try {
		const u = new URL(redirectTarget)
		if (/\/dashboard\/?$/i.test(u.pathname)) return true
		if (u.pathname === "/" || u.pathname === "") return true
		return false
	} catch {
		return true
	}
}

function resolveLmsCourseId(explicit?: string): string | undefined {
	const id = explicit?.trim() ?? env.LMS_INTEGRATION_DEFAULT_COURSE_ID?.trim()
	return id || undefined
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null
	return value as Record<string, unknown>
}

function asNumber(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) return value
	if (typeof value === "string" && value.trim()) {
		const n = Number(value)
		if (Number.isFinite(n)) return n
	}
	return undefined
}

function asBool(value: unknown): boolean | undefined {
	if (typeof value === "boolean") return value
	if (value === "true" || value === 1 || value === "1") return true
	if (value === "false" || value === 0 || value === "0") return false
	return undefined
}

/** Merge nested QLearn shapes like `{ progress: { … } }` or `{ certificate: { … } }`. */
function flattenLmsFields(data: Record<string, unknown>): Record<string, unknown> {
	const nestedProgress = asRecord(data.progress)
	const nestedResult = asRecord(data.result)
	const nestedCertificate = asRecord(data.certificate)
	return {
		...data,
		...(nestedProgress ?? {}),
		...(nestedResult ?? {}),
		...(nestedCertificate ?? {}),
	}
}

function normalizeLmsCompletion(
	raw: unknown,
	progressPercent: number,
	passed?: boolean
): LmsProgressResult["completion"] {
	if (passed || progressPercent >= 100) return "completed"
	if (typeof raw === "string") {
		const s = raw.toLowerCase().replace(/[\s-]+/g, "_")
		if (["completed", "complete", "done", "passed", "finished"].includes(s)) {
			return "completed"
		}
		if (["in_progress", "inprogress", "started", "ongoing"].includes(s)) {
			return "in_progress"
		}
	}
	if (progressPercent > 0) return "in_progress"
	return "not_started"
}

function parseLmsProgressPayload(raw: unknown): LmsProgressResult {
	const top = asRecord(raw) ?? {}
	const inner = asRecord(top.data)
	const merged = flattenLmsFields({ ...top, ...(inner ?? {}) })

	const progressPercent =
		asNumber(
			merged.progressPercent ??
				merged.progress_percent ??
				merged.percent ??
				merged.percentComplete ??
				merged.percent_complete ??
				merged.completionPercent
		) ?? 0

	const passed =
		asBool(
			merged.passed ??
				merged.isPassed ??
				merged.examPassed ??
				merged.quizPassed ??
				merged.finalQuizPassed ??
				merged.hasPassed
		) ??
		((typeof merged.successStatus === "string" &&
			["passed", "complete", "completed", "success"].includes(
				merged.successStatus.toLowerCase()
			)) ||
			(typeof merged.success_status === "string" &&
				["passed", "complete", "completed", "success"].includes(
					merged.success_status.toLowerCase()
				)) ||
			false)

	const completion = normalizeLmsCompletion(
		merged.completion ??
			merged.status ??
			merged.completionStatus ??
			merged.completion_status ??
			merged.state,
		progressPercent,
		passed
	)

	const lastAccessedAt =
		(typeof merged.lastAccessedAt === "string" && merged.lastAccessedAt) ||
		(typeof merged.last_accessed_at === "string" && merged.last_accessed_at) ||
		(typeof merged.lastAccessAt === "string" && merged.lastAccessAt) ||
		null

	return {
		progressPercent,
		completion,
		passed: passed || completion === "completed",
		lastAccessedAt,
	}
}

function parseLmsCertificatePayload(
	raw: unknown,
	classCode: string,
	buildDownloadUrl: (certificateNumber: string, classCode: string) => string | null
): LmsCertificateResult {
	const top = asRecord(raw) ?? {}
	const inner = asRecord(top.data)
	const merged = flattenLmsFields({ ...top, ...(inner ?? {}) })

	const certificateNumber =
		(typeof merged.certificateNumber === "string" && merged.certificateNumber) ||
		(typeof merged.certificate_number === "string" && merged.certificate_number) ||
		(typeof merged.number === "string" && merged.number) ||
		undefined

	const issued =
		asBool(merged.issued ?? merged.isIssued ?? merged.available ?? merged.hasCertificate) ??
		Boolean(certificateNumber)

	if (!issued) return { issued: false }

	const issuedAt =
		(typeof merged.issuedAt === "string" && merged.issuedAt) ||
		(typeof merged.issued_at === "string" && merged.issued_at) ||
		undefined

	const pdfUrl =
		(typeof merged.pdfUrl === "string" && merged.pdfUrl) ||
		(typeof merged.pdf_url === "string" && merged.pdf_url) ||
		undefined

	const downloadUrl =
		(typeof merged.downloadUrl === "string" && merged.downloadUrl) ||
		(typeof merged.download_url === "string" && merged.download_url) ||
		pdfUrl ||
		(certificateNumber ? (buildDownloadUrl(certificateNumber, classCode) ?? undefined) : undefined)

	const verifyUrl =
		(typeof merged.verifyUrl === "string" && merged.verifyUrl) ||
		(typeof merged.verify_url === "string" && merged.verify_url) ||
		(typeof merged.viewUrl === "string" && merged.viewUrl) ||
		(typeof merged.view_url === "string" && merged.view_url) ||
		(typeof merged.qrVerificationUrl === "string" && merged.qrVerificationUrl) ||
		(typeof merged.qr_verification_url === "string" && merged.qr_verification_url) ||
		undefined

	const courseTitle =
		(typeof merged.courseTitle === "string" && merged.courseTitle) ||
		(typeof merged.course_title === "string" && merged.course_title) ||
		undefined

	const studentName =
		(typeof merged.studentName === "string" && merged.studentName) ||
		(typeof merged.student_name === "string" && merged.student_name) ||
		undefined

	return {
		issued: true,
		certificateNumber,
		issuedAt,
		downloadUrl,
		pdfUrl: pdfUrl ?? downloadUrl,
		verifyUrl,
		courseTitle,
		studentName,
	}
}

/** True when QLearn progress/certificate APIs indicate the learner finished the course + Final Quiz. */
export function isLmsTrainingComplete(
	progress: LmsProgressResult,
	certificate?: LmsCertificateResult | null
): boolean {
	if (certificate?.issued) return true
	if (progress.passed) return true
	if (progress.completion === "completed") return true
	if (progress.progressPercent >= 100) return true
	return false
}

@Injectable()
export class LmsClient implements OnModuleInit {
	private readonly logger = new Logger(LmsClient.name)
	private readonly baseUrl = env.LMS_INTEGRATION_BASE_URL?.replace(/\/+$/, "") ?? null

	onModuleInit(): void {
		if (!this.baseUrl) {
			this.logger.warn("[lms] LMS_INTEGRATION_BASE_URL unset — stub mode (no QLearn HTTP calls)")
			return
		}
		validateLmsIntegrationBaseUrl(this.baseUrl, { publicAppOrigin: publicAppUrl() })
		this.logger.log(`[lms] QLearn integration base URL host=${new URL(this.baseUrl).hostname}`)
	}

	private throwIfQlegalApiResponse(path: string, status: number, text: string): void {
		if (!looksLikeQlegalOrpcErrorBody(text)) return
		throw new Error(
			`LMS ${path} failed (${status}): QLegal API responded instead of QLearn. ${formatLmsMisconfigurationHint(this.baseUrl)}`
		)
	}

	private static nonNullString(value: string | null): string {
		return value ?? ""
	}

	/** Maps internal upsert input to QLearn's documented §1 JSON shape. */
	toUpsertRequestBody(input: LmsUpsertUserInput): LmsUpsertRequestBody {
		const body: LmsUpsertRequestBody = {
			id: input.id,
			email: input.email,
			firstName: input.firstName,
			middleName: LmsClient.nonNullString(input.middleName),
			lastName: input.lastName,
			phoneNumber: LmsClient.nonNullString(input.phoneNumber),
			address: LmsClient.nonNullString(input.address),
			homeStreet: LmsClient.nonNullString(input.homeStreet),
			barangay: LmsClient.nonNullString(input.barangay),
			cityProvince: LmsClient.nonNullString(input.cityProvince),
			role: "PRINCIPAL",
			kycStatus: input.kycStatus,
		}
		if (input.kycVerifiedAt) {
			body.kycVerifiedAt = input.kycVerifiedAt
		}
		return body
	}

	toEnrollRequestBody(input: LmsEnrollInput): LmsEnrollRequestBody {
		const courseId = input.courseId?.trim() ?? env.LMS_INTEGRATION_DEFAULT_COURSE_ID?.trim() ?? ""
		if (!courseId) {
			throw new Error(
				"LMS course-enrollments requires courseId (set LMS_INTEGRATION_DEFAULT_COURSE_ID or pass courseId)"
			)
		}
		return {
			id: input.id,
			classCode: input.classCode,
			courseId,
		}
	}

	toProgressRequestBody(input: LmsProgressInput): LmsProgressRequestBody {
		return {
			id: input.id,
			classCode: input.classCode,
		}
	}

	toSsoCreateCodeRequestBody(input: LmsCreateSsoCodeInput): LmsSsoCreateCodeRequestBody {
		return buildLmsSsoCreateCodeRequestBody(input)
	}

	toCertificateRequestBody(input: LmsCertificateInput): LmsCertificateRequestBody {
		return {
			id: input.id,
			classCode: input.classCode,
		}
	}

	/** Flatten QLearn envelopes like `{ success, data: { ... } }` for field lookup. */
	private unwrapLmsPayload(raw: unknown): Record<string, unknown> {
		if (!raw || typeof raw !== "object") return {}
		const top = raw as Record<string, unknown>
		const inner = top.data
		if (inner && typeof inner === "object" && !Array.isArray(inner)) {
			return { ...top, ...(inner as Record<string, unknown>) }
		}
		return top
	}

	/** True when configured against a real LMS; false = deterministic stubs for local dev. */
	get isStubMode(): boolean {
		return !this.baseUrl
	}

	/**
	 * Internal helper: POST JSON to `{baseUrl}{path}` with the optional API key header,
	 * and return parsed JSON. Throws with QLearn's error envelope when the response isn't 2xx.
	 */
	private async post<T>(path: string, body: unknown): Promise<T> {
		if (!this.baseUrl) {
			throw new Error(`LmsClient.post called in stub mode (path=${path})`)
		}
		const url = `${this.baseUrl}${path}`
		const headers: Record<string, string> = {
			"content-type": "application/json",
			"accept": "application/json",
		}
		const apiKey = env.LMS_INTEGRATION_API_KEY?.trim()
		if (apiKey) headers.authorization = `Bearer ${apiKey}`

		let res: Response
		try {
			res = await fetch(url, {
				method: "POST",
				headers,
				body: JSON.stringify(body),
			})
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.logger.error(`[lms] POST ${path} network error: ${msg}`)
			throw new Error(`LMS network error on ${path}: ${msg}`)
		}

		const text = await res.text()
		let parsed: unknown = null
		try {
			parsed = text ? JSON.parse(text) : null
		} catch {
			// Non-JSON response — keep the raw text for diagnostics
		}

		if (!res.ok) {
			const envelope = parsed as LmsErrorEnvelope | null
			this.throwIfQlegalApiResponse(path, res.status, text)
			const code = envelope?.error?.code ?? `HTTP_${res.status}`
			const message = envelope?.error?.message ?? (text.slice(0, 500) || res.statusText)
			this.logger.warn(`[lms] POST ${path} -> ${res.status} ${code}: ${message}`)
			if (path === "/integration/users/upsert") {
				const request = body as Partial<LmsUpsertUserInput>
				this.logger.warn(
					`[lms] upsert payload debug id=${request.id ?? ""} email=${request.email ? maskEmail(request.email) : ""} role=${request.role ?? ""} kycStatus=${request.kycStatus ?? ""} hasKycVerifiedAt=${!!request.kycVerifiedAt}`
				)
			}
			if (path === "/integration/sso/create-code") {
				this.logger.warn(
					`[lms] create-code base=${this.baseUrl} ${formatLmsMisconfigurationHint(this.baseUrl)}`
				)
			}
			throw new Error(`LMS ${path} failed (${res.status} ${code}): ${message}`)
		}

		this.logger.debug(`[lms] POST ${path} -> ${res.status}`)
		return parsed as T
	}

	async upsertUser(input: LmsUpsertUserInput): Promise<LmsUpsertUserResult> {
		if (this.isStubMode) {
			this.logger.debug(`[stub] users/upsert ${input.id} (${input.email})`)
			return {
				lmsUserId: `lms_${input.id}`,
				action: "created",
			}
		}
		const body = this.toUpsertRequestBody(input)
		let raw: Record<string, unknown> | null
		try {
			raw = await this.post<Record<string, unknown> | null>("/integration/users/upsert", body)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			if (msg.includes("(500") || isGatewayFailure(msg)) {
				if (env.NODE_ENV === "development") {
					this.logger.warn(
						`[lms] users/upsert transient failure — assuming existing LMS user id=${input.id} (development only)`
					)
					return { lmsUserId: input.id, action: "updated" }
				}
			}
			throw err
		}
		const data = (raw ?? {}) as {
			lmsUserId?: string
			userId?: string
			id?: string
			action?: "created" | "updated"
			result?: "created" | "updated"
		}
		const lmsUserId = data.lmsUserId ?? data.userId ?? data.id
		const action = data.action ?? data.result ?? "updated"
		if (!lmsUserId) {
			throw new Error(
				`LMS users/upsert: missing user id in response. Got keys: ${Object.keys(data).join(",")}`
			)
		}
		return { lmsUserId, action }
	}

	async enroll(input: LmsEnrollInput): Promise<LmsEnrollResult> {
		if (this.isStubMode) {
			this.logger.debug(`[stub] course-enrollments ${input.id} -> ${input.classCode}`)
			return {
				classId: `cls_stub_${input.classCode}`,
				courseId: input.courseId ?? "crs_stub_default",
				alreadyEnrolled: false,
			}
		}
		let raw: Record<string, unknown> | null
		try {
			raw = await this.post<Record<string, unknown> | null>(
				"/integration/course-enrollments",
				this.toEnrollRequestBody(input)
			)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			if (msg.includes("/integration/course-enrollments") && msg.includes("(404")) {
				this.logger.warn(
					`[lms] course-enrollments unavailable (404) — continuing without enrollment class=${input.classCode}`
				)
				return {
					classId: `no_route_${input.classCode}`,
					courseId: input.courseId ?? env.LMS_INTEGRATION_DEFAULT_COURSE_ID?.trim() ?? "",
					alreadyEnrolled: false,
				}
			}
			if (isGatewayFailure(msg)) {
				this.logger.warn(
					`[lms] course-enrollments gateway failure (502/504) — assuming already enrolled class=${input.classCode}`
				)
				return {
					classId: `gw_fallback_${input.classCode}`,
					courseId: input.courseId ?? env.LMS_INTEGRATION_DEFAULT_COURSE_ID?.trim() ?? "",
					alreadyEnrolled: true,
				}
			}
			throw err
		}
		const data = (raw ?? {}) as {
			classId?: string
			class_id?: string
			courseId?: string
			course_id?: string
			alreadyEnrolled?: boolean
			already_enrolled?: boolean
		}
		const classId = data.classId ?? data.class_id
		const courseId = data.courseId ?? data.course_id ?? input.courseId ?? ""
		const alreadyEnrolled = data.alreadyEnrolled ?? data.already_enrolled ?? false
		if (!classId) {
			throw new Error(
				`LMS course-enrollments: missing classId in response. Got keys: ${Object.keys(data).join(",")}`
			)
		}
		return { classId, courseId, alreadyEnrolled }
	}

	/**
	 * Generate an SSO handoff to QLearn (draft §3 or HMAC spec).
	 *
	 * **hmac (default):** Signs `email:exp` locally and opens QLearn `/sso/auto` (or course URL with
	 * middleware). See `docs/integrations/lms-sso-handshake-spec.md`.
	 *
	 * **create_code:** POSTs `/integration/sso/create-code` when mode is `create_code`; on failure,
	 * falls back to HMAC when {@link canUseHmacHandoff} is true.
	 */
	async createSsoCode(input: LmsCreateSsoCodeInput): Promise<LmsCreateSsoCodeResult> {
		if (this.isStubMode) {
			return this.buildLocalHmacFallback(input)
		}

		if (env.LMS_INTEGRATION_SSO_HANDOFF_MODE === "hmac") {
			return this.buildLocalHmacFallback(input)
		}

		// Real mode (create_code): ask QLearn to mint the code.
		try {
			const raw = await this.post<Record<string, unknown> | null>(
				"/integration/sso/create-code",
				this.toSsoCreateCodeRequestBody(input)
			)
			const data = this.unwrapLmsPayload(raw)
			const code =
				(typeof data.code === "string" && data.code) ||
				(typeof data.ssoCode === "string" && data.ssoCode) ||
				undefined
			if (!code) {
				throw new Error(
					`LMS sso/create-code: missing code in response. Got keys: ${Object.keys(data).join(",")}`
				)
			}
			const expiresInSeconds = resolveSsoCodeExpiresInSeconds(data, SSO_TOKEN_TTL_SECONDS)
			const apiRedirect =
				(typeof data.redirectUrl === "string" && data.redirectUrl) ||
				(typeof data.redirect_url === "string" && data.redirect_url) ||
				undefined
			const builtRedirect = this.buildCodeRedirectUrl(
				code,
				input.classCode,
				input.redirectUri,
				input.qlegalReturnUri,
				input.courseId
			)
			let redirectUrl = builtRedirect
			if (apiRedirect && isUsableSsoRedirectUrl(apiRedirect, code)) {
				redirectUrl = apiRedirect
				const u = new URL(apiRedirect)
				this.logger.log(
					`[lms] sso/create-code ${input.id} using API redirect path=${u.pathname} hasCode=true`
				)
			} else if (apiRedirect) {
				const u = new URL(apiRedirect)
				this.logger.warn(
					`[lms] sso/create-code ${input.id} ignoring API redirect path=${u.pathname} hasCode=${u.searchParams.has("code")} — using /sso/callback redeem URL`
				)
			} else {
				this.logger.warn(
					`[lms] sso/create-code ${input.id} no redirectUrl in response (keys=${Object.keys(data).join(",")}); built redeem URL`
				)
			}
			redirectUrl = this.normalizeSsoHandoffUrl(redirectUrl, input)
			return { code, redirectUrl, expiresInSeconds, handoffMode: "create_code" }
		} catch (err) {
			// Do not fall back to /sso/auto — QLearn returns 404 until that route is deployed.
			const allowHmacFallback =
				env.LMS_INTEGRATION_SSO_HMAC_FALLBACK === "true" && this.canUseHmacHandoff()
			if (!allowHmacFallback) throw err
			const msg = err instanceof Error ? err.message : String(err)
			this.logger.warn(`[lms] sso/create-code failed, using HMAC handoff: ${msg}`)
			return this.buildLocalHmacFallback(input)
		}
	}

	private canUseHmacHandoff(): boolean {
		return !!env.LMS_INTEGRATION_SHARED_SECRET?.trim()
	}

	/** Local HMAC handoff — QLearn `/sso/auto` (or course middleware) verifies `sig` and mints session. */
	private buildLocalHmacFallback(input: LmsCreateSsoCodeInput): LmsCreateSsoCodeResult {
		const exp = Math.floor(Date.now() / 1000) + SSO_TOKEN_TTL_SECONDS
		const secret = env.LMS_INTEGRATION_SHARED_SECRET?.trim()
		const sig = secret
			? createHmac("sha256", secret).update(`${input.email}:${exp}`).digest("hex")
			: null
		const redirectUrl = this.buildSsoRedirectUrl({
			email: input.email,
			exp,
			sig,
			classCode: input.classCode,
			qlegalReturnUri: input.qlegalReturnUri ?? input.redirectUri,
		})
		this.logger.debug(`[sso-hmac] ${input.id} signed=${!!sig} -> ${redirectUrl}`)
		return {
			code: sig ?? `unsigned-${exp}`,
			redirectUrl,
			expiresInSeconds: SSO_TOKEN_TTL_SECONDS,
			handoffMode: "hmac",
		}
	}

	/**
	 * Browser entry for HMAC SSO. Prefer `LMS_INTEGRATION_COURSE_URL` when it is already `/sso/auto`;
	 * otherwise open `/sso/auto` on the QLearn host with `redirect` = course view (post-login landing).
	 */
	private resolveHmacEntryUrl(qlegalReturnUri?: string): string {
		const course = env.LMS_INTEGRATION_COURSE_URL?.trim()
		const redeem = env.LMS_INTEGRATION_SSO_REDEEM_URL?.trim()

		if (course) {
			const courseUrl = new URL(course)
			if (courseUrl.pathname.includes("/sso/auto")) {
				return course
			}
			const origin = redeem ? new URL(redeem).origin : courseUrl.origin
			const entry = new URL("/sso/auto", origin)
			entry.searchParams.set("redirect", course)
			if (qlegalReturnUri?.trim()) {
				entry.searchParams.set("returnTo", qlegalReturnUri.trim())
			}
			return entry.toString()
		}

		if (redeem) {
			const entry = new URL(redeem.replace(/\/sso\/login\/?$/i, "/sso/auto"))
			if (qlegalReturnUri?.trim()) {
				entry.searchParams.set("returnTo", qlegalReturnUri.trim())
			}
			return entry.toString()
		}

		const entry = new URL("https://qlearn.quanbyit.com/sso/auto")
		if (qlegalReturnUri?.trim()) {
			entry.searchParams.set("returnTo", qlegalReturnUri.trim())
		}
		return entry.toString()
	}

	/**
	 * Ensure SSO handoff URLs always carry the course landing target QLearn should use after
	 * login and first-time theme onboarding (not the student dashboard).
	 */
	private normalizeSsoHandoffUrl(handoffUrl: string, input: LmsCreateSsoCodeInput): string {
		const url = new URL(handoffUrl)
		const existingRedirect = url.searchParams.get("redirect")
		if (shouldOverridePostLoginRedirect(existingRedirect)) {
			url.searchParams.set("redirect", input.redirectUri)
			if (existingRedirect) {
				this.logger.warn(
					`[lms] sso/create-code ${input.id} replaced post-login redirect ${existingRedirect} -> ${input.redirectUri}`
				)
			}
		}
		const courseId = resolveLmsCourseId(input.courseId)
		if (courseId && !url.searchParams.get("courseId")) {
			url.searchParams.set("courseId", courseId)
		}
		if (!url.searchParams.get("classCode")) {
			url.searchParams.set("classCode", input.classCode)
		}
		if (input.qlegalReturnUri?.trim() && !url.searchParams.get("returnTo")) {
			url.searchParams.set("returnTo", input.qlegalReturnUri.trim())
		}
		return url.toString()
	}

	/** Build the browser redirect when QLearn returns `code` without a pre-built `redirectUrl`. */
	private buildCodeRedirectUrl(
		code: string,
		classCode: string,
		/** Post-SSO course landing on QLearn (matches create-code `redirectUri`). */
		qlearnPostLoginUri: string,
		qlegalReturnUri?: string,
		courseId?: string
	): string {
		const redeemBase =
			env.LMS_INTEGRATION_SSO_REDEEM_URL?.trim() ?? "https://qlearn.quanbyit.com/sso/callback"
		const url = new URL(redeemBase)
		url.searchParams.set("code", code)
		url.searchParams.set("classCode", classCode)
		url.searchParams.set("redirect", qlearnPostLoginUri)
		const resolvedCourseId = resolveLmsCourseId(courseId)
		if (resolvedCourseId) {
			url.searchParams.set("courseId", resolvedCourseId)
		}
		if (qlegalReturnUri?.trim()) {
			url.searchParams.set("returnTo", qlegalReturnUri.trim())
		}
		return url.toString()
	}

	/** QLearn `GET /integration/certificates/:certificateNumber/download?classCode=…` (server-to-server only). */
	buildCertificateDownloadUrl(certificateNumber: string, classCode: string): string | null {
		if (!this.baseUrl) return null
		const params = new URLSearchParams({ classCode })
		return `${this.baseUrl}/integration/certificates/${encodeURIComponent(certificateNumber)}/download?${params}`
	}

	/** Fetch certificate PDF bytes from QLearn using integration API credentials. */
	async downloadCertificateFile(input: {
		certificateNumber: string
		classCode: string
	}): Promise<{ buffer: Buffer; contentType: string }> {
		if (this.isStubMode) {
			throw new Error("LMS certificate download unavailable in stub mode")
		}
		const params = new URLSearchParams({ classCode: input.classCode })
		const path = `/integration/certificates/${encodeURIComponent(input.certificateNumber)}/download?${params}`
		return this.getBinary(path)
	}

	/** Fetch certificate PDF from a public URL returned by certificates/query (e.g. S3 pdfUrl). */
	async downloadCertificateFromUrl(
		pdfUrl: string
	): Promise<{ buffer: Buffer; contentType: string }> {
		if (!pdfUrl.trim()) {
			throw new Error("Certificate PDF URL is empty")
		}
		let res: Response
		try {
			res = await fetch(pdfUrl, { method: "GET", redirect: "follow" })
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.logger.error(`[lms] GET certificate pdfUrl network error: ${msg}`)
			throw new Error(`LMS certificate PDF fetch failed: ${msg}`)
		}
		if (!res.ok) {
			const text = await res.text().catch(() => "")
			throw new Error(
				`LMS certificate PDF fetch failed (${res.status}): ${text.slice(0, 500) || res.statusText}`
			)
		}
		const buffer = Buffer.from(await res.arrayBuffer())
		const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "application/pdf"
		this.logger.debug(`[lms] GET certificate pdfUrl -> ${res.status} ${buffer.byteLength} bytes`)
		return { buffer, contentType }
	}

	private async getBinary(path: string): Promise<{ buffer: Buffer; contentType: string }> {
		if (!this.baseUrl) {
			throw new Error(`LmsClient.getBinary called in stub mode (path=${path})`)
		}
		const url = `${this.baseUrl}${path}`
		const headers: Record<string, string> = {
			accept: "application/pdf, application/octet-stream, */*",
		}
		const apiKey = env.LMS_INTEGRATION_API_KEY?.trim()
		if (apiKey) headers.authorization = `Bearer ${apiKey}`

		let res: Response
		try {
			res = await fetch(url, { method: "GET", headers, redirect: "follow" })
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.logger.error(`[lms] GET ${path} network error: ${msg}`)
			throw new Error(`LMS network error on GET ${path}: ${msg}`)
		}

		if (!res.ok) {
			const text = await res.text().catch(() => "")
			this.logger.warn(
				`[lms] GET ${path} -> ${res.status}: ${text.slice(0, 500) || res.statusText}`
			)
			throw new Error(
				`LMS GET ${path} failed (${res.status}): ${text.slice(0, 500) || res.statusText}`
			)
		}

		const buffer = Buffer.from(await res.arrayBuffer())
		const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "application/pdf"
		this.logger.debug(`[lms] GET ${path} -> ${res.status} ${buffer.byteLength} bytes`)
		return { buffer, contentType }
	}

	async getProgress(input: LmsProgressInput): Promise<LmsProgressResult> {
		if (this.isStubMode) {
			this.logger.debug(`[stub] progress/query ${input.id} ${input.classCode}`)
			return {
				progressPercent: 0,
				completion: "not_started",
				passed: false,
				lastAccessedAt: null,
			}
		}
		let raw: Record<string, unknown> | null
		try {
			raw = await this.post<Record<string, unknown> | null>(
				"/integration/progress/query",
				this.toProgressRequestBody(input)
			)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			// Some QLearn deployments haven't shipped this endpoint yet; avoid breaking onboarding.
			if (msg.includes("/integration/progress/query") && msg.includes("(404")) {
				this.logger.warn("[lms] progress/query unavailable (404) — using default not_started")
				return {
					progressPercent: 0,
					completion: "not_started",
					passed: false,
					lastAccessedAt: null,
				}
			}
			// QLearn intermittently returns nginx 502/504. Keep dashboard usable with a safe fallback.
			if (msg.includes("/integration/progress/query") && isGatewayFailure(msg)) {
				this.logger.warn(
					"[lms] progress/query gateway failure (502/504) — using default not_started"
				)
				return {
					progressPercent: 0,
					completion: "not_started",
					passed: false,
					lastAccessedAt: null,
				}
			}
			throw err
		}
		const data = this.unwrapLmsPayload(raw)
		const parsed = parseLmsProgressPayload(data)
		this.logger.debug(
			`[lms] progress/query ${input.id} class=${input.classCode} -> ${parsed.progressPercent}% ${parsed.completion} passed=${parsed.passed}`
		)
		return parsed
	}

	async validateCertificate(
		input: LmsValidateCertificateInput
	): Promise<LmsValidateCertificateResult> {
		if (this.isStubMode) {
			this.logger.debug(
				`[stub] certificates/validate ${input.certificateNumber} (${input.classCode})`
			)
			return { valid: false }
		}
		const raw = await this.post<Record<string, unknown> | null>(
			"/integration/certificates/validate",
			input
		)
		const data = (raw ?? {}) as {
			valid?: boolean
			owner?: { firstName?: string; lastName?: string; email?: string }
			courseTitle?: string
			course_title?: string
			issuedAt?: string
			issued_at?: string
		}
		return {
			valid: data.valid ?? false,
			owner: data.owner,
			courseTitle: data.courseTitle ?? data.course_title,
			issuedAt: data.issuedAt ?? data.issued_at,
		}
	}

	async getCertificate(input: LmsCertificateInput): Promise<LmsCertificateResult> {
		if (this.isStubMode) {
			this.logger.debug(`[stub] certificates/query ${input.id} ${input.classCode}`)
			return { issued: false }
		}
		// Per draft §5 this is the only endpoint Kenneth has already marked Done, so it's
		// the safest one to validate the base URL + auth setup against first.
		let raw: Record<string, unknown> | null
		try {
			raw = await this.post<Record<string, unknown> | null>(
				"/integration/certificates/query",
				this.toCertificateRequestBody(input)
			)
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			if (msg.includes("/integration/certificates/query") && isGatewayFailure(msg)) {
				this.logger.warn(
					"[lms] certificates/query gateway failure (502/504) — treating as not issued"
				)
				return { issued: false }
			}
			throw err
		}
		const parsed = parseLmsCertificatePayload(
			this.unwrapLmsPayload(raw),
			input.classCode,
			(num, code) => this.buildCertificateDownloadUrl(num, code)
		)
		this.logger.debug(
			`[lms] certificates/query ${input.id} class=${input.classCode} -> issued=${parsed.issued}${parsed.issued && parsed.certificateNumber ? ` number=${parsed.certificateNumber}` : ""}`
		)
		return parsed
	}

	/**
	 * Build the browser-facing redirect URL with HMAC SSO params.
	 *
	 * Appended query params (consumed by QLearn's `/sso/auto` handler — see spec doc):
	 *   - `email` — QLegal-verified user email
	 *   - `exp`   — unix-seconds expiry
	 *   - `sig`   — HMAC-SHA256(LMS_INTEGRATION_SHARED_SECRET, `${email}:${exp}`)
	 *   - `class` — enrollment context (for QLearn to pick the right course post-login)
	 *
	 * When the shared secret is unset (purely local dev with no QLearn coordination yet),
	 * `sig` is omitted but email/exp/class are still appended so QLearn's login page can
	 * at least pre-fill the email field while we wait on the handler to ship.
	 */
	private buildSsoRedirectUrl(input: {
		email: string
		exp: number
		sig: string | null
		classCode: string
		qlegalReturnUri?: string
	}): string {
		const url = new URL(this.resolveHmacEntryUrl(input.qlegalReturnUri))
		url.searchParams.set("email", input.email)
		url.searchParams.set("exp", String(input.exp))
		if (input.sig) url.searchParams.set("sig", input.sig)
		url.searchParams.set("class", input.classCode)
		return url.toString()
	}
}
