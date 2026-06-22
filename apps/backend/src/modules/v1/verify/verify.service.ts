import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import type { Response } from "express"

import type { VerifyDocumentResult } from "@repo/contracts"
import { appointments, enpProfiles, quicksignProjects, registryActs, users } from "@repo/db/schema"

import { DoconchainAdapterService } from "@/services/doconchain/doconchain-adapter.service"
import { db } from "@/common/database/database.client"
import { doconchainDevMockOnFailure, doconchainOrgEmailFallback } from "@/config/env.config"

const MEETING_DC_DEDUPE_PREFIX = "qlegal-dc:"
const CERTIFICATE_ACCESS_TTL_MS = 15 * 60 * 1000

type CertificateAccessEntry = {
	token: string
	projectUuid: string | null
	verificationUuid: string | null
	certificateUrl: string | null
	expiresAt: number
}

function formatEnpName(row: {
	prefix: string | null
	firstName: string
	lastName: string
	suffix: string | null
}): string {
	const parts = [row.prefix, row.firstName, row.lastName, row.suffix].filter(Boolean)
	return parts.join(" ").trim() || "Electronic Notary Public"
}

function parseProjectUuidFromActDescription(description: string | null | undefined): string | null {
	if (!description?.trim()) return null
	for (const segment of description.split("|")) {
		const trimmed = segment.trim()
		if (trimmed.startsWith(MEETING_DC_DEDUPE_PREFIX)) {
			const uuid = trimmed.slice(MEETING_DC_DEDUPE_PREFIX.length).trim()
			return uuid || null
		}
	}
	return null
}

@Injectable()
export class VerifyService {
	private readonly log = new Logger(VerifyService.name)
	private readonly certificateAccess = new Map<string, CertificateAccessEntry>()

	constructor(private readonly dc: DoconchainAdapterService) {}

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

		const registryContext = await this.loadRegistryContext({
			actNumber,
			projectUuid: projectUuidInput,
			code,
		})
		const tokenEmail = registryContext.enpEmail ?? doconchainOrgEmailFallback() ?? null

		if (!tokenEmail) {
			return this.failureResult({
				now,
				nowIso,
				verificationStatus: "unavailable",
				reason:
					"Could not determine which notary performed this act. Provide an act number or contact support.",
				message: "Verification is temporarily unavailable.",
				registryContext,
			})
		}

		const devMock = doconchainDevMockOnFailure()
		let token: string
		try {
			token = await this.dc.getAccessToken(tokenEmail, {
				allowOrgFallback: true,
				allowMock: devMock || !this.dc.isConfigured(),
			})
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.warn(`Verify: DocOnChain token failed for ${tokenEmail}: ${msg.slice(0, 200)}`)
			return this.failureResult({
				now,
				nowIso,
				verificationStatus: "unavailable",
				reason: "Could not connect to DocOnChain verification.",
				message: msg.slice(0, 240),
				registryContext,
			})
		}

		const userUuid = await this.dc.resolveDoconchainVerifyUserUuid(token)
		if (!userUuid) {
			return this.failureResult({
				now,
				nowIso,
				verificationStatus: "unavailable",
				reason:
					"Could not resolve DocOnChain user uuid (GET /my/profile). Ensure the notary/org token is valid, or set DOCONCHAIN_VERIFY_USER_UUID.",
				message:
					"Document verification could not determine the DocOnChain account for this document.",
				registryContext,
			})
		}

		const dcResult = await this.dc.verifyDocumentAuthenticity({
			token,
			userUuid,
			code,
			pdf: input.pdf,
			filename: input.filename,
			allowMock: devMock || !this.dc.isConfigured() || token.startsWith("mock_dc_token_"),
		})

		const verifiedAt = dcResult.verifiedAt ?? nowIso

