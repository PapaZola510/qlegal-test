import { createHash } from "node:crypto"

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

import { LocalStorageService } from "@/services/storage/local-storage.service"
import { db } from "@/common/database/database.client"
import { FilesService } from "@/modules/v1/files/files.service"
import { stampCertificationPage } from "@/utils/stamp-certification-page"
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
		private readonly localStorage: LocalStorageService
	) {}

	/** Background job: fetch from Registry and copy into our object storage (idempotent). */
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
			bytes = await this.localStorage.readPdf(row.id).catch(() => undefined)
		}
		if (!bytes?.length) return null

		bytes = await this.stampPdfForProject(bytes, row.doconchainProjectUuid.trim())
		const { pdf: stampedPdf } = await stampCertificationPage(bytes, row.enpUserId)
		bytes = stampedPdf

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
				appointmentId: quicksignProjects.appointmentId,
				description: quicksignProjects.description,
			})
			.from(quicksignProjects)
			.where(eq(quicksignProjects.id, quicksignProjectId))
			.limit(1)

		const projectUuid = row?.doconchainProjectUuid?.trim()
		if (!row || !projectUuid) {
			if (row?.notarizedFileObjectId?.trim()) {
				await this.files.pipeStoredFileToResponse(row.notarizedFileObjectId, res, {
					download: opts?.download === true,
					filename: "notarized-document.pdf",
				})
				return
			}
			throw new HttpException(
				{
					message: "Notarized PDF is not available yet.",
					error: { code: "BAD_REQUEST", message: "Notarized PDF is not available yet." },
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

			const finalHash = createHash("sha256").update(stamped).digest("hex")
			const oldDesc = row.description ?? ""
			if (oldDesc.includes("qlegal-hash:")) {
				const newDesc = oldDesc.replace(/(qlegal-hash:)[^\|]*/, `$1${finalHash}`)
				await db
					.update(quicksignProjects)
					.set({ description: newDesc, updatedAt: new Date() })
					.where(eq(quicksignProjects.id, row.id))
				if (row.appointmentId) {
					const [actRow] = await db
						.select({ id: registryActs.id, description: registryActs.description })
						.from(registryActs)
						.where(eq(registryActs.appointmentId, row.appointmentId))
						.limit(1)
					if (actRow?.description?.includes("qlegal-hash:")) {
						const newActDesc = actRow.description.replace(/(qlegal-hash:)[^\|]*/, `$1${finalHash}`)
						await db
							.update(registryActs)
							.set({ description: newActDesc, updatedAt: new Date() })
							.where(eq(registryActs.id, actRow.id))
					}
				}
			}

			const filename = (streamOpts.filename ?? "notarized-document.pdf").trim()
			res.setHeader("Content-Type", "application/pdf")
			res.setHeader(
				"Content-Disposition",
				streamOpts.asAttachment
					? `attachment; filename="${filename}"`
					: `inline; filename="${filename}"`
			)
			res.setHeader("Cache-Control", "private, max-age=3600")
			res.status(200).send(stamped)
			void this.archiveQuicksignProjectPdf(row.id, stamped)
			return
		}

		throw new HttpException(
			{
				message:
					"Notarized PDF is not available yet. Wait a moment and try again.",
				error: {
					code: "NOTARIZED_PDF_NOT_READY",
					message:
						"Notarized PDF is not available yet. Wait a moment and try again.",
				},
			},
			425
		)
	}

	private async resolveNotarizedPdfBytes(
		row: {
			id: string
			enpUserId: string
			notarizedFileObjectId: string | null
		},
		_projectUuid: string
	): Promise<Buffer | null> {
		if (row.notarizedFileObjectId) {
			const stored = await this.files.readStoredFileBuffer(row.notarizedFileObjectId)
			if (stored?.length && stored.subarray(0, 4).toString("ascii") === "%PDF") return stored
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
