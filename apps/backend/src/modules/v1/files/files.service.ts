import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common"
import { createHash, randomUUID } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import { stat, unlink, writeFile } from "node:fs/promises"
import * as os from "node:os"
import { basename, join } from "node:path"
import { finished, pipeline } from "node:stream/promises"
import { and, eq, inArray, isNull } from "drizzle-orm"
import type { Express, Response } from "express"

import {
	appointmentDocuments,
	appointments,
	commissionHearingRooms,
	enpCommissionApplicationDocuments,
	enpCommissionApplications,
	enpProfiles,
	fileObjects,
	users,
} from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { isSessionRoomGuestForAppointment } from "@/modules/v1/sessions/lib/is-session-room-guest"

import {
	assertFileSizeForBucket,
	assertMimeAllowedForBucket,
	assertPurposeForBucket,
	type QlegalFileBucket,
	type QlegalFilePurpose,
} from "./file-buckets"
import { FILE_STORAGE_ADAPTER, type FileStorageAdapter } from "./file-storage.adapter"

function safeOriginalName(name: string): string {
	const base = basename(name)
		.replace(/[^\w.\-]+/g, "_")
		.slice(0, 200)
	return base.length > 0 ? base : "upload.bin"
}

async function sha256File(filePath: string): Promise<string> {
	const hash = createHash("sha256")
	const rs = createReadStream(filePath)
	rs.on("data", (chunk: string | Buffer) => {
		hash.update(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
	})
	await finished(rs)
	return hash.digest("hex")
}

const BUCKETS = ["qlegal-kyc", "qlegal-documents", "qlegal-sessions"] as const
const BUCKET_SET = new Set<string>(BUCKETS)
const PURPOSES = [
	"kyc_id",
	"kyc_liveness",
	"kyc_national_id",
	"qs_original",
	"qs_signed",
	"ai_analysis",
	"session_recording",
	"generated_certificate",
	"registry_pdf",
	"appointment_attachment",
	"commission_application",
	"commission_opposition",
	"compliance_export",
] as const
const PURPOSE_SET = new Set<string>(PURPOSES)

function parseBucket(v: unknown): QlegalFileBucket {
	if (typeof v !== "string" || !BUCKET_SET.has(v)) {
		throw new BadRequestException("Invalid bucket")
	}
	return v as QlegalFileBucket
}

function parsePurpose(v: unknown): QlegalFilePurpose {
	if (typeof v !== "string" || !PURPOSE_SET.has(v)) {
		throw new BadRequestException("Invalid purpose")
	}
	return v as QlegalFilePurpose
}

@Injectable()
export class FilesService {
	constructor(
		@Inject(FILE_STORAGE_ADAPTER)
		private readonly storage: FileStorageAdapter
	) {}

	async uploadMultipart(args: {
		subOrgId: string
		userId: string
		file: Express.Multer.File
		rawBucket: unknown
		rawPurpose: unknown
		bodySubOrgId?: unknown
	}): Promise<{ fileObjectId: string }> {
		const bucket = parseBucket(args.rawBucket)
		const purpose = parsePurpose(args.rawPurpose)

		if (
			args.bodySubOrgId !== undefined &&
			args.bodySubOrgId !== null &&
			String(args.bodySubOrgId) !== args.subOrgId
		) {
			throw new BadRequestException("sub_org_id in form must match query sub_org_id")
		}

		assertPurposeForBucket(bucket, purpose)
		assertMimeAllowedForBucket(bucket, args.file.mimetype)
		assertFileSizeForBucket(bucket, args.file.size)

		const sha256 = await sha256File(args.file.path)
		const objectId = randomUUID()
		const s3Key = `${args.subOrgId}/${objectId}/${safeOriginalName(args.file.originalname)}`

		try {
			await this.storage.putObjectFromFile({
				bucket,
				key: s3Key,
				subOrgId: args.subOrgId,
				filePath: args.file.path,
				contentType: args.file.mimetype,
			})

			const [row] = await db
				.insert(fileObjects)
				.values({
					id: objectId,
					subOrgId: args.subOrgId,
					ownerUserId: args.userId,
					bucket,
					s3Key,
					mime: args.file.mimetype,
					sizeBytes: args.file.size,
					sha256,
					purpose,
					virusScanStatus: "pending",
				})
				.returning({ id: fileObjects.id })

			return { fileObjectId: row!.id }
		} finally {
			try {
				await unlink(args.file.path)
			} catch {
				// temp file may already be removed
			}
		}
	}

	/**
	 * Resolves the sub_org_id that a client document-review upload should land in
	 * by looking up the picked notary's certified ENP profile. This lets clients
	 * upload appointment attachments without having (or needing) a sub-org of
	 * their own; the file lives under the notary who will review it.
	 */
	async uploadAppointmentAttachmentForNotary(args: {
		notaryUserId: string
		userId: string
		file: Express.Multer.File
	}): Promise<{ fileObjectId: string }> {
		const [notary] = await db
			.select({
				subOrgId: enpProfiles.subOrgId,
				certificateStatus: enpProfiles.certificateStatus,
			})
			.from(enpProfiles)
			.innerJoin(users, eq(users.id, enpProfiles.userId))
			.where(and(eq(enpProfiles.userId, args.notaryUserId), isNull(users.deletedAt)))
			.limit(1)

		if (!notary) {
			throw new BadRequestException("Selected notary is not available")
		}
		if (notary.certificateStatus !== "certified") {
			throw new BadRequestException("Selected notary is not certified")
		}

		return this.uploadMultipart({
			subOrgId: notary.subOrgId,
			userId: args.userId,
			file: args.file,
			rawBucket: "qlegal-documents",
			rawPurpose: "appointment_attachment",
		})
	}

	async uploadCommissionOpposition(args: {
		hearingRoomId: string
		userId: string
		file: Express.Multer.File
	}): Promise<{ applicationId: string; fileObjectId: string }> {
		const [hearing] = await db
			.select({
				applicationId: commissionHearingRooms.applicationId,
				status: commissionHearingRooms.status,
				subOrgId: enpCommissionApplications.subOrgId,
			})
			.from(commissionHearingRooms)
			.innerJoin(
				enpCommissionApplications,
				eq(enpCommissionApplications.id, commissionHearingRooms.applicationId)
			)
			.where(eq(commissionHearingRooms.id, args.hearingRoomId))
			.limit(1)

		if (!hearing) {
			throw new NotFoundException("Hearing not found")
		}
		if (hearing.status === "ended" || hearing.status === "cancelled") {
			throw new BadRequestException("Opposition documents cannot be uploaded for this hearing")
		}

		const uploaded = await this.uploadMultipart({
			subOrgId: hearing.subOrgId,
			userId: args.userId,
			file: args.file,
			rawBucket: "qlegal-documents",
			rawPurpose: "commission_opposition",
		})

		return {
			applicationId: hearing.applicationId,
			fileObjectId: uploaded.fileObjectId,
		}
	}

	async getActiveRecordForTenant(fileId: string, subOrgIds: string[]) {
		const [row] = await db
			.select()
			.from(fileObjects)
			.where(
				and(
					eq(fileObjects.id, fileId),
					isNull(fileObjects.deletedAt),
					inArray(fileObjects.subOrgId, subOrgIds)
				)
			)
			.limit(1)

		return row ?? null
	}

	/** Sub-org member, file owner, or appointment ENP/client linked to this file. */
	async getActiveRecordForUser(fileId: string, ctx: QlegalSessionContext) {
		const [row] = await db
			.select()
			.from(fileObjects)
			.where(and(eq(fileObjects.id, fileId), isNull(fileObjects.deletedAt)))
			.limit(1)

		if (!row) {
			return null
		}
		if (ctx.subOrgIds.includes(row.subOrgId)) {
			return row
		}
		if (row.ownerUserId === ctx.userId) {
			return row
		}

		const [appointment] = await db
			.select({
				appointmentId: appointmentDocuments.appointmentId,
				clientUserId: appointments.clientUserId,
				enpUserId: appointments.enpUserId,
			})
			.from(appointmentDocuments)
			.innerJoin(appointments, eq(appointments.id, appointmentDocuments.appointmentId))
			.where(eq(appointmentDocuments.fileObjectId, fileId))
			.limit(1)

		if (appointment) {
			const isParty =
				appointment.clientUserId === ctx.userId || appointment.enpUserId === ctx.userId
			const isGuest = isParty
				? false
				: await isSessionRoomGuestForAppointment(appointment.appointmentId, ctx.userId)
			if (isParty || isGuest) {
				return row
			}
		}

		const [commissionDoc] = await db
			.select({ applicationId: enpCommissionApplicationDocuments.applicationId })
			.from(enpCommissionApplicationDocuments)
			.where(eq(enpCommissionApplicationDocuments.fileObjectId, fileId))
			.limit(1)

		if (commissionDoc) {
			const [application] = await db
				.select({
					applicantUserId: enpCommissionApplications.applicantUserId,
					subOrgId: enpCommissionApplications.subOrgId,
				})
				.from(enpCommissionApplications)
				.where(eq(enpCommissionApplications.id, commissionDoc.applicationId))
				.limit(1)

			if (application) {
				if (application.applicantUserId === ctx.userId) {
					return row
				}
				if (ctx.role === "admin" || ctx.role === "super_admin") {
					return row
				}
				if (ctx.role === "sub_org_admin" && ctx.subOrgIds.includes(application.subOrgId)) {
					return row
				}
			}
		}

		return null
	}

	async userCanAccessFile(fileId: string, ctx: QlegalSessionContext): Promise<boolean> {
		return (await this.getActiveRecordForUser(fileId, ctx)) !== null
	}

	async getSignedDownloadUrl(fileId: string, ctx: QlegalSessionContext, expiresSeconds: number) {
		const row = await this.getActiveRecordForUser(fileId, ctx)
		if (!row) {
			throw new NotFoundException()
		}
		const url = await this.storage.getSignedGetUrl({
			bucket: row.bucket,
			key: row.s3Key,
			expiresSeconds,
		})
		return { url, expiresInSeconds: expiresSeconds }
	}

	async getSignedDownloadUrlForTenant(fileId: string, subOrgIds: string[], expiresSeconds: number) {
		const row = await this.getActiveRecordForTenant(fileId, subOrgIds)
		if (!row) {
			throw new NotFoundException()
		}
		const url = await this.storage.getSignedGetUrl({
			bucket: row.bucket,
			key: row.s3Key,
			expiresSeconds,
		})
		return { url, expiresInSeconds: expiresSeconds }
	}

	async getSignedDownloadUrlById(fileId: string, expiresSeconds: number) {
		const [row] = await db
			.select()
			.from(fileObjects)
			.where(and(eq(fileObjects.id, fileId), isNull(fileObjects.deletedAt)))
			.limit(1)
		if (!row) {
			throw new NotFoundException()
		}
		const url = await this.storage.getSignedGetUrl({
			bucket: row.bucket,
			key: row.s3Key,
			expiresSeconds,
		})
		return { url, expiresInSeconds: expiresSeconds }
	}

	async openDownloadStream(fileId: string, ctx: QlegalSessionContext) {
		const row = await this.getActiveRecordForUser(fileId, ctx)
		if (!row) {
			throw new NotFoundException()
		}
		return this.storage.openReadStream(row.bucket, row.s3Key)
	}

	async openDownloadStreamForTenant(fileId: string, subOrgIds: string[]) {
		const row = await this.getActiveRecordForTenant(fileId, subOrgIds)
		if (!row) {
			throw new NotFoundException()
		}
		return this.storage.openReadStream(row.bucket, row.s3Key)
	}

	async openDownloadStreamById(fileId: string) {
		const [row] = await db
			.select()
			.from(fileObjects)
			.where(and(eq(fileObjects.id, fileId), isNull(fileObjects.deletedAt)))
			.limit(1)
		if (!row) {
			throw new NotFoundException()
		}
		return this.storage.openReadStream(row.bucket, row.s3Key)
	}

	/**
	 * Clone a review attachment into a new `qs_original` owned by the ENP (for IEN QuickSign queue).
	 */
	async copyReviewAttachmentToQsOriginal(args: {
		sourceFileId: string
		enpUserId: string
		subOrgId: string
		displayName?: string
	}): Promise<{ fileObjectId: string }> {
		const [source] = await db
			.select()
			.from(fileObjects)
			.where(
				and(
					eq(fileObjects.id, args.sourceFileId),
					eq(fileObjects.purpose, "appointment_attachment"),
					isNull(fileObjects.deletedAt)
				)
			)
			.limit(1)
		if (!source) {
			throw new BadRequestException("Source review document was not found")
		}

		const { stream, contentType } = await this.openDownloadStreamById(args.sourceFileId)
		const ext = source.mime?.includes("pdf") ? ".pdf" : ""
		const tmpPath = join(os.tmpdir(), `qs-copy-${randomUUID()}${ext}`)
		try {
			await pipeline(stream, createWriteStream(tmpPath))
			const fileStats = await stat(tmpPath)
			const originalName = safeOriginalName(
				args.displayName?.trim() || basename(source.s3Key) || `document${ext || ".pdf"}`
			)
			const file = {
				path: tmpPath,
				mimetype: contentType || source.mime || "application/pdf",
				size: fileStats.size,
				originalname: originalName,
			} as Express.Multer.File
			return await this.uploadMultipart({
				subOrgId: args.subOrgId,
				userId: args.enpUserId,
				file,
				rawBucket: "qlegal-documents",
				rawPurpose: "qs_original",
			})
		} finally {
			try {
				await unlink(tmpPath)
			} catch {
				/* temp cleanup */
			}
		}
	}

	/** Persist a sealed notarized PDF (from DocOnChain) under the ENP sub-org. */
	async uploadNotarizedPdfBuffer(args: {
		subOrgId: string
		ownerUserId: string
		buffer: Buffer
		originalName: string
	}): Promise<{ fileObjectId: string }> {
		const tmpPath = join(os.tmpdir(), `notarized-${randomUUID()}.pdf`)
		const file = {
			path: tmpPath,
			mimetype: "application/pdf",
			size: args.buffer.length,
			originalname: safeOriginalName(
				args.originalName.endsWith(".pdf") ? args.originalName : `${args.originalName}.pdf`
			),
		} as Express.Multer.File
		await writeFile(tmpPath, args.buffer)
		return this.uploadMultipart({
			subOrgId: args.subOrgId,
			userId: args.ownerUserId,
			file,
			rawBucket: "qlegal-documents",
			rawPurpose: "qs_signed",
		})
	}

	async readStoredFileBuffer(fileId: string): Promise<Buffer> {
		const { stream } = await this.openDownloadStreamById(fileId)
		const chunks: Buffer[] = []
		for await (const chunk of stream) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
		}
		return Buffer.concat(chunks)
	}

	async pipeStoredFileToResponse(
		fileId: string,
		res: Response,
		opts?: { download?: boolean; filename?: string }
	): Promise<void> {
		const { stream, contentType, contentLength } = await this.openDownloadStreamById(fileId)
		const filename = opts?.filename ?? "notarized-document.pdf"
		res.setHeader("Content-Type", contentType || "application/pdf")
		if (contentLength > 0) {
			res.setHeader("Content-Length", String(contentLength))
		}
		const disposition = opts?.download ? "attachment" : "inline"
		res.setHeader("Content-Disposition", `${disposition}; filename="${filename.replace(/"/g, "")}"`)
		await finished(stream.pipe(res))
	}

	/** Remove an unlinked duplicate upload (system-only; no user session). */
	async softDeleteById(fileId: string): Promise<void> {
		await db
			.update(fileObjects)
			.set({ deletedAt: new Date() })
			.where(and(eq(fileObjects.id, fileId), isNull(fileObjects.deletedAt)))
	}

	async softDelete(fileId: string, ctx: QlegalSessionContext): Promise<void> {
		const row = await this.getActiveRecordForUser(fileId, ctx)
		if (!row) {
			throw new NotFoundException()
		}
		const updated = await db
			.update(fileObjects)
			.set({ deletedAt: new Date() })
			.where(and(eq(fileObjects.id, fileId), isNull(fileObjects.deletedAt)))
			.returning({ id: fileObjects.id })

		if (updated.length === 0) {
			throw new NotFoundException()
		}
	}
}
