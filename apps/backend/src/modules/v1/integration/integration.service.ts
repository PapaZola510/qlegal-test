import { Injectable, Logger } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { ORPCError } from "@orpc/server"
import { eq } from "drizzle-orm"
import type { Response } from "express"

import { enpProfiles, users } from "@repo/db/schema"

import { buildLmsUpsertInput } from "@/services/lms/build-lms-upsert-input"
import { isLmsTrainingComplete, LmsClient } from "@/services/lms/lms.client"
import { db } from "@/common/database/database.client"
import type { V1Outputs } from "@/config/contract-types"
import { env, publicAppUrl } from "@/config/env.config"

type StartTrainingDto = V1Outputs["integration"]["startTraining"]
type SyncAccountDto = V1Outputs["integration"]["syncAccount"]
type ProgressDto = V1Outputs["integration"]["progress"]
type CertificateDto = V1Outputs["integration"]["certificate"]
type SimulateDto = V1Outputs["integration"]["simulateCompletion"]

const DEFAULT_CLASS_CODE = "ENP-BATCH-DEFAULT"

function isLmsIntegrationConfigured(): boolean {
	return Boolean(env.LMS_INTEGRATION_BASE_URL?.trim())
}

/** True when a stored id was invented locally — not issued by QLearn. */
function isLocallyGeneratedCertificateId(certificateId: string | null | undefined): boolean {
	if (!certificateId?.trim()) return false
	const id = certificateId.trim().toUpperCase()
	return id.startsWith("QL-ENP-") || id.startsWith("QL-LMS-")
}

/** QLearn create-code body: where the learner lands on QLearn after SSO (course view). */
function lmsCreateCodeRedirectUri(): string {
	const explicit = env.LMS_INTEGRATION_SSO_REDIRECT_URI?.trim()
	if (explicit) return explicit
	const course = env.LMS_INTEGRATION_COURSE_URL?.trim()
	if (course) return course
	throw new ORPCError("BAD_REQUEST", {
		message:
			"Set LMS_INTEGRATION_COURSE_URL or LMS_INTEGRATION_SSO_REDIRECT_URI (QLearn course URL for create-code redirectUri).",
	})
}

/** QLegal page after the learner returns from QLearn (fallback redeem URL `returnTo` only). */
function lmsQlegalReturnUri(): string {
	const explicit = env.LMS_INTEGRATION_QLEGAL_RETURN_URI?.trim()
	if (explicit) return explicit
	return `${publicAppUrl()}/sso/callback`
}

/** Browser-facing download route (proxies QLearn integration API with server credentials). */
function qlegalLmsCertificateDownloadUrl(asAttachment = true): string {
	const base = `${publicAppUrl()}/api/v1/integration/lms/training/certificate/download`
	return asAttachment ? `${base}?download=1` : base
}

@Injectable()
export class IntegrationService {
	private readonly log = new Logger(IntegrationService.name)

	constructor(private readonly lms: LmsClient) {}

	/** Persist QLearn `certificateNumber` on the ENP profile (never a locally invented id). */
	private async reconcileQlearnCertificateId(
		userId: string,
		certificateNumber: string
	): Promise<void> {
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		if (!enp) return
		const now = new Date()
		if (
			enp.certificateId === certificateNumber &&
			enp.certificateStatus === "certified" &&
			enp.courseCompletedAt &&
			!isLocallyGeneratedCertificateId(enp.certificateId)
		) {
			return
		}
		await db
			.update(enpProfiles)
			.set({
				certificateId: certificateNumber,
				certificateStatus: "certified",
				courseCompletedAt: enp.courseCompletedAt ?? now,
				updatedAt: now,
			})
			.where(eq(enpProfiles.userId, userId))
	}

	private shouldCallEnrollment(): boolean {
		return env.LMS_INTEGRATION_ENROLLMENT_MODE !== "skip"
	}

