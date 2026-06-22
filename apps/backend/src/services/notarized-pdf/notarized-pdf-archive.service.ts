import { HttpException, Injectable, Logger } from "@nestjs/common"
import { and, eq, isNull, like } from "drizzle-orm"
import type { Response } from "express"

import {
	formatEnbEntryNumber,
	resolveNotarialBookFooterFields,
	type NotarialBookFooterFields,
} from "@repo/contracts"
import {
	enpProfiles,
	meetingSignatureRequests,
	quicksignProjects,
	registryActs,
	users,
} from "@repo/db/schema"

import { DoconchainAdapterService } from "@/services/doconchain/doconchain-adapter.service"
import { db } from "@/common/database/database.client"
import { doconchainOrgEmailFallback } from "@/config/env.config"
import { FilesService } from "@/modules/v1/files/files.service"
import {
	looksLikePdfMissingDoconchainNotarialSeal,
	looksLikePdfStrictlyMissingDoconchainNotarialSeal,
} from "@/utils/doconchain-sealed-pdf-heuristic"
import { stampNotarialBookFooterOnPdf } from "@/utils/stamp-enb-entry-on-notarized-pdf"

const ARCHIVE_RETRY_DELAYS_MS = [0, 3_000, 8_000, 20_000, 45_000, 90_000]

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function safePdfName(title: string): string {
	const base = title
		.trim()
		.replace(/[^\w.\- ]+/g, "_")
		.slice(0, 120)
	return base.length > 0 ? `${base}.pdf` : "notarized-document.pdf"
}

@Injectable()
export class NotarizedPdfArchiveService {
	private readonly log = new Logger(NotarizedPdfArchiveService.name)
	private readonly activeJobs = new Set<string>()

	constructor(
		private readonly files: FilesService,
		private readonly dc: DoconchainAdapterService
	) {}

	/** Background job: fetch from DocOnChain vault and copy into our object storage (idempotent). */
	scheduleArchiveToS3(projectId: string): void {
		void this.maybeScheduleArchive(projectId)
	}

	private async maybeScheduleArchive(projectId: string): Promise<void> {
		const [existing] = await db
			.select({ notarizedFileObjectId: quicksignProjects.notarizedFileObjectId })
			.from(quicksignProjects)
			.where(eq(quicksignProjects.id, projectId))
			.limit(1)
		if (existing?.notarizedFileObjectId) return
		if (this.activeJobs.has(projectId)) return
		void this.runArchiveJob(projectId).catch(e => {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.warn(`Notarized PDF S3 archive failed project=${projectId}: ${msg.slice(0, 280)}`)
		})
	}

	private async runArchiveJob(projectId: string): Promise<void> {
		if (this.activeJobs.has(projectId)) return
		this.activeJobs.add(projectId)
		try {
			for (const delay of ARCHIVE_RETRY_DELAYS_MS) {
				if (delay > 0) await sleep(delay)
				const fileId = await this.archiveQuicksignProjectPdf(projectId)
				if (fileId) {
					this.log.log(`Notarized PDF archived to S3 project=${projectId} file=${fileId}`)
					return
				}
			}
			this.log.warn(`Notarized PDF S3 archive gave up after retries (project ${projectId})`)
		} finally {
			this.activeJobs.delete(projectId)
		}
	}