		if (dcResult.ok) {
			const doconchainVerificationUuid = dcResult.verificationUuid?.trim() || null
			let doconchainProjectUuid =
				dcResult.projectUuid?.trim() ||
				projectUuidInput ||
				registryContext.doconchainProjectUuid ||
				null

			let doconchainDetails: VerifyDocumentResult["doconchainDetails"] = null
			let certificateAccessKey: string | null = null
			let hasCertificateOfCompletion = false
			let certificateUrl: string | null = null

			if (!token.startsWith("mock_dc_token_") && doconchainVerificationUuid) {
				const show = await this.dc.fetchDoconchainVerificationDetails({
					token,
					verificationUuid: doconchainVerificationUuid,
				})
				doconchainProjectUuid = doconchainProjectUuid || show.projectUuid?.trim() || null
				doconchainDetails = {
					documentName: show.documentName,
					verificationDate: show.verificationDate,
					projectName: show.projectName,
					projectReferenceNumber: show.projectReferenceNumber,
					projectUuid: show.projectUuid,
					doconchainStatus: show.status,
					signers: show.signers,
				}

				if (doconchainProjectUuid) {
					const passport = await this.dc.fetchProjectPassportCertificateUrl({
						token,
						projectUuid: doconchainProjectUuid,
					})
					certificateUrl = passport.certificateUrl
				}

				if (certificateUrl) {
					certificateAccessKey = this.issueCertificateAccess({
						token,
						projectUuid: doconchainProjectUuid,
						verificationUuid: doconchainVerificationUuid,
						certificateUrl,
					})
					hasCertificateOfCompletion = true
				} else if (doconchainProjectUuid) {
					this.log.warn(
						`Verify: passport certificate_url missing for project ${doconchainProjectUuid.slice(0, 12)}`
					)
				}
			}

			return {
				isValid: true,
				verificationStatus: dcResult.status,
				documentId: registryContext.actId,
				documentCode: dcResult.documentCode,
				actNumber: registryContext.actNumber,
				title: registryContext.title ?? doconchainDetails?.projectName ?? null,
				enpName: registryContext.enpName,
				executedAt: registryContext.executedAt,
				verifiedAt,
				reason: null,
				message: dcResult.message,
				doconchainProjectUuid,
				doconchainVerificationUuid,
				certificateAccessKey,
				hasCertificateOfCompletion,
				doconchainDetails,
				createdAt: now,
				updatedAt: now,
			}
		}