	/**
	 * QLearn flow: upsert → create-code SSO → browser `redirectUrl` (enroll optional via env).
	 */
	async startTraining(userId: string): Promise<StartTrainingDto> {
		const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
		if (!userRow) {
			throw new ORPCError("UNAUTHORIZED", { message: "User not found" })
		}

		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		if (!enp) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only ENP users can start LMS training.",
			})
		}

		const classCode = env.LMS_INTEGRATION_DEFAULT_CLASS_CODE?.trim() ?? DEFAULT_CLASS_CODE
		const redirectUri = lmsCreateCodeRedirectUri()
		const qlegalReturnUri = lmsQlegalReturnUri()
		const courseId = env.LMS_INTEGRATION_DEFAULT_COURSE_ID?.trim() || undefined

		const liveBase = env.LMS_INTEGRATION_BASE_URL?.trim()
		if (
			liveBase &&
			env.LMS_INTEGRATION_SSO_HANDOFF_MODE === "hmac" &&
			!env.LMS_INTEGRATION_COURSE_URL?.trim()
		) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"LMS_INTEGRATION_COURSE_URL must point at QLearn (course or /sso entry) when LMS_INTEGRATION_SSO_HANDOFF_MODE=hmac.",
			})
		}
		if (
			liveBase &&
			env.LMS_INTEGRATION_SSO_HANDOFF_MODE === "hmac" &&
			!env.LMS_INTEGRATION_SHARED_SECRET?.trim()
		) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"LMS_INTEGRATION_SHARED_SECRET is required when LMS_INTEGRATION_SSO_HANDOFF_MODE=hmac (must match QLearn QLEGAL_SSO_SHARED_SECRET).",
			})
		}

		let upsert
		let enrollment
		let sso
		try {
			const enrollmentMode = this.shouldCallEnrollment() ? "required" : "skip"
			this.log.log(
				`[lms-flow] startTraining user=${userId} enrollmentMode=${enrollmentMode} handoff=${env.LMS_INTEGRATION_SSO_HANDOFF_MODE} class=${classCode} redirectUri=${redirectUri}`
			)
			upsert = await this.lms.upsertUser(buildLmsUpsertInput(userRow, enp))
			if (this.shouldCallEnrollment()) {
				enrollment = await this.lms.enroll({
					id: userId,
					classCode,
					...(env.LMS_INTEGRATION_DEFAULT_COURSE_ID?.trim()
						? { courseId: env.LMS_INTEGRATION_DEFAULT_COURSE_ID.trim() }
						: {}),
				})
			} else {
				enrollment = {
					classId: `skip_${classCode}`,
					courseId: env.LMS_INTEGRATION_DEFAULT_COURSE_ID?.trim() ?? "",
					alreadyEnrolled: true,
				}
				this.log.log(
					`[lms-flow] startTraining enroll skipped (QLearn flow: upsert + SSO only) user=${userId} class=${classCode}`
				)
			}
			sso = await this.lms.createSsoCode({
				id: userId,
				email: userRow.email,
				redirectUri,
				qlegalReturnUri,
				classCode,
				courseId,
			})
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			this.log.warn(`startTraining LMS call failed for user=${userId}: ${msg}`)
			throw new ORPCError("BAD_GATEWAY", {
				message: msg.includes("LMS") ? msg : `Could not reach QLearn: ${msg}`,
			})
		}

		try {
			const handoff = new URL(sso.redirectUrl)
			this.log.log(
				`startTraining user=${userId} lms=${upsert.lmsUserId} action=${upsert.action} class=${classCode} alreadyEnrolled=${enrollment.alreadyEnrolled} handoffPath=${handoff.pathname} handoffHasCode=${handoff.searchParams.has("code")} mode=${sso.handoffMode}`
			)
		} catch {
			this.log.log(
				`startTraining user=${userId} lms=${upsert.lmsUserId} action=${upsert.action} class=${classCode} alreadyEnrolled=${enrollment.alreadyEnrolled} stub=${this.lms.isStubMode}`
			)
		}

		// Demo login is only for stub mode; live LMS uses upsert + SSO for the signed-in ENP.
		const demoCredentials =
			this.lms.isStubMode && env.LMS_INTEGRATION_DEMO_EMAIL && env.LMS_INTEGRATION_DEMO_PASSWORD
				? {
						email: env.LMS_INTEGRATION_DEMO_EMAIL,
						password: env.LMS_INTEGRATION_DEMO_PASSWORD,
					}
				: null

		return {
			redirectUrl: sso.redirectUrl,
			classCode,
			alreadyEnrolled: enrollment.alreadyEnrolled,
			codeExpiresInSeconds: sso.expiresInSeconds,
			ssoHandoffMode: sso.handoffMode,
			demoCredentials,
		}
	}

	/** Draft §1 + §2 only: register learner in QLearn without minting an SSO code or opening a tab. */
	async syncAccount(userId: string): Promise<SyncAccountDto> {
		const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
		if (!userRow) {
			throw new ORPCError("UNAUTHORIZED", { message: "User not found" })
		}

		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		if (!enp) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only ENP users can sync to QLearn.",
			})
		}

		const classCode = env.LMS_INTEGRATION_DEFAULT_CLASS_CODE?.trim() ?? DEFAULT_CLASS_CODE

		let upsert
		let enrollment
		try {
			const enrollmentMode = this.shouldCallEnrollment() ? "required" : "skip"
			this.log.log(
				`[lms-flow] syncAccount user=${userId} enrollmentMode=${enrollmentMode} class=${classCode}`
			)
			upsert = await this.lms.upsertUser(buildLmsUpsertInput(userRow, enp))
			if (this.shouldCallEnrollment()) {
				enrollment = await this.lms.enroll({
					id: userId,
					classCode,
					...(env.LMS_INTEGRATION_DEFAULT_COURSE_ID?.trim()
						? { courseId: env.LMS_INTEGRATION_DEFAULT_COURSE_ID.trim() }
						: {}),
				})
			} else {
				enrollment = {
					classId: `skip_${classCode}`,
					courseId: env.LMS_INTEGRATION_DEFAULT_COURSE_ID?.trim() ?? "",
					alreadyEnrolled: true,
				}
				this.log.log(
					`[lms-flow] syncAccount enroll skipped (QLearn flow: upsert only) user=${userId} class=${classCode}`
				)
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			this.log.warn(`syncAccount LMS call failed for user=${userId}: ${msg}`)
			throw new ORPCError("BAD_GATEWAY", {
				message: msg.includes("LMS") ? msg : `Could not reach QLearn: ${msg}`,
			})
		}

		this.log.log(
			`syncAccount user=${userId} lms=${upsert.lmsUserId} action=${upsert.action} class=${classCode} alreadyEnrolled=${enrollment.alreadyEnrolled} stub=${this.lms.isStubMode}`
		)

		return {
			success: true as const,
			lmsUserId: upsert.lmsUserId,
			upsertAction: upsert.action,
			classCode,
			alreadyEnrolled: enrollment.alreadyEnrolled,
		}
	}

	async getProgress(userId: string): Promise<ProgressDto> {
		const classCode = env.LMS_INTEGRATION_DEFAULT_CLASS_CODE?.trim()
		if (!classCode) {
			return {
				enrolled: false,
				classCode: null,
				progressPercent: 0,
				completion: "not_started",
				passed: false,
				lastAccessedAt: null,
			}
		}

		const [enp] = await db
			.select({
				certificateStatus: enpProfiles.certificateStatus,
				courseCompletedAt: enpProfiles.courseCompletedAt,
			})
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, userId))
			.limit(1)

		if (enp?.courseCompletedAt || enp?.certificateStatus === "certified") {
			return {
				enrolled: true,
				classCode,
				progressPercent: 100,
				completion: "completed",
				passed: true,
				lastAccessedAt: null,
			}
		}

		try {
			const progress = await this.lms.getProgress({ id: userId, classCode })
			let cert: Awaited<ReturnType<LmsClient["getCertificate"]>> | null = null
			try {
				cert = await this.lms.getCertificate({ id: userId, classCode })
			} catch {
				// certificate optional for progress display
			}
			if (isLmsTrainingComplete(progress, cert)) {
				return {
					enrolled: true,
					classCode,
					progressPercent: Math.max(progress.progressPercent, 100),
					completion: "completed",
					passed: true,
					lastAccessedAt: progress.lastAccessedAt,
				}
			}
			return {
				enrolled: true,
				classCode,
				progressPercent: progress.progressPercent,
				completion: progress.completion,
				passed: progress.passed,
				lastAccessedAt: progress.lastAccessedAt,
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			this.log.warn(`getProgress failed for user=${userId}: ${msg}`)
			return {
				enrolled: false,
				classCode,
				progressPercent: 0,
				completion: "not_started",
				passed: false,
				lastAccessedAt: null,
			}
		}
	}

	async getCertificate(userId: string): Promise<CertificateDto> {
		const classCode = env.LMS_INTEGRATION_DEFAULT_CLASS_CODE?.trim()
		if (!classCode) {
			return { issued: false }
		}

		let cert: Awaited<ReturnType<LmsClient["getCertificate"]>>
		try {
			cert = await this.lms.getCertificate({ id: userId, classCode })
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			this.log.warn(`getCertificate failed for user=${userId}: ${msg}`)
			return { issued: false }
		}
		if (!cert.issued || !cert.certificateNumber) {
			return { issued: false }
		}
		if (isLmsIntegrationConfigured()) {
			await this.reconcileQlearnCertificateId(userId, cert.certificateNumber)
		}
		return {
			issued: true,
			certificateNumber: cert.certificateNumber,
			issuedAt: cert.issuedAt ?? new Date().toISOString(),
			downloadUrl: qlegalLmsCertificateDownloadUrl(true),
			verifyUrl: cert.verifyUrl ?? `https://qlearn.quanbyit.com/student/certificates`,
		}
	}

	/** Stream QLearn certificate PDF through qLegal (session auth → integration API key). */
	async streamCertificateDownload(
		userId: string,
		res: Response,
		opts?: { download?: boolean }
	): Promise<void> {
		const classCode = env.LMS_INTEGRATION_DEFAULT_CLASS_CODE?.trim()
		if (!classCode) {
			throw new ORPCError("BAD_REQUEST", {
				message: "LMS integration class code is not configured.",
			})
		}

		const cert = await this.lms.getCertificate({ id: userId, classCode })
		if (!cert.issued || !cert.certificateNumber) {
			throw new ORPCError("NOT_FOUND", {
				message: "QLearn certificate is not issued yet.",
			})
		}

		let file: { buffer: Buffer; contentType: string }
		try {
			file = await this.lms.downloadCertificateFile({
				certificateNumber: cert.certificateNumber,
				classCode,
			})
		} catch (err) {
			const pdfUrl = cert.pdfUrl ?? cert.downloadUrl
			if (pdfUrl?.startsWith("http")) {
				this.log.warn(
					`streamCertificateDownload integration download failed user=${userId}, falling back to pdfUrl`
				)
				file = await this.lms.downloadCertificateFromUrl(pdfUrl)
			} else {
				const msg = err instanceof Error ? err.message : String(err)
				throw new ORPCError("BAD_GATEWAY", {
					message: `Could not download QLearn certificate: ${msg}`,
				})
			}
		}

		const filename = `qlearn-certificate-${cert.certificateNumber}.pdf`
		res.setHeader("Content-Type", file.contentType)
		res.setHeader(
			"Content-Disposition",
			opts?.download ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`
		)
		res.setHeader("Cache-Control", "private, max-age=300")
		res.status(200).send(file.buffer)
	}

	async simulateCompletion(userId: string): Promise<SimulateDto> {
		if (env.NODE_ENV === "production") {
			throw new ORPCError("FORBIDDEN", {
				message: "simulateCompletion is disabled in production.",
			})
		}
		if (isLmsIntegrationConfigured()) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"simulateCompletion is disabled when QLearn LMS integration is active. Complete the course on QLearn and sync progress.",
			})
		}
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		if (!enp) {
			throw new ORPCError("FORBIDDEN", { message: "ENP profile required." })
		}

		const now = new Date()
		const certificateId =
			enp.certificateId ?? `QL-LMS-DEV-${randomUUID().slice(0, 8).toUpperCase()}`

		await db
			.update(enpProfiles)
			.set({
				courseCompletedAt: enp.courseCompletedAt ?? now,
				certificateStatus: "certified",
				certificateId,
				updatedAt: now,
			})
			.where(eq(enpProfiles.userId, userId))

		return { success: true, certificateId }
	}

	/** Used by onboarding: mark course + QLearn Final Quiz complete when progress reports passed/completed. */
	async syncCourseCompletionFromLms(userId: string): Promise<{ completed: boolean }> {
		const classCode = env.LMS_INTEGRATION_DEFAULT_CLASS_CODE?.trim()
		const progress = await this.getProgress(userId)

		let certificate: Awaited<ReturnType<LmsClient["getCertificate"]>> | null = null
		if (classCode) {
			try {
				certificate = await this.lms.getCertificate({ id: userId, classCode })
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err)
				this.log.warn(`syncCourseCompletion certificate lookup failed user=${userId}: ${msg}`)
			}
		}

		if (!isLmsTrainingComplete(progress, certificate)) {
			this.log.warn(
				`syncCourseCompletion not ready user=${userId} progressPercent=${progress.progressPercent} completion=${progress.completion} passed=${progress.passed} certIssued=${certificate?.issued ?? false}`
			)
			return { completed: false }
		}

		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		if (!enp) {
			return { completed: false }
		}

		if (enp.courseCompletedAt && enp.certificateStatus !== "none") {
			if (certificate?.issued && certificate.certificateNumber) {
				await this.reconcileQlearnCertificateId(userId, certificate.certificateNumber)
			}
			return { completed: true }
		}

		const now = new Date()
		await db
			.update(enpProfiles)
			.set({
				courseCompletedAt: enp.courseCompletedAt ?? now,
				certificateStatus: "certified",
				...(certificate?.issued && certificate.certificateNumber
					? { certificateId: certificate.certificateNumber }
					: {}),
				updatedAt: now,
			})
			.where(eq(enpProfiles.userId, userId))

		return { completed: true }
	}
}