	/**
	 * Copy sealed PDF bytes into `file_objects` / S3 and link on `quicksign_projects.notarized_file_object_id`.
	 * Returns the file object id when stored (existing or new).
	 */
	async archiveQuicksignProjectPdf(projectId: string, pdf?: Buffer): Promise<string | null> {
		const [row] = await db
			.select({
				id: quicksignProjects.id,
				enpUserId: quicksignProjects.enpUserId,
				title: quicksignProjects.title,
				doconchainProjectUuid: quicksignProjects.doconchainProjectUuid,
				notarizedFileObjectId: quicksignProjects.notarizedFileObjectId,
			})
			.from(quicksignProjects)
			.where(eq(quicksignProjects.id, projectId))
			.limit(1)

		if (!row?.doconchainProjectUuid?.trim()) return null
		if (row.notarizedFileObjectId) return row.notarizedFileObjectId

		const [enp] = await db
			.select({
				subOrgId: enpProfiles.subOrgId,
				email: users.email,
			})
			.from(enpProfiles)
			.innerJoin(users, eq(users.id, enpProfiles.userId))
			.where(eq(enpProfiles.userId, row.enpUserId))
			.limit(1)

		if (!enp?.subOrgId || !enp.email) return null

		let bytes = pdf
		if (!bytes?.length) {
			const token = await this.dc.getAccessToken(enp.email, { allowOrgFallback: false })
			bytes =
				(await this.dc.fetchNotarizedPdfBytes({
					token,
					projectUuid: row.doconchainProjectUuid.trim(),
					tryVault: true,
				})) ?? undefined
		}
		if (!bytes?.length) return null
		if (looksLikePdfStrictlyMissingDoconchainNotarialSeal(bytes)) {
			this.log.debug(
				`Notarized PDF archive skipped — DocOnChain seal not ready project=${projectId}`
			)
			return null
		}

		bytes = await this.stampPdfForProject(bytes, row.doconchainProjectUuid.trim())

		const { fileObjectId } = await this.files.uploadNotarizedPdfBuffer({
			subOrgId: enp.subOrgId,
			ownerUserId: row.enpUserId,
			buffer: bytes,
			originalName: safePdfName(row.title),
		})

		const now = new Date()
		const [linked] = await db
			.update(quicksignProjects)
			.set({ notarizedFileObjectId: fileObjectId, updatedAt: now })
			.where(
				and(eq(quicksignProjects.id, projectId), isNull(quicksignProjects.notarizedFileObjectId))
			)
			.returning({ notarizedFileObjectId: quicksignProjects.notarizedFileObjectId })

		if (linked?.notarizedFileObjectId) {
			return linked.notarizedFileObjectId
		}

		// Another request archived first — reuse that file; do not keep a duplicate upload.
		const [winner] = await db
			.select({ notarizedFileObjectId: quicksignProjects.notarizedFileObjectId })
			.from(quicksignProjects)
			.where(eq(quicksignProjects.id, projectId))
			.limit(1)
		if (winner?.notarizedFileObjectId) {
			await this.files.softDeleteById(fileObjectId).catch(() => undefined)
			return winner.notarizedFileObjectId
		}

		return fileObjectId
	}

	/**
	 * Shared View/Download path for meeting session and registry — same resolution order.
	 */
	async streamQuicksignNotarizedPdf(
		quicksignProjectId: string,
		res: Response,
		opts?: { download?: boolean }
	): Promise<void> {
		const [row] = await db
			.select({
				id: quicksignProjects.id,
				enpUserId: quicksignProjects.enpUserId,
				doconchainProjectUuid: quicksignProjects.doconchainProjectUuid,
				notarizedFileObjectId: quicksignProjects.notarizedFileObjectId,
			})
			.from(quicksignProjects)
			.where(eq(quicksignProjects.id, quicksignProjectId))
			.limit(1)

		const projectUuid = row?.doconchainProjectUuid?.trim()
		if (!row || !projectUuid) {
			throw new HttpException(
				{
					message: "DocOnChain project is required for this notarized document.",
					error: { code: "BAD_REQUEST", message: "DocOnChain project is required." },
				},
				400
			)
		}

		const streamOpts = {
			asAttachment: opts?.download === true,
			filename: "notarized-document.pdf",
		}

		const pdfBytes = await this.resolveNotarizedPdfBytes(row, projectUuid)
		if (pdfBytes?.length) {
			const stamped = await this.stampPdfForProject(pdfBytes, projectUuid)
			this.dc.streamPdfBufferToExpressResponse(res, stamped, streamOpts)
			void this.archiveQuicksignProjectPdf(row.id, stamped)
			return
		}

		throw new HttpException(
			{
				message:
					"DocOnChain has not published the sealed notarized PDF yet. Wait a moment and try View again.",
				error: {
					code: "NOTARIZED_PDF_NOT_READY",
					message:
						"DocOnChain has not published the sealed notarized PDF yet. Wait a moment and try View again.",
				},
			},
			425
		)
	}

	private isValidPdfBuffer(bytes: Buffer | null | undefined): bytes is Buffer {
		return Boolean(bytes?.length && bytes.subarray(0, 4).toString("ascii") === "%PDF")
	}

	/** DocOnChain sign-only interim PDFs have blank SC template lines but no electronic notarial block. */
	private isSealedNotarizedPdfBytes(bytes: Buffer): boolean {
		return !looksLikePdfMissingDoconchainNotarialSeal(bytes)
	}

	private async listDoconchainTokenCandidates(enpEmail: string): Promise<string[]> {
		const emails = [enpEmail.trim()].filter(Boolean)
		const org = doconchainOrgEmailFallback()?.trim()
		if (org && !emails.some(e => e.toLowerCase() === org.toLowerCase())) {
			emails.push(org)
		}
		const tokens: string[] = []
		for (const email of emails) {
			try {
				tokens.push(await this.dc.getAccessToken(email, { allowOrgFallback: false }))
			} catch {
				/* try next email */
			}
		}
		return tokens
	}

