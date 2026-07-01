import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { createHash } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import type { Response } from "express"

import type { VerifyDocumentResult } from "@repo/contracts"
import { enpProfiles, quicksignProjects, registryActs, users } from "@repo/db/schema"

import { db } from "@/common/database/database.client"

function formatEnpName(row: {
	prefix: string | null
	firstName: string
	lastName: string
	suffix: string | null
}): string {
	const parts = [row.prefix, row.firstName, row.lastName, row.suffix].filter(Boolean)
	return parts.join(" ").trim() || "Electronic Notary Public"
}

@Injectable()
export class VerifyService {
	private readonly log = new Logger(VerifyService.name)

	constructor() {}

	async verifyDocument(input: {
		code?: string
		qrCode?: string
		actNumber?: string
		projectUuid?: string
		pdf?: Buffer
		filename?: string
	}): Promise<VerifyDocumentResult> {
		const now = new Date()
		const nowIso = now.toISOString()
		const code = (input.code ?? input.qrCode)?.trim() || undefined
		const actNumber = input.actNumber?.trim() || undefined
		const projectUuidInput = input.projectUuid?.trim() || undefined
		const hasPdf = Boolean(input.pdf && input.pdf.length > 0)

		if (!code && !hasPdf) {
			throw new BadRequestException("Provide a document code or upload a PDF file.")
		}

		if (hasPdf && input.pdf) {
			const mimeHint = (input.filename ?? "").toLowerCase()
			if (!mimeHint.endsWith(".pdf") && input.pdf.subarray(0, 5).toString("utf8") !== "%PDF-") {
				throw new BadRequestException("Only PDF documents can be verified.")
			}
		}

		// --- Local verification (local) ---
		if (code) {
			const { actRow: localActRow } = await this.localLookupByCode(code)
			if (localActRow) {
				return this.buildLocalVerifiedResult(localActRow, now, nowIso)
			}
		} else if (hasPdf && input.pdf) {
			const pdfHash = createHash("sha256").update(input.pdf).digest("hex")
			const { actRow: localActRow } = await this.localLookupByHash(pdfHash)
			if (localActRow) {
				return this.buildLocalVerifiedResult(localActRow, now, nowIso)
			}
		}
		// --- End local verification ---

		return {
			isValid: false,
			verificationStatus: "failed",
			documentId: null,
			documentCode: code ?? null,
			actNumber: null,
			title: null,
			enpName: null,
			executedAt: null,
			verifiedAt: nowIso,
			reason: code
				? "The document code is invalid."
				: "The uploaded document does not match our records.",
			message: "Verification failed.",
			doconchainProjectUuid: null,
			doconchainVerificationUuid: null,
			certificateAccessKey: null,
			hasCertificateOfCompletion: false,
			verificationDetails: null,
			createdAt: now,
			updatedAt: now,
		}
	}

	async streamCertificateOfCompletion(
		_accessKey: string,
		_res: Response,
		_opts?: { download?: boolean }
	): Promise<void> {
		throw new NotFoundException(
			"Certificate of Completion is not available. Verify the document using the document code or PDF hash."
		)
	}

	private async localLookupByCode(
		code: string
	): Promise<{ actRow: typeof registryActs.$inferSelect | undefined }> {
		const needle = `qlegal-code:${code}`
		const [actByCode] = await db
			.select()
			.from(registryActs)
			.where(sql`${registryActs.description} LIKE ${`%${needle}%`}`)
			.limit(1)
		if (actByCode) return { actRow: actByCode }

		const [qs] = await db
			.select({ appointmentId: quicksignProjects.appointmentId })
			.from(quicksignProjects)
			.where(sql`${quicksignProjects.description} LIKE ${`%${needle}%`}`)
			.limit(1)
		if (qs?.appointmentId) {
			const [row] = await db
				.select()
				.from(registryActs)
				.where(eq(registryActs.appointmentId, qs.appointmentId))
				.limit(1)
			if (row) return { actRow: row }
		}
		return { actRow: undefined }
	}

	private async localLookupByHash(
		hash: string
	): Promise<{ actRow: typeof registryActs.$inferSelect | undefined }> {
		const needle = `qlegal-hash:${hash}`
		const [actByHash] = await db
			.select()
			.from(registryActs)
			.where(sql`${registryActs.description} LIKE ${`%${needle}%`}`)
			.limit(1)
		if (actByHash) return { actRow: actByHash }

		const [qs] = await db
			.select({ appointmentId: quicksignProjects.appointmentId })
			.from(quicksignProjects)
			.where(sql`${quicksignProjects.description} LIKE ${`%${needle}%`}`)
			.limit(1)
		if (qs?.appointmentId) {
			const [row] = await db
				.select()
				.from(registryActs)
				.where(eq(registryActs.appointmentId, qs.appointmentId))
				.limit(1)
			if (row) return { actRow: row }
		}
		return { actRow: undefined }
	}

	private async buildLocalVerifiedResult(
		actRow: typeof registryActs.$inferSelect,
		now: Date,
		nowIso: string,
	): Promise<VerifyDocumentResult> {
		const enpEmail = await this.loadEnpEmail(actRow.enpUserId)
		const enpName = await this.loadEnpDisplayName(actRow.enpUserId)
		return {
			isValid: true,
			verificationStatus: "verified",
			documentId: actRow.id,
			documentCode: null,
			actNumber: actRow.actNumber,
			title: actRow.title,
			enpName,
			executedAt: actRow.executedAt.toISOString(),
			verifiedAt: nowIso,
			reason: null,
			message: "Document verified.",
			doconchainProjectUuid: null,
			doconchainVerificationUuid: null,
			certificateAccessKey: null,
			hasCertificateOfCompletion: false,
			verificationDetails: null,
			createdAt: now,
			updatedAt: now,
		}
	}

	private async loadEnpEmail(userId: string): Promise<string | null> {
		const [row] = await db
			.select({ email: users.email })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)
		return row?.email?.trim() || null
	}

	private async loadEnpDisplayName(userId: string): Promise<string | null> {
		const [profile] = await db
			.select({
				prefix: enpProfiles.prefix,
				firstName: enpProfiles.firstName,
				lastName: enpProfiles.lastName,
				suffix: enpProfiles.suffix,
			})
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, userId))
			.limit(1)
		if (profile) return formatEnpName(profile)

		const [user] = await db
			.select({ name: users.name })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)
		return user?.name?.trim() || null
	}
}