		return {
			isValid: false,
			verificationStatus: dcResult.status,
			documentId: registryContext.actId,
			documentCode: dcResult.documentCode ?? code ?? null,
			actNumber: registryContext.actNumber,
			title: registryContext.title,
			enpName: registryContext.enpName,
			executedAt: registryContext.executedAt,
			verifiedAt,
			reason: dcResult.message,
			message: dcResult.message,
			doconchainProjectUuid:
				dcResult.projectUuid?.trim() || projectUuidInput || registryContext.doconchainProjectUuid,
			doconchainVerificationUuid: dcResult.verificationUuid?.trim() || null,
			certificateAccessKey: null,
			hasCertificateOfCompletion: false,
			doconchainDetails: null,
			createdAt: now,
			updatedAt: now,
		}
	}

	async streamCertificateOfCompletion(
		accessKey: string,
		res: Response,
		opts?: { download?: boolean }
	): Promise<void> {
		const key = accessKey.trim()
		if (!key) throw new NotFoundException("Certificate access key is required.")

		const entry = this.certificateAccess.get(key)
		if (!entry || Date.now() > entry.expiresAt) {
			this.certificateAccess.delete(key)
			throw new NotFoundException(
				"Certificate access expired. Verify the document again to view the Certificate of Completion."
			)
		}

		const ok = await this.dc.streamCertificateOfCompletionToResponse(res, {
			token: entry.token,
			projectUuid: entry.projectUuid,
			verificationUuid: entry.verificationUuid,
			certificateUrl: entry.certificateUrl,
			asAttachment: opts?.download === true,
		})
		if (!ok) {
			throw new NotFoundException(
				"Could not load the Certificate of Completion PDF from DocOnChain."
			)
		}
	}

	private issueCertificateAccess(args: {
		token: string
		projectUuid: string | null
		verificationUuid: string | null
		certificateUrl: string
	}): string {
		const key = randomUUID()
		this.certificateAccess.set(key, {
			token: args.token,
			projectUuid: args.projectUuid,
			verificationUuid: args.verificationUuid,
			certificateUrl: args.certificateUrl,
			expiresAt: Date.now() + CERTIFICATE_ACCESS_TTL_MS,
		})
		if (this.certificateAccess.size > 500) this.pruneCertificateAccess()
		return key
	}

	private pruneCertificateAccess(): void {
		const now = Date.now()
		for (const [key, entry] of this.certificateAccess) {
			if (entry.expiresAt <= now) this.certificateAccess.delete(key)
		}
	}

	private failureResult(args: {
		now: Date
		nowIso: string
		verificationStatus: string
		reason: string
		message: string
		registryContext: Awaited<ReturnType<VerifyService["loadRegistryContext"]>>
	}): VerifyDocumentResult {
		return {
			isValid: false,
			verificationStatus: args.verificationStatus,
			documentId: args.registryContext.actId,
			documentCode: null,
			actNumber: args.registryContext.actNumber,
			title: args.registryContext.title,
			enpName: args.registryContext.enpName,
			executedAt: args.registryContext.executedAt,
			verifiedAt: args.nowIso,
			reason: args.reason,
			message: args.message,
			doconchainProjectUuid: args.registryContext.doconchainProjectUuid,
			doconchainVerificationUuid: null,
			certificateAccessKey: null,
			hasCertificateOfCompletion: false,
			doconchainDetails: null,
			createdAt: args.now,
			updatedAt: args.now,
		}
	}

	private async loadRegistryContext(input: {
		actNumber?: string
		projectUuid?: string
		code?: string
	}): Promise<{
		actId: string | null
		actNumber: string | null
		title: string | null
		enpName: string | null
		executedAt: string | null
		enpEmail: string | null
		doconchainProjectUuid: string | null
	}> {
		const empty = {
			actId: null,
			actNumber: null,
			title: null,
			enpName: null,
			executedAt: null,
			enpEmail: null,
			doconchainProjectUuid: input.projectUuid?.trim() || null,
		}

		let actRow: typeof registryActs.$inferSelect | undefined

		if (input.actNumber) {
			const [row] = await db
				.select()
				.from(registryActs)
				.where(eq(registryActs.actNumber, input.actNumber))
				.limit(1)
			actRow = row
		} else if (input.projectUuid) {
			const needle = `${MEETING_DC_DEDUPE_PREFIX}${input.projectUuid}`
			const [row] = await db
				.select()
				.from(registryActs)
				.where(sql`${registryActs.description} LIKE ${`%${needle}%`}`)
				.limit(1)
			actRow = row
		}

		if (!actRow && input.projectUuid) {
			const [qs] = await db
				.select({ enpUserId: appointments.enpUserId })
				.from(quicksignProjects)
				.innerJoin(appointments, eq(quicksignProjects.appointmentId, appointments.id))
				.where(eq(quicksignProjects.doconchainProjectUuid, input.projectUuid))
				.limit(1)
			if (qs?.enpUserId) {
				const enpEmail = await this.loadEnpEmail(qs.enpUserId)
				return { ...empty, enpEmail, doconchainProjectUuid: input.projectUuid }
			}
		}

		if (!actRow) return empty

		const enpEmail = await this.loadEnpEmail(actRow.enpUserId)
		const enpName = await this.loadEnpDisplayName(actRow.enpUserId)
		const doconchainProjectUuid =
			parseProjectUuidFromActDescription(actRow.description) ?? empty.doconchainProjectUuid

		return {
			actId: actRow.id,
			actNumber: actRow.actNumber,
			title: actRow.title,
			enpName,
			executedAt: actRow.executedAt.toISOString(),
			enpEmail,
			doconchainProjectUuid,
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
