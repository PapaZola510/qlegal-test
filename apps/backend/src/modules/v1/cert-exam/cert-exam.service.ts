import { Inject, Injectable, Logger } from "@nestjs/common"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import { ORPCError } from "@orpc/server"
import { and, asc, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm"
import { PDFDocument, StandardFonts } from "pdf-lib"

import {
	auditEvents,
	enpProfiles,
	examAttemptAnswers,
	examAttempts,
	examQuestionRevisions,
	examQuestions,
	examVersions,
	paymentIntents,
	users,
} from "@repo/db/schema"

import { EMAIL_ADAPTER, type EmailAdapter } from "@/services/email/email-adapter"
import { db } from "@/common/database/database.client"
import type { V1Outputs } from "@/config/contract-types"
import { env } from "@/config/env.config"

import {
	choiceSlotToOriginalPermutation,
	correctDisplayedChoiceKey,
	shuffleWithSeed,
} from "./cert-exam-shuffle.js"

const CHOICE_KEYS = ["a", "b", "c", "d"] as const

type ExamQuestionDto = V1Outputs["certExam"]["startExam"]["questions"][number]
type ExamAttemptDto = V1Outputs["certExam"]["startExam"]["attempt"]
type ExamResultDto = V1Outputs["certExam"]["submitExam"]
type ExamDto = V1Outputs["certExam"]["listExams"][number]

function hashResumeToken(token: string): string {
	return createHash("sha256").update(token, "utf8").digest("hex")
}

function choiceKeyToIndex(key: string): number {
	const k = key.trim().toLowerCase()
	const i = CHOICE_KEYS.indexOf(k as (typeof CHOICE_KEYS)[number])
	if (i < 0) throw new ORPCError("BAD_REQUEST", { message: `Invalid choice key: ${key}` })
	return i
}

function choiceKeyToIndexSafe(key: string): number {
	const k = key.trim().toLowerCase()
	return CHOICE_KEYS.indexOf(k as (typeof CHOICE_KEYS)[number])
}

@Injectable()
export class CertExamService {
	private readonly log = new Logger(CertExamService.name)

	constructor(@Inject(EMAIL_ADAPTER) private readonly email: EmailAdapter) {}

	async listExams(): Promise<ExamDto[]> {
		const rows = await db
			.select()
			.from(examVersions)
			.where(eq(examVersions.isActive, true))
			.orderBy(asc(examVersions.createdAt))
		return rows.map(v => ({
			id: v.id,
			title: v.title,
			description: "Official ENP certification examination (sectioned).",
			durationMinutes: v.durationMinutes,
			passingScore: v.passingScorePct,
			totalQuestions: v.sectionCount * v.questionsPerSection,
			sectionCount: v.sectionCount,
			questionsPerSection: v.questionsPerSection,
			isActive: v.isActive,
		}))
	}

	async getAttempts(userId: string): Promise<ExamAttemptDto[]> {
		const rows = await db
			.select()
			.from(examAttempts)
			.where(eq(examAttempts.userId, userId))
			.orderBy(desc(examAttempts.startedAt))

		return rows.map(a => this.toAttemptDto(a))
	}

	private toAttemptDto(a: typeof examAttempts.$inferSelect): ExamAttemptDto {
		return {
			id: a.id,
			examId: a.examVersionId,
			userId: a.userId,
			status: a.status,
			score: a.score ?? null,
			startedAt: a.startedAt.toISOString(),
			completedAt: a.completedAt?.toISOString() ?? null,
			expiresAt: a.expiresAt.toISOString(),
			sectionsCompleted: a.sectionsCompleted,
			answers: null,
			createdAt: a.createdAt,
			updatedAt: a.updatedAt,
		}
	}

	private async assertEnp(userId: string) {
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		if (!enp) {
			throw new ORPCError("FORBIDDEN", {
				message: "ENP profile required to take the certification exam",
			})
		}
	}

	private async loadVersion(examVersionId: string) {
		const [v] = await db
			.select()
			.from(examVersions)
			.where(eq(examVersions.id, examVersionId))
			.limit(1)
		if (!v || !v.isActive) throw new ORPCError("NOT_FOUND", { message: "Exam not found" })
		return v
	}

	private async assertCanStart(userId: string, version: typeof examVersions.$inferSelect) {
		await this.assertEnp(userId)

		const passed = await db
			.select({ id: examAttempts.id })
			.from(examAttempts)
			.where(
				and(
					eq(examAttempts.userId, userId),
					eq(examAttempts.examVersionId, version.id),
					eq(examAttempts.status, "submitted"),
					eq(examAttempts.passed, true)
				)
			)
			.limit(1)

		if (passed.length > 0) {
			throw new ORPCError("FORBIDDEN", { message: "You have already passed this exam" })
		}

		const failedOrSubmitted = await db
			.select({ id: examAttempts.id })
			.from(examAttempts)
			.where(
				and(
					eq(examAttempts.userId, userId),
					eq(examAttempts.examVersionId, version.id),
					eq(examAttempts.status, "submitted"),
					eq(examAttempts.passed, false)
				)
			)
			.limit(1)

		if (failedOrSubmitted.length === 0) return { paymentIntentId: null as string | null }

		const [intent] = await db
			.select()
			.from(paymentIntents)
			.where(
				and(
					eq(paymentIntents.userId, userId),
					eq(paymentIntents.purpose, "exam_retake"),
					eq(paymentIntents.status, "succeeded"),
					isNull(paymentIntents.consumedAt)
				)
			)
			.limit(1)

		if (!intent) {
			throw new ORPCError("FORBIDDEN", {
				message: "Exam retake requires a successful payment or admin override",
			})
		}

		return { paymentIntentId: intent.id }
	}

	private async latestRevisionsForQuestions(questionIds: string[]) {
		if (questionIds.length === 0)
			return new Map<string, typeof examQuestionRevisions.$inferSelect>()
		const revs = await db
			.select()
			.from(examQuestionRevisions)
			.where(inArray(examQuestionRevisions.questionId, questionIds))
			.orderBy(desc(examQuestionRevisions.createdAt))

		const map = new Map<string, typeof examQuestionRevisions.$inferSelect>()
		for (const r of revs) {
			if (!map.has(r.questionId)) map.set(r.questionId, r)
		}
		return map
	}

	private async orderedQuestionIds(versionId: string, attemptId: string): Promise<string[]> {
		const qs = await db
			.select({
				id: examQuestions.id,
				sectionIndex: examQuestions.sectionIndex,
				displayOrder: examQuestions.displayOrder,
			})
			.from(examQuestions)
			.where(eq(examQuestions.examVersionId, versionId))
			.orderBy(asc(examQuestions.sectionIndex), asc(examQuestions.displayOrder))

		const ids = qs.map(q => q.id)
		return shuffleWithSeed(ids, `${attemptId}:question-order`)
	}

	private async questionIdsForSection(
		version: typeof examVersions.$inferSelect,
		attemptId: string,
		sectionIndex: number
	): Promise<string[]> {
		const all = await this.orderedQuestionIds(version.id, attemptId)
		const per = version.questionsPerSection
		const start = (sectionIndex - 1) * per
		return all.slice(start, start + per)
	}

	private async questionsForSection(
		versionId: string,
		sectionIndex: number,
		attemptId: string
	): Promise<ExamQuestionDto[]> {
		const version = await this.loadVersion(versionId)
		const ids = await this.questionIdsForSection(version, attemptId, sectionIndex)

		const revMap = await this.latestRevisionsForQuestions(ids)
		return ids.map((qid, idx) => {
			const rev = revMap.get(qid)
			if (!rev) throw new ORPCError("BAD_REQUEST", { message: `Missing revision for ${qid}` })
			const texts = rev.choicesJson as [string, string, string, string]
			const perm = choiceSlotToOriginalPermutation(attemptId, qid)
			const choices = perm.map((origIdx, slot) => ({
				key: CHOICE_KEYS[slot]!,
				text: texts[origIdx]!,
			}))
			return {
				id: qid,
				questionText: rev.promptText,
				choices,
				order: idx + 1,
				sectionIndex,
			}
		})
	}

	async startExam(userId: string, examVersionId: string) {
		const version = await this.loadVersion(examVersionId)
		const { paymentIntentId } = await this.assertCanStart(userId, version)

		const now = new Date()
		const [open] = await db
			.select()
			.from(examAttempts)
			.where(
				and(
					eq(examAttempts.userId, userId),
					eq(examAttempts.examVersionId, version.id),
					eq(examAttempts.status, "in_progress")
				)
			)
			.limit(1)
		if (open && open.expiresAt > now) {
			throw new ORPCError("BAD_REQUEST", {
				message: "You already have an in-progress exam attempt for this version",
			})
		}

		const resumeToken = randomBytes(24).toString("hex")
		const resumeHash = hashResumeToken(resumeToken)
		const startedAt = now
		const expiresAt = new Date(startedAt.getTime() + version.durationMinutes * 60_000)

		const [attempt] = await db.transaction(async tx => {
			if (paymentIntentId) {
				await tx
					.update(paymentIntents)
					.set({ consumedAt: new Date(), updatedAt: new Date() })
					.where(eq(paymentIntents.id, paymentIntentId))
			}

			return tx
				.insert(examAttempts)
				.values({
					userId,
					examVersionId: version.id,
					status: "in_progress",
					startedAt,
					expiresAt,
					resumeTokenHash: resumeHash,
					sectionsCompleted: 0,
					paymentIntentId,
				})
				.returning()
		})

		if (!attempt) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to start exam" })

		const questions = await this.questionsForSection(version.id, 1, attempt.id)

		return {
			attempt: this.toAttemptDto(attempt),
			questions,
			resumeToken,
		}
	}

	async resumeExam(userId: string, attemptId: string, resumeToken: string) {
		const [attempt] = await db
			.select()
			.from(examAttempts)
			.where(eq(examAttempts.id, attemptId))
			.limit(1)
		if (!attempt || attempt.userId !== userId) {
			throw new ORPCError("NOT_FOUND", { message: "Attempt not found" })
		}
		if (attempt.status !== "in_progress") {
			throw new ORPCError("BAD_REQUEST", { message: "Attempt is not resumable" })
		}
		if (attempt.resumeUsed) {
			throw new ORPCError("FORBIDDEN", { message: "Resume grace already used" })
		}
		const now = new Date()
		if (now > attempt.expiresAt) {
			throw new ORPCError("BAD_REQUEST", { message: "Exam attempt has expired" })
		}
		if (!attempt.resumeTokenHash || attempt.resumeTokenHash !== hashResumeToken(resumeToken)) {
			throw new ORPCError("FORBIDDEN", { message: "Invalid resume token" })
		}

		const newExpires = new Date(attempt.expiresAt.getTime() + 15 * 60_000)

		const [updated] = await db
			.update(examAttempts)
			.set({
				resumeUsed: true,
				expiresAt: newExpires,
				updatedAt: now,
			})
			.where(eq(examAttempts.id, attemptId))
			.returning()

		if (!updated) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Resume failed" })

		return { expiresAt: updated.expiresAt.toISOString() }
	}

	private assertNotExpired(attempt: typeof examAttempts.$inferSelect) {
		if (new Date() > attempt.expiresAt) {
			throw new ORPCError("BAD_REQUEST", { message: "Exam attempt has expired" })
		}
	}

	async submitSection(
		userId: string,
		attemptId: string,
		sectionIndex: number,
		answers: Record<string, string>
	): Promise<{ nextQuestions: ExamQuestionDto[] | null; result: ExamResultDto | null }> {
		const [attempt] = await db
			.select()
			.from(examAttempts)
			.where(eq(examAttempts.id, attemptId))
			.limit(1)
		if (!attempt || attempt.userId !== userId) {
			throw new ORPCError("NOT_FOUND", { message: "Attempt not found" })
		}
		if (attempt.status !== "in_progress") {
			throw new ORPCError("BAD_REQUEST", { message: "Attempt is not in progress" })
		}
		this.assertNotExpired(attempt)

		const version = await this.loadVersion(attempt.examVersionId)
		const expectedSection = attempt.sectionsCompleted + 1
		if (sectionIndex !== expectedSection) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Expected section ${expectedSection}, got ${sectionIndex}`,
			})
		}

		const sectionQuestionIds = await this.questionIdsForSection(version, attemptId, sectionIndex)

		const ids = new Set(sectionQuestionIds)
		for (const qid of ids) {
			if (answers[qid] === undefined) {
				throw new ORPCError("BAD_REQUEST", { message: `Missing answer for question ${qid}` })
			}
		}
		for (const k of Object.keys(answers)) {
			if (!ids.has(k)) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Unexpected answer key for this section: ${k}`,
				})
			}
		}

		const now = new Date()
		await db.transaction(async tx => {
			for (const qid of ids) {
				const key = answers[qid]
				if (key === undefined) {
					throw new ORPCError("BAD_REQUEST", { message: `Missing answer for question ${qid}` })
				}
				choiceKeyToIndex(key)
				const ck = key.trim().toLowerCase()
				await tx
					.insert(examAttemptAnswers)
					.values({
						attemptId,
						questionId: qid,
						choiceKey: ck,
						updatedAt: now,
					})
					.onConflictDoUpdate({
						target: [examAttemptAnswers.attemptId, examAttemptAnswers.questionId],
						set: { choiceKey: ck, updatedAt: now },
					})
			}

			await tx
				.update(examAttempts)
				.set({
					sectionsCompleted: sectionIndex,
					updatedAt: now,
				})
				.where(eq(examAttempts.id, attemptId))
		})

		if (sectionIndex >= version.sectionCount) {
			const result = await this.finalizeAttempt(userId, attemptId, version)
			return { nextQuestions: null, result }
		}

		const nextQuestions = await this.questionsForSection(version.id, sectionIndex + 1, attemptId)
		return { nextQuestions, result: null }
	}

	private async gradeAttempt(attemptId: string, version: typeof examVersions.$inferSelect) {
		const ans = await db
			.select({
				questionId: examAttemptAnswers.questionId,
				choiceKey: examAttemptAnswers.choiceKey,
			})
			.from(examAttemptAnswers)
			.where(eq(examAttemptAnswers.attemptId, attemptId))

		const answerMap = new Map(ans.map(a => [a.questionId, a.choiceKey]))
		const orderedIds = await this.orderedQuestionIds(version.id, attemptId)
		const revMap = await this.latestRevisionsForQuestions(orderedIds)

		const breakdown: ExamResultDto["breakdown"] = []
		let correct = 0
		for (const qid of orderedIds) {
			const rev = revMap.get(qid)
			if (!rev) continue

			const selectedKey = (answerMap.get(qid) ?? "").trim().toLowerCase()
			const slot = choiceKeyToIndexSafe(selectedKey)
			const perm = choiceSlotToOriginalPermutation(attemptId, qid)
			const chosenOriginal = slot >= 0 && slot < perm.length ? perm[slot]! : -1
			const ok = chosenOriginal === rev.correctChoiceIndex
			if (ok) correct++

			const correctKey = correctDisplayedChoiceKey(attemptId, qid, rev.correctChoiceIndex)
			breakdown.push({
				questionId: qid,
				promptPreview: rev.promptText.slice(0, 140),
				selectedKey: selectedKey || "—",
				correctKey,
				correct: ok,
			})
		}

		const total = orderedIds.length
		const score = total === 0 ? 0 : Math.round((correct / total) * 100)
		const passed = score >= version.passingScorePct
		return { score, passed, correct, total, breakdown }
	}

	private async finalizeAttempt(
		userId: string,
		attemptId: string,
		version: typeof examVersions.$inferSelect
	): Promise<ExamResultDto> {
		const { score, passed, correct, total, breakdown } = await this.gradeAttempt(attemptId, version)
		const now = new Date()

		await db
			.update(examAttempts)
			.set({
				status: "submitted",
				score,
				passed,
				completedAt: now,
				updatedAt: now,
			})
			.where(eq(examAttempts.id, attemptId))

		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		const [urow] = await db
			.select({ email: users.email })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)
		const email = urow?.email

		if (passed && enp && !env.LMS_INTEGRATION_BASE_URL?.trim()) {
			const certificateId = `QL-ENP-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`
			const fullName = `${enp.firstName} ${enp.lastName}`.trim()
			const pdfBytes = await this.buildCertificatePdf({ name: fullName, certificateId })

			await db
				.update(enpProfiles)
				.set({
					certificateId,
					certificateStatus: "certified",
					updatedAt: now,
				})
				.where(eq(enpProfiles.userId, userId))

			await db.insert(auditEvents).values({
				actorUserId: userId,
				subOrgId: enp.subOrgId,
				eventType: "certificate_issued",
				targetTable: "enp_profiles",
				targetId: userId,
				payload: {
					certificateId,
					attemptId,
					score,
					pdfBytesLength: pdfBytes.length,
				},
			})

			if (email) {
				await this.email.sendTransactional(email, "certificate_issued", {
					name: fullName,
					certificateId,
				})
				await this.email.sendTransactional(email, "exam_pass", {
					score: String(score),
					certificateId,
				})
			}
		} else if (!passed && email) {
			await this.email.sendTransactional(email, "exam_fail", {
				score: String(score),
				passingScore: String(version.passingScorePct),
			})
		}

		if (!passed && enp) {
			await db
				.update(enpProfiles)
				.set({ retakeCount: enp.retakeCount + 1, updatedAt: now })
				.where(eq(enpProfiles.userId, userId))
		}

		await db.insert(auditEvents).values({
			actorUserId: userId,
			subOrgId: enp?.subOrgId ?? null,
			eventType: "exam_submitted",
			targetTable: "exam_attempts",
			targetId: attemptId,
			payload: { score, passed, correct, total },
		})

		return {
			attemptId,
			status: "submitted",
			score,
			passed,
			totalQuestions: total,
			correctAnswers: correct,
			breakdown,
		}
	}

	private async buildCertificatePdf(opts: {
		name: string
		certificateId: string
	}): Promise<Uint8Array> {
		const doc = await PDFDocument.create()
		const page = doc.addPage([612, 792])
		const font = await doc.embedFont(StandardFonts.Helvetica)
		page.drawText("qLegal — Electronic Notary Public Certificate", {
			x: 50,
			y: 720,
			size: 18,
			font,
		})
		page.drawText(opts.name, { x: 50, y: 680, size: 14, font })
		page.drawText(`Certificate ID: ${opts.certificateId}`, { x: 50, y: 650, size: 12, font })
		return doc.save()
	}

	/** G1: close attempts past `expires_at` (cron, ~every minute). */
	async sweepExpiredExamAttempts(): Promise<void> {
		const now = new Date()
		const expiredInProgress = await db
			.select()
			.from(examAttempts)
			.where(and(eq(examAttempts.status, "in_progress"), lt(examAttempts.expiresAt, now)))

		for (const attempt of expiredInProgress) {
			try {
				await this.sweepOneExpiredInProgress(attempt)
			} catch (err) {
				this.log.warn(`exam_in_progress_sweep_failed attemptId=${attempt.id} err=${String(err)}`)
			}
		}

		const staleAbandoned = await db
			.select()
			.from(examAttempts)
			.where(
				and(
					eq(examAttempts.status, "abandoned"),
					eq(examAttempts.resumeUsed, false),
					lt(examAttempts.expiresAt, now)
				)
			)

		for (const attempt of staleAbandoned) {
			try {
				await this.finalizeAbandonedAsFailed(attempt, new Date())
			} catch (err) {
				this.log.warn(`exam_abandoned_sweep_failed attemptId=${attempt.id} err=${String(err)}`)
			}
		}
	}

	private async answerCountForAttempt(attemptId: string): Promise<number> {
		const [row] = await db
			.select({ n: sql<number>`count(*)::int` })
			.from(examAttemptAnswers)
			.where(eq(examAttemptAnswers.attemptId, attemptId))
		return Number(row?.n ?? 0)
	}

	private async sweepOneExpiredInProgress(attempt: typeof examAttempts.$inferSelect) {
		const n = await this.answerCountForAttempt(attempt.id)
		const now = new Date()
		if (n === 0) {
			await db
				.update(examAttempts)
				.set({ status: "expired", updatedAt: now })
				.where(eq(examAttempts.id, attempt.id))

			const [enp] = await db
				.select()
				.from(enpProfiles)
				.where(eq(enpProfiles.userId, attempt.userId))
				.limit(1)
			await db.insert(auditEvents).values({
				id: randomUUID(),
				actorUserId: attempt.userId,
				subOrgId: enp?.subOrgId ?? null,
				eventType: "exam_attempt_expired_by_sweeper",
				targetTable: "exam_attempts",
				targetId: attempt.id,
				payload: { sectionsCompleted: attempt.sectionsCompleted },
			})
			return
		}

		const version = await this.loadVersion(attempt.examVersionId)
		await this.finalizeAttempt(attempt.userId, attempt.id, version)
	}

	private async finalizeAbandonedAsFailed(attempt: typeof examAttempts.$inferSelect, now: Date) {
		await db
			.update(examAttempts)
			.set({
				status: "submitted",
				score: 0,
				passed: false,
				completedAt: now,
				updatedAt: now,
			})
			.where(eq(examAttempts.id, attempt.id))

		const [enp] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, attempt.userId))
			.limit(1)
		if (enp) {
			await db
				.update(enpProfiles)
				.set({ retakeCount: enp.retakeCount + 1, updatedAt: now })
				.where(eq(enpProfiles.userId, attempt.userId))
		}

		await db.insert(auditEvents).values({
			id: randomUUID(),
			actorUserId: attempt.userId,
			subOrgId: enp?.subOrgId ?? null,
			eventType: "exam_abandoned_finalized_by_sweeper",
			targetTable: "exam_attempts",
			targetId: attempt.id,
			payload: {},
		})
	}

	async submitExamLegacy(userId: string, attemptId: string, answers: Record<string, string>) {
		const [attempt] = await db
			.select()
			.from(examAttempts)
			.where(eq(examAttempts.id, attemptId))
			.limit(1)
		if (!attempt || attempt.userId !== userId) {
			throw new ORPCError("NOT_FOUND", { message: "Attempt not found" })
		}
		if (attempt.status !== "in_progress") {
			throw new ORPCError("BAD_REQUEST", { message: "Attempt is not in progress" })
		}
		this.assertNotExpired(attempt)
		if (attempt.sectionsCompleted > 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Use submit-section for attempts started with the sectioned flow",
			})
		}

		const version = await this.loadVersion(attempt.examVersionId)
		const orderedIds = await this.orderedQuestionIds(version.id, attemptId)
		const idSet = new Set(orderedIds)
		if (Object.keys(answers).length !== idSet.size) {
			throw new ORPCError("BAD_REQUEST", { message: `Expected ${idSet.size} answers` })
		}
		for (const k of Object.keys(answers)) {
			if (!idSet.has(k)) throw new ORPCError("BAD_REQUEST", { message: `Unknown question ${k}` })
		}

		const now = new Date()
		await db.transaction(async tx => {
			for (const qid of idSet) {
				const key = answers[qid]
				if (key === undefined) {
					throw new ORPCError("BAD_REQUEST", { message: `Missing answer for question ${qid}` })
				}
				choiceKeyToIndex(key)
				const ck = key.trim().toLowerCase()
				await tx
					.insert(examAttemptAnswers)
					.values({
						attemptId,
						questionId: qid,
						choiceKey: ck,
						updatedAt: now,
					})
					.onConflictDoUpdate({
						target: [examAttemptAnswers.attemptId, examAttemptAnswers.questionId],
						set: { choiceKey: ck, updatedAt: now },
					})
			}
			await tx
				.update(examAttempts)
				.set({
					sectionsCompleted: version.sectionCount,
					updatedAt: now,
				})
				.where(eq(examAttempts.id, attemptId))
		})

		return this.finalizeAttempt(userId, attemptId, version)
	}

	/** Local/staging only — submits a perfect score in one shot for QA. */
	async devPerfectExam(userId: string, examVersionId: string): Promise<ExamResultDto> {
		const isDevRuntime = env.NODE_ENV !== "production"
		if (!isDevRuntime && env.CERT_EXAM_DEV_ASSIST !== "true") {
			throw new ORPCError("FORBIDDEN", {
				message:
					'Dev-perfect exam is disabled in production unless CERT_EXAM_DEV_ASSIST is explicitly set to "true".',
			})
		}

		const version = await this.loadVersion(examVersionId)
		const now = new Date()
		const [open] = await db
			.select()
			.from(examAttempts)
			.where(
				and(
					eq(examAttempts.userId, userId),
					eq(examAttempts.examVersionId, version.id),
					eq(examAttempts.status, "in_progress")
				)
			)
			.orderBy(desc(examAttempts.startedAt))
			.limit(1)

		let attemptId: string
		let sectionsCompleted = 0
		if (open && open.expiresAt > now) {
			attemptId = open.id
			sectionsCompleted = open.sectionsCompleted
		} else {
			const started = await this.startExam(userId, examVersionId)
			attemptId = started.attempt.id
			sectionsCompleted = started.attempt.sectionsCompleted
		}

		for (let section = sectionsCompleted + 1; section <= version.sectionCount; section++) {
			const sectionQuestionIds = await this.questionIdsForSection(version, attemptId, section)
			const revMap = await this.latestRevisionsForQuestions(sectionQuestionIds)
			const answers: Record<string, string> = {}
			for (const qid of sectionQuestionIds) {
				const rev = revMap.get(qid)
				if (!rev) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: `Missing exam revision for ${qid}`,
					})
				}
				answers[qid] = correctDisplayedChoiceKey(attemptId, qid, rev.correctChoiceIndex)
			}

			const submitted = await this.submitSection(userId, attemptId, section, answers)
			if (submitted.result) {
				return submitted.result
			}
		}

		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Dev-perfect exam did not return a final result.",
		})
	}
}