	private async resolveNotarizedPdfBytes(
		row: {
			id: string
			enpUserId: string
			notarizedFileObjectId: string | null
		},
		projectUuid: string
	): Promise<Buffer | null> {
		if (row.notarizedFileObjectId) {
			const stored = await this.files.readStoredFileBuffer(row.notarizedFileObjectId)
			if (this.isValidPdfBuffer(stored) && this.isSealedNotarizedPdfBytes(stored)) return stored
			if (this.isValidPdfBuffer(stored) && !this.isSealedNotarizedPdfBytes(stored)) {
				this.log.debug(
					`Stored notarized PDF is interim (no DocOnChain seal) — refetching project=${projectUuid.slice(0, 8)}…`
				)
			}
		}

		this.scheduleArchiveToS3(row.id)

		const [enp] = await db
			.select({ email: users.email })
			.from(enpProfiles)
			.innerJoin(users, eq(users.id, enpProfiles.userId))
			.where(eq(enpProfiles.userId, row.enpUserId))
			.limit(1)
		if (!enp?.email?.trim()) return null

		const tokens = await this.listDoconchainTokenCandidates(enp.email)
		if (!tokens.length) {
			this.log.warn("Notarized PDF resolve: no DocOnChain token (ENP or org email)")
			return null
		}

		for (const token of tokens) {
			const fromDc = await this.dc.fetchNotarizedPdfBytes({
				token,
				projectUuid,
				tryVault: true,
				forceVaultScan: true,
			})
			if (this.isValidPdfBuffer(fromDc) && this.isSealedNotarizedPdfBytes(fromDc)) return fromDc
		}

		return null
	}

	/** Stamp Doc./Page/Book/Series on a sealed PDF using the linked ENB registry row. */
	async stampPdfForProject(pdf: Buffer, projectUuid: string): Promise<Buffer> {
		const footer = await this.loadNotarialBookFooterForProject(projectUuid)
		if (!footer) {
			this.log.debug(
				`Notarial book footer skipped — no ENB book/page for project=${projectUuid.slice(0, 8)}…`
			)
			return pdf
		}
		try {
			return await stampNotarialBookFooterOnPdf(pdf, footer)
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.warn(
				`Notarial book PDF footer stamp skipped project=${projectUuid.slice(0, 8)}…: ${msg.slice(0, 160)}`
			)
			return pdf
		}
	}

	private async loadNotarialBookFooterForProject(
		projectUuid: string
	): Promise<NotarialBookFooterFields | null> {
		const act = await this.loadRegistryActForProjectFooter(projectUuid)
		if (!act?.bookNo?.trim() || !act.pageNo?.trim()) return null

		const entryNumber =
			act.entryNumber?.trim() ||
			formatEnbEntryNumber({
				actNumber: act.actNumber,
				pageNo: act.pageNo,
				executedAt: act.executedAt,
			})

		return resolveNotarialBookFooterFields({
			bookNo: act.bookNo,
			pageNo: act.pageNo,
			executedAt: act.executedAt,
			entryNumber,
		})
	}

	private async loadRegistryActForProjectFooter(projectUuid: string) {
		const actSelect = {
			entryNumber: registryActs.entryNumber,
			actNumber: registryActs.actNumber,
			bookNo: registryActs.bookNo,
			pageNo: registryActs.pageNo,
			executedAt: registryActs.executedAt,
		}

		const dcMarker = `qlegal-dc:${projectUuid}`
		const [byUuid] = await db
			.select(actSelect)
			.from(registryActs)
			.where(like(registryActs.description, `%${dcMarker}%`))
			.limit(1)
		if (byUuid) return byUuid

		const [qs] = await db
			.select({ documentFileObjectId: quicksignProjects.documentFileObjectId })
			.from(quicksignProjects)
			.where(eq(quicksignProjects.doconchainProjectUuid, projectUuid))
			.limit(1)
		const fileId = qs?.documentFileObjectId?.trim()
		if (!fileId) return null

		const [meeting] = await db
			.select({ appointmentId: meetingSignatureRequests.appointmentId })
			.from(meetingSignatureRequests)
			.where(eq(meetingSignatureRequests.documentFileObjectId, fileId))
			.limit(1)
		if (!meeting?.appointmentId) return null

		const [byMeetingFile] = await db
			.select(actSelect)
			.from(registryActs)
			.where(
				and(
					eq(registryActs.appointmentId, meeting.appointmentId),
					like(registryActs.description, `%qlegal-file:${fileId}%`)
				)
			)
			.limit(1)
		return byMeetingFile ?? null
	}
}
