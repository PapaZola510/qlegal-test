import { Injectable, NotFoundException } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { and, asc, count, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm"
import type { Response } from "express"

import {
	appointmentDocuments,
	enpProfiles,
	fileObjects,
	registryActs,
	users,
} from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import type { V1Inputs, V1Outputs } from "@/config/contract-types"
import { deriveEnpCommissionRecordStatus } from "@/modules/v1/auth-profile/lib/derive-enp-commission-record-status"
import { normalizeScCommissionStatus } from "@/modules/v1/auth-profile/lib/enp-commission-validation"
import { FilesService } from "@/modules/v1/files/files.service"

type ComplianceFilter = V1Inputs["complianceAudit"]["listCommissionRecords"]
type CommissionRecord = V1Outputs["complianceAudit"]["listCommissionRecords"][number]
type EnbSummary = V1Outputs["complianceAudit"]["listEnbs"][number]
type EnbInspectFilter = V1Inputs["complianceAudit"]["inspectEnb"]
type EnbInspectResult = V1Outputs["complianceAudit"]["inspectEnb"]
type RequestEnbCopyInput = V1Inputs["complianceAudit"]["requestEnbCopy"]
type RequestEnbCopyResult = V1Outputs["complianceAudit"]["requestEnbCopy"]
type NotarizedDocument = V1Outputs["complianceAudit"]["listNotarizedDocuments"][number]
type AvRecording = V1Outputs["complianceAudit"]["listAvRecordings"][number]

function iso(value: Date | string | null | undefined): string | null {
	if (!value) return null
	if (value instanceof Date) return value.toISOString()
	return new Date(value).toISOString()
}

function dateRangeConditions(
	filter: Pick<ComplianceFilter, "dateRange">,
	column: typeof registryActs.executedAt
) {
	const conditions = []
	if (filter.dateRange?.from) conditions.push(gte(column, new Date(filter.dateRange.from)))
	if (filter.dateRange?.to) conditions.push(lte(column, new Date(filter.dateRange.to)))
	return conditions
}

function fullName(row: Pick<typeof enpProfiles.$inferSelect, "firstName" | "lastName" | "prefix">) {
	return [row.prefix, row.firstName, row.lastName].filter(Boolean).join(" ")
}

function pagination(filter: ComplianceFilter): { limit: number; offset: number } {
	return {
		limit: Number(filter.limit ?? 50),
		offset: Number(filter.offset ?? 0),
	}
}

const MEETING_FILE_PREFIX = "qlegal-file:"

function meetingFileIdFromDescription(description: string | null | undefined): string | null {
	if (!description?.trim()) return null
	for (const segment of description.split("|")) {
		const trimmed = segment.trim()
		if (trimmed.startsWith(MEETING_FILE_PREFIX)) {
			return trimmed.slice(MEETING_FILE_PREFIX.length).trim() || null
		}
	}
	return null
}

function mapNotarizedDocumentRow(row: {
	id: string
	enpUserId: string
	enpName: string
	actNumber: string
	actType: NotarizedDocument["actType"]
	title: string
	bookNo: string | null
	pageNo: string | null
	executedAt: Date
	scStatus: NotarizedDocument["scStatus"]
	documentUrl: string | null
	description: string | null
}): NotarizedDocument {
	const documentFileObjectId = meetingFileIdFromDescription(row.description)
	return {
		id: row.id,
		enpUserId: row.enpUserId,
		enpName: row.enpName,
		actNumber: row.actNumber,
		actType: row.actType,
		title: row.title,
		bookNo: row.bookNo,
		pageNo: row.pageNo,
		executedAt: row.executedAt.toISOString(),
		scStatus: row.scStatus,
		hasDocument: Boolean(row.documentUrl?.trim()) || Boolean(documentFileObjectId),
		documentFileObjectId,
	}
}

/** Read-only compliance datasets for GF-16/GF-26 data sharing. */
@Injectable()
export class ComplianceAuditService {
	constructor(private readonly files: FilesService) {}

	async listCommissionRecords(filter: ComplianceFilter): Promise<CommissionRecord[]> {
		const conditions = []
		if (filter.enpUserId) conditions.push(eq(enpProfiles.userId, filter.enpUserId))
		const { limit, offset } = pagination(filter)

		const rows = await db
			.select({
				enpUserId: enpProfiles.userId,
				enpName: sql<string>`concat_ws(' ', ${enpProfiles.prefix}, ${enpProfiles.firstName}, ${enpProfiles.lastName})`,
				email: users.email,
				npnCommissionNo: enpProfiles.npnCommissionNo,
				commissionValidUntil: enpProfiles.commissionValidUntil,
				ptrNo: enpProfiles.ptrNo,
				ibpNo: enpProfiles.ibpNo,
				notaryAddress: enpProfiles.notaryAddress,
				certificateStatus: enpProfiles.certificateStatus,
				scCommissionStatus: enpProfiles.scCommissionStatus,
			})
			.from(enpProfiles)
			.innerJoin(users, eq(users.id, enpProfiles.userId))
			.where(conditions.length ? and(...conditions) : undefined)
			.limit(limit)
			.offset(offset)

		return rows.map(row => ({
			enpUserId: row.enpUserId,
			enpName: row.enpName,
			email: row.email,
			npnCommissionNo: row.npnCommissionNo,
			commissionValidUntil: iso(row.commissionValidUntil),
			ptrNo: row.ptrNo,
			ibpNo: row.ibpNo,
			notaryAddress: row.notaryAddress,
			scCommissionStatus: row.scCommissionStatus
				? (normalizeScCommissionStatus(
						row.scCommissionStatus
					) as CommissionRecord["scCommissionStatus"])
				: null,
			commissionStatus: deriveEnpCommissionRecordStatus(row),
		}))
	}

	async inspectEnb(filter: EnbInspectFilter): Promise<EnbInspectResult> {
		const summary = await this.resolveEnbBook(filter.enpUserId, filter.bookNo)
		if (!summary) {
			throw new NotFoundException(
				`Electronic Notarial Book not found for ENP ${filter.enpUserId} book ${filter.bookNo}`
			)
		}

		const conditions = [
			eq(registryActs.enpUserId, filter.enpUserId),
			eq(registryActs.bookNo, filter.bookNo),
			...dateRangeConditions(filter, registryActs.executedAt),
		]
		const { limit, offset } = pagination(filter)

		const rows = await db
			.select({
				id: registryActs.id,
				actNumber: registryActs.actNumber,
				actType: registryActs.actType,
				title: registryActs.title,
				parties: registryActs.parties,
				executedAt: registryActs.executedAt,
				bookNo: registryActs.bookNo,
				pageNo: registryActs.pageNo,
				feePhp: registryActs.feePhp,
				scStatus: registryActs.scStatus,
				documentUrl: registryActs.documentUrl,
			})
			.from(registryActs)
			.where(and(...conditions))
			.orderBy(asc(registryActs.executedAt), asc(registryActs.actNumber))
			.limit(limit)
			.offset(offset)

		return {
			...summary,
			entries: rows.map(row => ({
				id: row.id,
				actNumber: row.actNumber,
				actType: row.actType,
				title: row.title,
				parties: row.parties,
				executedAt: row.executedAt.toISOString(),
				bookNo: row.bookNo,
				pageNo: row.pageNo,
				feePhp: row.feePhp,
				scStatus: row.scStatus,
				hasDocument: Boolean(row.documentUrl),
			})),
		}
	}

	async requestEnbCopy(input: RequestEnbCopyInput): Promise<RequestEnbCopyResult> {
		const inspect = await this.inspectEnb(input)
		return {
			...inspect,
			requestId: randomUUID(),
			requestedAt: new Date().toISOString(),
			virtualCopy: true,
		}
	}

	private async resolveEnbBook(enpUserId: string, bookNo: string) {
		const conditions = [
			eq(registryActs.enpUserId, enpUserId),
			eq(registryActs.bookNo, bookNo),
			isNotNull(registryActs.bookNo),
		]
		const [row] = await db
			.select({
				enpUserId: registryActs.enpUserId,
				enpName: sql<string>`concat_ws(' ', ${enpProfiles.prefix}, ${enpProfiles.firstName}, ${enpProfiles.lastName})`,
				bookNo: registryActs.bookNo,
				actCount: count(registryActs.id),
				firstActAt: sql<Date | null>`min(${registryActs.executedAt})`,
				lastActAt: sql<Date | null>`max(${registryActs.executedAt})`,
			})
			.from(registryActs)
			.innerJoin(enpProfiles, eq(enpProfiles.userId, registryActs.enpUserId))
			.where(and(...conditions))
			.groupBy(
				registryActs.enpUserId,
				enpProfiles.prefix,
				enpProfiles.firstName,
				enpProfiles.lastName,
				registryActs.bookNo
			)
			.limit(1)

		if (!row?.bookNo) return null
		return {
			enpUserId: row.enpUserId,
			enpName: row.enpName,
			bookNo: row.bookNo,
			actCount: Number(row.actCount),
			firstActAt: iso(row.firstActAt),
			lastActAt: iso(row.lastActAt),
		}
	}

	async listEnbs(filter: ComplianceFilter): Promise<EnbSummary[]> {
		const conditions = [isNotNull(registryActs.bookNo)]
		if (filter.enpUserId) conditions.push(eq(registryActs.enpUserId, filter.enpUserId))
		if (filter.bookNo) conditions.push(eq(registryActs.bookNo, filter.bookNo))
		const { limit, offset } = pagination(filter)

		const rows = await db
			.select({
				enpUserId: registryActs.enpUserId,
				enpName: sql<string>`concat_ws(' ', ${enpProfiles.prefix}, ${enpProfiles.firstName}, ${enpProfiles.lastName})`,
				bookNo: registryActs.bookNo,
				actCount: count(registryActs.id),
				firstActAt: sql<Date | null>`min(${registryActs.executedAt})`,
				lastActAt: sql<Date | null>`max(${registryActs.executedAt})`,
			})
			.from(registryActs)
			.innerJoin(enpProfiles, eq(enpProfiles.userId, registryActs.enpUserId))
			.where(and(...conditions))
			.groupBy(
				registryActs.enpUserId,
				enpProfiles.prefix,
				enpProfiles.firstName,
				enpProfiles.lastName,
				registryActs.bookNo
			)
			.limit(limit)
			.offset(offset)

		return rows.map(row => ({
			enpUserId: row.enpUserId,
			enpName: row.enpName,
			bookNo: row.bookNo ?? "",
			actCount: Number(row.actCount),
			firstActAt: iso(row.firstActAt),
			lastActAt: iso(row.lastActAt),
		}))
	}

	async listNotarizedDocuments(filter: ComplianceFilter): Promise<NotarizedDocument[]> {
		const conditions = [...dateRangeConditions(filter, registryActs.executedAt)]
		if (filter.enpUserId) conditions.push(eq(registryActs.enpUserId, filter.enpUserId))
		if (filter.bookNo) conditions.push(eq(registryActs.bookNo, filter.bookNo))
		if (filter.scStatus) conditions.push(eq(registryActs.scStatus, filter.scStatus))
		const { limit, offset } = pagination(filter)

		const rows = await db
			.select({
				id: registryActs.id,
				enpUserId: registryActs.enpUserId,
				enpName: sql<string>`concat_ws(' ', ${enpProfiles.prefix}, ${enpProfiles.firstName}, ${enpProfiles.lastName})`,
				actNumber: registryActs.actNumber,
				actType: registryActs.actType,
				title: registryActs.title,
				bookNo: registryActs.bookNo,
				pageNo: registryActs.pageNo,
				executedAt: registryActs.executedAt,
				scStatus: registryActs.scStatus,
				documentUrl: registryActs.documentUrl,
				description: registryActs.description,
			})
			.from(registryActs)
			.innerJoin(enpProfiles, eq(enpProfiles.userId, registryActs.enpUserId))
			.where(conditions.length ? and(...conditions) : undefined)
			.limit(limit)
			.offset(offset)

		return rows.map(row => mapNotarizedDocumentRow(row))
	}

	async getNotarizedDocument(id: string): Promise<NotarizedDocument> {
		const [row] = await db
			.select({
				id: registryActs.id,
				enpUserId: registryActs.enpUserId,
				enpName: sql<string>`concat_ws(' ', ${enpProfiles.prefix}, ${enpProfiles.firstName}, ${enpProfiles.lastName})`,
				actNumber: registryActs.actNumber,
				actType: registryActs.actType,
				title: registryActs.title,
				bookNo: registryActs.bookNo,
				pageNo: registryActs.pageNo,
				executedAt: registryActs.executedAt,
				scStatus: registryActs.scStatus,
				documentUrl: registryActs.documentUrl,
				description: registryActs.description,
			})
			.from(registryActs)
			.innerJoin(enpProfiles, eq(enpProfiles.userId, registryActs.enpUserId))
			.where(eq(registryActs.id, id))
			.limit(1)
		if (!row) throw new NotFoundException("Notarized document not found")
		return mapNotarizedDocumentRow(row)
	}

	async listAvRecordings(filter: ComplianceFilter): Promise<AvRecording[]> {
		const conditions = [
			eq(fileObjects.purpose, "session_recording" as const),
			isNull(fileObjects.deletedAt),
		]
		if (filter.enpUserId) conditions.push(eq(fileObjects.ownerUserId, filter.enpUserId))
		const { limit, offset } = pagination(filter)

		const rows = await db
			.select({
				id: fileObjects.id,
				appointmentId: appointmentDocuments.appointmentId,
				enpUserId: fileObjects.ownerUserId,
				enpName: sql<
					string | null
				>`coalesce(nullif(concat_ws(' ', ${enpProfiles.prefix}, ${enpProfiles.firstName}, ${enpProfiles.lastName}), ''), ${users.name})`,
				sha256: fileObjects.sha256,
				sizeBytes: fileObjects.sizeBytes,
				mime: fileObjects.mime,
				createdAt: fileObjects.createdAt,
			})
			.from(fileObjects)
			.leftJoin(appointmentDocuments, eq(appointmentDocuments.fileObjectId, fileObjects.id))
			.leftJoin(enpProfiles, eq(enpProfiles.userId, fileObjects.ownerUserId))
			.leftJoin(users, eq(users.id, fileObjects.ownerUserId))
			.where(and(...conditions))
			.limit(limit)
			.offset(offset)

		return rows.map(row => ({
			id: row.id,
			sessionId: null,
			appointmentId: row.appointmentId,
			enpUserId: row.enpUserId,
			enpName: row.enpName,
			sha256: row.sha256,
			sizeBytes: row.sizeBytes,
			mime: row.mime,
			createdAt: row.createdAt.toISOString(),
		}))
	}

	private async assertAvRecordingFile(id: string): Promise<{ id: string; mime: string }> {
		const [row] = await db
			.select({ id: fileObjects.id, mime: fileObjects.mime })
			.from(fileObjects)
			.where(
				and(
					eq(fileObjects.id, id),
					eq(fileObjects.purpose, "session_recording" as const),
					isNull(fileObjects.deletedAt)
				)
			)
			.limit(1)
		if (!row) throw new NotFoundException("AV recording not found")
		return row
	}

	private avRecordingFilename(id: string, mime: string): string {
		if (mime.includes("webm")) return `av-recording-${id.slice(0, 8)}.webm`
		if (mime.includes("mp4")) return `av-recording-${id.slice(0, 8)}.mp4`
		return `av-recording-${id.slice(0, 8)}.bin`
	}

	async streamAvRecording(id: string, res: Response, opts?: { download?: boolean }): Promise<void> {
		const row = await this.assertAvRecordingFile(id)
		await this.files.pipeStoredFileToResponse(id, res, {
			download: opts?.download,
			filename: this.avRecordingFilename(row.id, row.mime),
		})
	}

	async getAvRecordingUrl(id: string): Promise<{ url: string; expiresAt: string }> {
		await this.assertAvRecordingFile(id)

		const expiresSeconds = 15 * 60
		const { url } = await this.files.getSignedDownloadUrlById(id, expiresSeconds)
		return { url, expiresAt: new Date(Date.now() + expiresSeconds * 1000).toISOString() }
	}
}
