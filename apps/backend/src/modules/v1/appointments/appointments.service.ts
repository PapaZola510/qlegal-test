import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common"
import { createHash, randomBytes, timingSafeEqual, randomUUID } from "node:crypto"
import { ORPCError } from "@orpc/server"
import { and, count, desc, eq, ilike, inArray, isNull, lte, ne, or, sql } from "drizzle-orm"

import type {
	Appointment,
	AppointmentAttachment,
	AppointmentBookedDocumentType,
	AppointmentListResponse,
	AppointmentStatusCounts,
	CreateAppointment,
	CreateMeetingPaymentResult,
	DeclineBookingQuote,
	DirectorySearchInput,
	ListAppointmentsInput,
	MeetingFeeBreakdown,
	MeetingPaymentBrands,
	MeetingPaymentStatus,
	MeetingRecording,
	NotaryDirectoryEntry,
	ResolvedBookingInvite,
	SendBookingQuote,
} from "@repo/contracts"
import {
	appointmentDocuments,
	appointmentDocumentTypes,
	appointments,
	clientProfiles,
	enpDocumentTypes,
	enpProfiles,
	fileObjects,
	meetingSignatureRequests,
	paymentIntents,
	quicksignProjects,
	quicksignSigners,
	users,
} from "@repo/db/schema"

import { EMAIL_ADAPTER, type EmailAdapter } from "@/services/email/email-adapter"
import { isHitpayPaymentRequestCompleted } from "@/services/hitpay/hitpay-get-payment-request"
import { hitpayDevSandboxTestEnabled } from "@/services/hitpay/hitpay.client"
import { HitpayService } from "@/services/hitpay/hitpay.service"
import {
	isTlpeBrandUnavailableOnTestApi,
	tlpeBrandUnavailableMessage,
} from "@/services/tlpe/tlpe-brand-availability"
import { resolveTlpePaymentOption } from "@/services/tlpe/tlpe-options"
import { TlpeService } from "@/services/tlpe/tlpe.service"
import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { env } from "@/config/env.config"
import { dateToIsoOrEpoch } from "@/utils/safe-timestamp"

import { assertEnpCommissionAllowsNotarialActs } from "../auth-profile/lib/assert-enp-commission-active"
import { assertGovernmentIdAllowsNotarialActs } from "../auth-profile/lib/assert-government-id-allows-notarial-acts"
import { assertProfileKycVerified } from "../auth-profile/lib/assert-profile-kyc-verified"
import { EnpDocumentTypesService } from "../enp-document-types/enp-document-types.service"
import { EventsService } from "../events/events.service"
import { FilesService } from "../files/files.service"
import { RegistryService } from "../registry/registry.service"
import { isSessionRoomGuestForAppointment } from "../sessions/lib/is-session-room-guest"
import type { SessionsService } from "../sessions/sessions.service"
import { assertMeetingParticipantAccess } from "./lib/meeting-participation"
import { computeMeetingPaymentBreakdown } from "./lib/meeting-payment-breakdown"
import {
	getMeetingPaymentProvider,
	isMeetingPaymentDevSimulateAllowed,
	isMeetingPaymentProviderConfigured,
	meetingPaymentProviderLabel,
	type MeetingPaymentProviderName,
} from "./lib/meeting-payment-provider"

// Lazy require to break the circular value dependency between
// AppointmentsService and SessionsService at module evaluation time.
// The forwardRef closure runs at DI-resolution time, after both
// modules have finished loading.

const getSessionsService = () =>
	require("../sessions/sessions.service").SessionsService as typeof SessionsService

function sha256Hex(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex")
}

function formatEnpName(row: {
	prefix: string | null
	firstName: string
	lastName: string
	suffix: string | null
}): string {
	const parts = [row.prefix, row.firstName, row.lastName, row.suffix].filter(Boolean)
	return parts.join(" ").trim() || "ENP"
}

function computeCanStart(args: {
	status: (typeof appointments.$inferSelect)["status"]
	scheduledAt: Date
	durationMinutes: number
	now: Date
	leadMinutes: number
}): boolean {
	if (args.status !== "confirmed") return false
	const startMs = args.scheduledAt.getTime() - args.leadMinutes * 60_000
	const endMs = args.scheduledAt.getTime() + args.durationMinutes * 60_000
	const t = args.now.getTime()
	return t >= startMs && t < endMs
}

function computeCanRejoin(status: (typeof appointments.$inferSelect)["status"]): boolean {
	return status === "in_session"
}

function splitDisplayName(name: string): { firstName: string; lastName: string } {
	const trimmed = name.trim()
	const parts = trimmed.split(/\s+/).filter(Boolean)
	if (parts.length === 0) return { firstName: "Client", lastName: "." }
	if (parts.length === 1) return { firstName: parts[0]!, lastName: "." }
	return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") }
}

function fileNameFromS3Key(key: string): string {
	const parts = key.split("/")
	return parts[parts.length - 1] ?? key
}

/** Matches {@link RegistryService} `parseFeesFromDescription` for notarial book entries. */
function meetingQuickSignDescription(documentType: string, feePhp?: number): string {
	const base = `Meeting · ${documentType}`
	if (feePhp !== undefined && feePhp > 0) return `${base} | Fees: PHP ${feePhp}`
	return base
}

@Injectable()
export class AppointmentsService {
	private readonly log = new Logger(AppointmentsService.name)

	constructor(
		@Inject(EMAIL_ADAPTER) private readonly email: EmailAdapter,
		private readonly events: EventsService,
		private readonly registry: RegistryService,
		private readonly files: FilesService,
		private readonly enpDocTypes: EnpDocumentTypesService,
		private readonly hitpay: HitpayService,
		private readonly tlpe: TlpeService,
		@Inject(forwardRef(() => getSessionsService()))
		private readonly sessions: SessionsService
	) {}

	/** Mark QuickSign rows completed when every assigned signer has signed (principal Signed page). */
	private async markQuicksignProjectsCompletedWhenMeetingEnds(
		appointmentId: string,
		enpUserId: string
	): Promise<void> {
		const docRows = await db
			.select({ fileObjectId: appointmentDocuments.fileObjectId })
			.from(appointmentDocuments)
			.where(eq(appointmentDocuments.appointmentId, appointmentId))

		const now = new Date()
		for (const doc of docRows) {
			const sigRows = await db
				.select({ status: meetingSignatureRequests.status })
				.from(meetingSignatureRequests)
				.where(
					and(
						eq(meetingSignatureRequests.appointmentId, appointmentId),
						eq(meetingSignatureRequests.documentFileObjectId, doc.fileObjectId)
					)
				)
			if (!sigRows.length) continue
			if (!sigRows.every(r => r.status === "signed")) continue

			await db
				.update(quicksignProjects)
				.set({ status: "completed", completedAt: now, updatedAt: now })
				.where(
					and(
						eq(quicksignProjects.enpUserId, enpUserId),
						eq(quicksignProjects.documentFileObjectId, doc.fileObjectId),
						ne(quicksignProjects.status, "completed")
					)
				)
		}
	}

	/** Populate notarial registry from QuickSign project details (end session only). */
	private populateNotarialRegistryOnMeetingEnd(
		appointmentId: string,
		enpUserId: string,
		meetingEndedAt: Date
	): void {
		const run = async (label: string) => {
			try {
				const { created, skipped } = await this.registry.syncActsFromEndedMeeting({
					appointmentId,
					enpUserId,
					meetingEndedAt,
					allowWhenMeetingSignaturesComplete: true,
				})
				if (created > 0) {
					this.log.log(
						`Registry populate (${label}): ${created} act(s) for meeting ${appointmentId} (${skipped} skipped)`
					)
				}
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e)
				this.log.warn(
					`Registry populate (${label}) after meeting ${appointmentId}: ${msg.slice(0, 400)}`
				)
			}
		}

		void run("immediate")
		// Project may flip to COMPLETED seconds after the last signature.
		void (async () => {
			await new Promise(resolve => setTimeout(resolve, 15_000))
			await run("+15s")
		})()
	}

	async searchDirectory(input: DirectorySearchInput): Promise<NotaryDirectoryEntry[]> {
		const conditions = [
			eq(enpProfiles.certificateStatus, "certified"),
			isNull(users.deletedAt),
		] as const

		const extra: ReturnType<typeof and>[] = []
		if (input.city?.trim()) {
			extra.push(ilike(enpProfiles.cityProvince, `%${input.city.trim()}%`))
		}
		if (input.maxBaseFee !== undefined) {
			extra.push(lte(enpProfiles.directoryBaseFeePhp, input.maxBaseFee))
		}
		if (input.notarizationType) {
			const t = input.notarizationType.replace(/'/g, "''")
			extra.push(
				sql.raw(
					`(cardinality(enp_profiles.directory_specializations) = 0 OR enp_profiles.directory_specializations @> ARRAY['${t}']::text[])`
				)
			)
		}
		if (input.sessionMode) {
			const m = input.sessionMode.replace(/'/g, "''")
			extra.push(sql.raw(`(enp_profiles.directory_offered_modes @> ARRAY['${m}']::text[])`))
		}

		const whereClause = extra.length ? and(...conditions, ...extra) : and(...conditions)

		const rows = await db
			.select({
				userId: enpProfiles.userId,
				firstName: enpProfiles.firstName,
				lastName: enpProfiles.lastName,
				email: users.email,
				cityProvince: enpProfiles.cityProvince,
				specializations: enpProfiles.directorySpecializations,
				baseFee: enpProfiles.directoryBaseFeePhp,
				modes: enpProfiles.directoryOfferedModes,
			})
			.from(enpProfiles)
			.innerJoin(users, eq(users.id, enpProfiles.userId))
			.where(whereClause)

		return rows.map(r => {
			const [city, province = ""] = splitCityProvince(r.cityProvince)
			return {
				id: r.userId,
				firstName: r.firstName,
				lastName: r.lastName,
				email: r.email,
				city,
				province,
				specializations: (r.specializations ?? []) as NotaryDirectoryEntry["specializations"],
				baseFee: r.baseFee,
				availableModes: (r.modes ?? []) as NotaryDirectoryEntry["availableModes"],
				rating: 4.9,
				reviewCount: 0,
			}
		})
	}

	async resolveBookingInvite(token: string): Promise<ResolvedBookingInvite> {
		const hash = sha256Hex(token)
		const [row] = await db
			.select({
				userId: enpProfiles.userId,
				firstName: enpProfiles.firstName,
				lastName: enpProfiles.lastName,
				email: users.email,
				cityProvince: enpProfiles.cityProvince,
				expiresAt: enpProfiles.bookingInviteExpiresAt,
			})
			.from(enpProfiles)
			.innerJoin(users, eq(users.id, enpProfiles.userId))
			.where(
				and(
					eq(enpProfiles.bookingInviteTokenHash, hash),
					eq(enpProfiles.certificateStatus, "certified"),
					isNull(users.deletedAt)
				)
			)
			.limit(1)

		if (!row?.expiresAt || row.expiresAt.getTime() < Date.now()) {
			throw new ORPCError("NOT_FOUND", { message: "Invalid or expired invite" })
		}

		const [city, province = ""] = splitCityProvince(row.cityProvince)
		return {
			enpId: row.userId,
			firstName: row.firstName,
			lastName: row.lastName,
			email: row.email,
			city,
			province,
		}
	}

	async rotateBookingInvite(
		ctx: QlegalSessionContext
	): Promise<{ token: string; expiresAt: string }> {
		if (ctx.role !== "enp") {
			throw new ORPCError("FORBIDDEN", { message: "Only ENPs can create booking invite links" })
		}
		const [enp] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, ctx.userId))
			.limit(1)
		if (!enp) throw new ORPCError("FORBIDDEN", { message: "ENP profile required" })

		const token = randomBytes(24).toString("base64url")
		const hash = sha256Hex(token)
		const expiresAt = new Date(Date.now() + 7 * 86400_000)

		await db
			.update(enpProfiles)
			.set({
				bookingInviteTokenHash: hash,
				bookingInviteExpiresAt: expiresAt,
				updatedAt: new Date(),
			})
			.where(eq(enpProfiles.userId, ctx.userId))

		return { token, expiresAt: expiresAt.toISOString() }
	}

	private appointmentsScopeWhere(ctx: QlegalSessionContext) {
		if (ctx.role === "enp") return eq(appointments.enpUserId, ctx.userId)
		if (ctx.role === "client") return eq(appointments.clientUserId, ctx.userId)
		return or(eq(appointments.enpUserId, ctx.userId), eq(appointments.clientUserId, ctx.userId))!
	}

	private async countAppointmentsByStatus(
		scopeWhere: ReturnType<AppointmentsService["appointmentsScopeWhere"]>
	): Promise<AppointmentStatusCounts> {
		const grouped = await db
			.select({
				status: appointments.status,
				total: count(),
			})
			.from(appointments)
			.where(scopeWhere)
			.groupBy(appointments.status)

		const counts: AppointmentStatusCounts = {
			all: 0,
			pending: 0,
			quote_sent: 0,
			confirmed: 0,
			in_session: 0,
			ended: 0,
			declined: 0,
			cancelled: 0,
		}
		for (const row of grouped) {
			const n = Number(row.total)
			counts[row.status] = n
			counts.all += n
		}
		return counts
	}

	async list(
		ctx: QlegalSessionContext | null,
		input: ListAppointmentsInput = { page: 1, limit: 10 }
	): Promise<AppointmentListResponse> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const page = input.page ?? 1
		const limit = input.limit ?? 10
		const offset = (page - 1) * limit
		const scopeWhere = this.appointmentsScopeWhere(ctx)
		const listWhere = input.status
			? and(scopeWhere, eq(appointments.status, input.status))
			: scopeWhere

		const [rows, totalRow, statusCounts] = await Promise.all([
			db
				.select()
				.from(appointments)
				.where(listWhere)
				.orderBy(desc(appointments.createdAt))
				.limit(limit)
				.offset(offset),
			db.select({ total: count() }).from(appointments).where(listWhere),
			this.countAppointmentsByStatus(scopeWhere),
		])

		const total = Number(totalRow[0]?.total ?? 0)
		const items = await this.shapeMany(rows)

		return {
			items,
			meta: {
				page,
				limit,
				total,
				totalPages: total > 0 ? Math.ceil(total / limit) : 0,
			},
			statusCounts,
		}
	}

	async getOne(ctx: QlegalSessionContext | null, id: string): Promise<Appointment> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1)
		if (!row) throw new ORPCError("NOT_FOUND", { message: `Appointment ${id} not found` })

		await this.assertAppointmentParticipantAccess(ctx, row)
		return (await this.shapeMany([row]))[0]!
	}

	async listBookedDocumentTypes(
		ctx: QlegalSessionContext | null,
		appointmentId: string
	): Promise<AppointmentBookedDocumentType[]> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })
		await this.assertAppointmentParticipantAccess(ctx, row)

		return this.loadBookedDocumentTypes(appointmentId)
	}

	private async loadBookedDocumentTypes(
		appointmentId: string
	): Promise<AppointmentBookedDocumentType[]> {
		const rows = await db
			.select({
				id: enpDocumentTypes.id,
				name: enpDocumentTypes.name,
				pricePhpSnapshot: appointmentDocumentTypes.pricePhpSnapshot,
			})
			.from(appointmentDocumentTypes)
			.innerJoin(
				enpDocumentTypes,
				eq(enpDocumentTypes.id, appointmentDocumentTypes.enpDocumentTypeId)
			)
			.where(eq(appointmentDocumentTypes.appointmentId, appointmentId))
			.orderBy(enpDocumentTypes.name)

		return rows.map(r => ({
			id: r.id,
			name: r.name.trim(),
			pricePhpSnapshot: Math.floor(r.pricePhpSnapshot),
		}))
	}

	private async resolveBookedDocumentTypeForUpload(
		appointmentId: string,
		enpDocumentTypeId: string | undefined
	): Promise<{ enpDocumentTypeId: string; pricePhpSnapshot: number } | null> {
		const booked = await this.loadBookedDocumentTypes(appointmentId)
		if (booked.length === 0) {
			return null
		}
		const id = enpDocumentTypeId?.trim()
		if (!id) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Select which booked document type this upload is for",
			})
		}
		const match = booked.find(t => t.id === id)
		if (!match) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Document type is not part of this appointment booking",
			})
		}
		return {
			enpDocumentTypeId: match.id,
			pricePhpSnapshot: match.pricePhpSnapshot,
		}
	}

	async listAttachments(
		ctx: QlegalSessionContext | null,
		appointmentId: string
	): Promise<AppointmentAttachment[]> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })
		await this.assertAppointmentParticipantAccess(ctx, row)

		try {
			const links = await db
				.select({
					fileObjectId: appointmentDocuments.fileObjectId,
					mime: fileObjects.mime,
					linkedAt: appointmentDocuments.createdAt,
					sizeBytes: fileObjects.sizeBytes,
					s3Key: fileObjects.s3Key,
					ownerUserId: fileObjects.ownerUserId,
					displayName: appointmentDocuments.displayName,
					documentType: appointmentDocuments.documentType,
					enpDocumentTypeId: appointmentDocuments.enpDocumentTypeId,
					feePhp: appointmentDocuments.feePhp,
				})
				.from(appointmentDocuments)
				.innerJoin(fileObjects, eq(fileObjects.id, appointmentDocuments.fileObjectId))
				.where(
					and(
						eq(appointmentDocuments.appointmentId, appointmentId),
						eq(fileObjects.purpose, "appointment_attachment"),
						isNull(fileObjects.deletedAt)
					)
				)
				.orderBy(desc(appointmentDocuments.createdAt))

			const fileIds = [...new Set(links.map(l => l.fileObjectId))]
			const qsByFile = new Map<string, { id: string; doconchainProjectUuid: string | null }>()
			if (fileIds.length > 0) {
				const qsRows = await db
					.select({
						id: quicksignProjects.id,
						documentFileObjectId: quicksignProjects.documentFileObjectId,
						doconchainProjectUuid: quicksignProjects.doconchainProjectUuid,
					})
					.from(quicksignProjects)
					.where(
						and(
							eq(quicksignProjects.enpUserId, row.enpUserId),
							inArray(quicksignProjects.documentFileObjectId, fileIds)
						)
					)
					.orderBy(desc(quicksignProjects.createdAt))

				for (const q of qsRows) {
					if (!qsByFile.has(q.documentFileObjectId)) {
						qsByFile.set(q.documentFileObjectId, {
							id: q.id,
							doconchainProjectUuid: q.doconchainProjectUuid,
						})
					}
				}
			}

			return links.map((r, idx) => {
				const qs = qsByFile.get(r.fileObjectId)
				const mimeRaw = r.mime
				const mimeStr =
					typeof mimeRaw === "string" && mimeRaw.trim().length > 0
						? mimeRaw.trim()
						: "application/octet-stream"
				const key = typeof r.s3Key === "string" ? r.s3Key.trim() : ""
				const storedDisplay =
					typeof r.displayName === "string" && r.displayName.trim().length > 0
						? r.displayName.trim()
						: undefined
				const documentName = storedDisplay ?? (key ? fileNameFromS3Key(key) : undefined)
				const docType =
					typeof r.documentType === "string" && r.documentType.trim().length > 0
						? r.documentType.trim()
						: undefined
				const sz = r.sizeBytes
				const sizeBytes =
					typeof sz === "number" && Number.isFinite(sz) && sz >= 0 ? Math.floor(sz) : undefined

				const out: AppointmentAttachment = {
					id: `${appointmentId}:${r.fileObjectId}:${idx}`,
					fileObjectId: r.fileObjectId,
					mimeType: mimeStr,
					linkedAt: dateToIsoOrEpoch(r.linkedAt),
				}
				if (documentName) out.documentName = documentName
				if (docType) out.documentType = docType
				if (typeof r.enpDocumentTypeId === "string" && r.enpDocumentTypeId.trim().length > 0) {
					out.enpDocumentTypeId = r.enpDocumentTypeId.trim()
				}
				if (typeof r.feePhp === "number" && r.feePhp > 0) out.feePhp = r.feePhp
				if (sizeBytes !== undefined) out.sizeBytes = sizeBytes
				if (qs) {
					out.quicksignProjectId = qs.id
					out.doconchainProjectUuid = qs.doconchainProjectUuid
				}
				if (r.ownerUserId) {
					out.uploadedByUserId = r.ownerUserId
					out.uploadedByPrincipal = r.ownerUserId !== row.enpUserId
				}
				return out
			})
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.error(`listAttachments failed appointmentId=${appointmentId}: ${msg}`)
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to list attachments" })
		}
	}

	async listMeetingRecordings(
		ctx: QlegalSessionContext | null,
		appointmentId: string
	): Promise<MeetingRecording[]> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })
		await this.assertAppointmentParticipantAccess(ctx, row)

		const links = await db
			.select({
				fileObjectId: appointmentDocuments.fileObjectId,
				mime: fileObjects.mime,
				linkedAt: appointmentDocuments.createdAt,
				sizeBytes: fileObjects.sizeBytes,
				s3Key: fileObjects.s3Key,
				displayName: appointmentDocuments.displayName,
			})
			.from(appointmentDocuments)
			.innerJoin(fileObjects, eq(fileObjects.id, appointmentDocuments.fileObjectId))
			.where(
				and(
					eq(appointmentDocuments.appointmentId, appointmentId),
					eq(fileObjects.purpose, "session_recording"),
					isNull(fileObjects.deletedAt)
				)
			)
			.orderBy(desc(appointmentDocuments.createdAt))

		return links.map((r, idx) => {
			const mimeRaw = r.mime
			const mimeType =
				typeof mimeRaw === "string" && mimeRaw.trim().length > 0
					? mimeRaw.trim()
					: "application/octet-stream"
			const key = typeof r.s3Key === "string" ? r.s3Key.trim() : ""
			const displayName =
				typeof r.displayName === "string" && r.displayName.trim().length > 0
					? r.displayName.trim()
					: undefined
			const fileName = displayName ?? (key ? fileNameFromS3Key(key) : "recording.webm")
			const sz = r.sizeBytes
			const sizeBytes =
				typeof sz === "number" && Number.isFinite(sz) && sz >= 0 ? Math.floor(sz) : undefined

			const out: MeetingRecording = {
				id: `${appointmentId}:${r.fileObjectId}:${idx}`,
				appointmentId,
				appointmentTitle: row.title,
				fileObjectId: r.fileObjectId,
				mimeType,
				linkedAt: dateToIsoOrEpoch(r.linkedAt),
				fileName,
			}
			if (sizeBytes !== undefined) out.sizeBytes = sizeBytes
			return out
		})
	}

	async listAllMeetingRecordings(ctx: QlegalSessionContext | null): Promise<MeetingRecording[]> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const appointmentRows = await db
			.select({
				id: appointments.id,
				title: appointments.title,
			})
			.from(appointments)
			.where(or(eq(appointments.enpUserId, ctx.userId), eq(appointments.clientUserId, ctx.userId)))

		if (!appointmentRows.length) return []
		const appointmentIds = appointmentRows.map(a => a.id)
		const titleByAppointmentId = new Map(appointmentRows.map(a => [a.id, a.title]))

		const links = await db
			.select({
				appointmentId: appointmentDocuments.appointmentId,
				fileObjectId: appointmentDocuments.fileObjectId,
				mime: fileObjects.mime,
				linkedAt: appointmentDocuments.createdAt,
				sizeBytes: fileObjects.sizeBytes,
				s3Key: fileObjects.s3Key,
				displayName: appointmentDocuments.displayName,
			})
			.from(appointmentDocuments)
			.innerJoin(fileObjects, eq(fileObjects.id, appointmentDocuments.fileObjectId))
			.where(
				and(
					inArray(appointmentDocuments.appointmentId, appointmentIds),
					eq(fileObjects.purpose, "session_recording"),
					isNull(fileObjects.deletedAt)
				)
			)
			.orderBy(desc(appointmentDocuments.createdAt))

		return links.map((r, idx) => {
			const mimeRaw = r.mime
			const mimeType =
				typeof mimeRaw === "string" && mimeRaw.trim().length > 0
					? mimeRaw.trim()
					: "application/octet-stream"
			const key = typeof r.s3Key === "string" ? r.s3Key.trim() : ""
			const displayName =
				typeof r.displayName === "string" && r.displayName.trim().length > 0
					? r.displayName.trim()
					: undefined
			const fileName = displayName ?? (key ? fileNameFromS3Key(key) : "recording.webm")
			const sz = r.sizeBytes
			const sizeBytes =
				typeof sz === "number" && Number.isFinite(sz) && sz >= 0 ? Math.floor(sz) : undefined
			const appointmentTitle = titleByAppointmentId.get(r.appointmentId) ?? "Appointment"

			const out: MeetingRecording = {
				id: `${r.appointmentId}:${r.fileObjectId}:${idx}`,
				appointmentId: r.appointmentId,
				appointmentTitle,
				fileObjectId: r.fileObjectId,
				mimeType,
				linkedAt: dateToIsoOrEpoch(r.linkedAt),
				fileName,
			}
			if (sizeBytes !== undefined) out.sizeBytes = sizeBytes
			return out
		})
	}

	async linkMeetingDocument(
		ctx: QlegalSessionContext | null,
		appointmentId: string,
		input: {
			fileObjectId: string
			documentName: string
			documentType: string
			enpDocumentTypeId?: string
			feePhp: number
		}
	): Promise<AppointmentAttachment> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })
		// Authorize by appointment ownership first — session role can be stale ("none") on oRPC
		// when context hydration races, even for certified ENPs acting in a live meeting.
		if (row.enpUserId !== ctx.userId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the ENP for this appointment may upload session documents",
			})
		}
		if (row.status !== "in_session") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Documents can only be uploaded while the meeting is in session",
			})
		}
		await this.assertMeetingDocumentUploadAllowed(appointmentId)

		await this.assertEnpMeetingDocumentFile(ctx.userId, input.fileObjectId)

		const displayName = input.documentName.trim()
		const documentType = input.documentType.trim()
		const bookedType = await this.resolveBookedDocumentTypeForUpload(
			appointmentId,
			input.enpDocumentTypeId
		)

		const feePhp = Math.floor(input.feePhp)
		if (!Number.isFinite(feePhp) || feePhp <= 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Enter a notarization fee greater than zero (PHP).",
			})
		}

		const now = new Date()

		const existing = await db
			.select({ fileObjectId: appointmentDocuments.fileObjectId })
			.from(appointmentDocuments)
			.where(
				and(
					eq(appointmentDocuments.appointmentId, appointmentId),
					eq(appointmentDocuments.fileObjectId, input.fileObjectId)
				)
			)
			.limit(1)

		const docValues = {
			displayName,
			documentType,
			feePhp,
			...(bookedType ? { enpDocumentTypeId: bookedType.enpDocumentTypeId } : {}),
		}

		if (!existing.length) {
			await db.insert(appointmentDocuments).values({
				appointmentId,
				fileObjectId: input.fileObjectId,
				...docValues,
				createdAt: now,
			})
		} else {
			await db
				.update(appointmentDocuments)
				.set(docValues)
				.where(
					and(
						eq(appointmentDocuments.appointmentId, appointmentId),
						eq(appointmentDocuments.fileObjectId, input.fileObjectId)
					)
				)
		}

		await this.ensureProjectForMeetingDocument({
			enpUserId: ctx.userId,
			ctx,
			sessionMode: row.sessionMode,
			fileObjectId: input.fileObjectId,
			documentName: displayName,
			documentType,
			feePhp,
		})

		const list = await this.listAttachments(ctx, appointmentId)
		const linked = list.find(a => a.fileObjectId === input.fileObjectId)
		if (!linked) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Document linked but could not be loaded",
			})
		}

		await this.invalidateMeetingPaymentAfterFeeChange(
			appointmentId,
			row.clientUserId,
			row.enpUserId
		)

		return linked
	}

	/**
	 * Resolve the ENP's sub-org id for the given appointment. Used when a principal/client
	 * uploads a meeting document — the file goes to the ENP's tenant so that downstream
	 * downstream provisioning (initiated by the ENP) has the right tenancy context.
	 */
	async resolveEnpSubOrgIdForAppointment(appointmentId: string): Promise<{
		appointment: typeof appointments.$inferSelect
		enpSubOrgId: string
	}> {
		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })

		const [enp] = await db
			.select({ subOrgId: enpProfiles.subOrgId })
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, row.enpUserId))
			.limit(1)
		if (!enp?.subOrgId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "ENP for this appointment has no organization context yet",
			})
		}
		return { appointment: row, enpSubOrgId: enp.subOrgId }
	}

	/**
	 * Link a file uploaded by the principal/client during a live session.
	 * No QuickSign project is created here — the ENP must call
	 * {@link createMeetingDocumentProject} explicitly before adding signers.
	 */
	async linkPrincipalMeetingDocument(
		ctx: QlegalSessionContext | null,
		appointmentId: string,
		input: {
			fileObjectId: string
			documentName: string
			documentType: string
			enpDocumentTypeId?: string
		}
	): Promise<AppointmentAttachment> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })

		if (row.clientUserId !== ctx.userId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the booking client may upload as the principal",
			})
		}
		if (row.status !== "in_session") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Documents can only be uploaded while the meeting is in session",
			})
		}
		await this.assertMeetingDocumentUploadAllowed(appointmentId)

		const [file] = await db
			.select({ id: fileObjects.id, ownerUserId: fileObjects.ownerUserId })
			.from(fileObjects)
			.where(
				and(
					eq(fileObjects.id, input.fileObjectId),
					eq(fileObjects.ownerUserId, ctx.userId),
					eq(fileObjects.purpose, "appointment_attachment"),
					isNull(fileObjects.deletedAt)
				)
			)
			.limit(1)
		if (!file) {
			throw new ORPCError("BAD_REQUEST", {
				message: "File is missing, not owned by you, or not marked as an appointment attachment",
			})
		}

		const displayName = input.documentName.trim()
		const documentType = input.documentType.trim()
		const bookedType = await this.resolveBookedDocumentTypeForUpload(
			appointmentId,
			input.enpDocumentTypeId
		)
		const now = new Date()

		const existing = await db
			.select({ fileObjectId: appointmentDocuments.fileObjectId })
			.from(appointmentDocuments)
			.where(
				and(
					eq(appointmentDocuments.appointmentId, appointmentId),
					eq(appointmentDocuments.fileObjectId, input.fileObjectId)
				)
			)
			.limit(1)

		const docValues = {
			displayName,
			documentType,
			...(bookedType
				? {
						enpDocumentTypeId: bookedType.enpDocumentTypeId,
						feePhp: bookedType.pricePhpSnapshot,
					}
				: {}),
		}

		if (!existing.length) {
			await db.insert(appointmentDocuments).values({
				appointmentId,
				fileObjectId: input.fileObjectId,
				...docValues,
				createdAt: now,
			})
		} else {
			await db
				.update(appointmentDocuments)
				.set(docValues)
				.where(
					and(
						eq(appointmentDocuments.appointmentId, appointmentId),
						eq(appointmentDocuments.fileObjectId, input.fileObjectId)
					)
				)
		}

		if (bookedType) {
			await this.invalidateMeetingPaymentAfterFeeChange(
				appointmentId,
				row.clientUserId,
				row.enpUserId
			)
		}

		this.events.emitToUser(row.enpUserId, "appointments:meeting-document-added", {
			appointmentId,
			fileObjectId: input.fileObjectId,
			uploadedByUserId: ctx.userId,
		})

		const list = await this.listAttachments(ctx, appointmentId)
		const linked = list.find(a => a.fileObjectId === input.fileObjectId)
		if (!linked) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Document linked but could not be loaded",
			})
		}
		return linked
	}

	/**
	 * Provision a QuickSign project for a meeting document that was already linked
	 * (e.g. uploaded by the principal). Only the ENP for the appointment may call this.
	 */
	async createMeetingDocumentProject(
		ctx: QlegalSessionContext | null,
		appointmentId: string,
		input: { fileObjectId: string; feePhp?: number }
	): Promise<AppointmentAttachment> {
		const fileObjectId = input.fileObjectId
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })

		if (row.enpUserId !== ctx.userId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the ENP for this appointment may create the signing project",
			})
		}
		if (row.status !== "in_session") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Signing projects can only be created while the meeting is in session",
			})
		}

		const [link] = await db
			.select({
				fileObjectId: appointmentDocuments.fileObjectId,
				displayName: appointmentDocuments.displayName,
				documentType: appointmentDocuments.documentType,
				feePhp: appointmentDocuments.feePhp,
				s3Key: fileObjects.s3Key,
			})
			.from(appointmentDocuments)
			.innerJoin(fileObjects, eq(fileObjects.id, appointmentDocuments.fileObjectId))
			.where(
				and(
					eq(appointmentDocuments.appointmentId, appointmentId),
					eq(appointmentDocuments.fileObjectId, fileObjectId),
					isNull(fileObjects.deletedAt)
				)
			)
			.limit(1)

		if (!link) {
			throw new ORPCError("NOT_FOUND", {
				message: "Document is not linked to this appointment",
			})
		}

		const displayName =
			(typeof link.displayName === "string" && link.displayName.trim().length > 0
				? link.displayName.trim()
				: undefined) ??
			(typeof link.s3Key === "string" ? fileNameFromS3Key(link.s3Key) : "document.pdf")
		const documentType =
			typeof link.documentType === "string" && link.documentType.trim().length > 0
				? link.documentType.trim()
				: "SIGNATURE_WITNESSING"

		let feePhp = typeof link.feePhp === "number" && link.feePhp > 0 ? link.feePhp : undefined
		if (input.feePhp !== undefined) {
			const nextFee = Math.floor(input.feePhp)
			if (!Number.isFinite(nextFee) || nextFee <= 0) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Enter a notarization fee greater than zero (PHP).",
				})
			}
			feePhp = nextFee
			await db
				.update(appointmentDocuments)
				.set({ feePhp: nextFee })
				.where(
					and(
						eq(appointmentDocuments.appointmentId, appointmentId),
						eq(appointmentDocuments.fileObjectId, fileObjectId)
					)
				)
		}
		if (!feePhp) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Set a notarization fee (PHP) before creating the signing project.",
			})
		}

		await this.ensureProjectForMeetingDocument({
			enpUserId: ctx.userId,
			ctx,
			sessionMode: row.sessionMode,
			fileObjectId,
			documentName: displayName,
			documentType,
			feePhp,
		})

		const list = await this.listAttachments(ctx, appointmentId)
		const updated = list.find(a => a.fileObjectId === fileObjectId)
		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Signing project created but document could not be loaded",
			})
		}
		return updated
	}

	async updateMeetingDocumentFee(
		ctx: QlegalSessionContext | null,
		appointmentId: string,
		fileObjectId: string,
		feePhpInput: number
	): Promise<AppointmentAttachment> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const row = await this.assertEnpInSessionForMeetingDocument(ctx, appointmentId)
		const feePhp = Math.floor(feePhpInput)
		if (!Number.isFinite(feePhp) || feePhp <= 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Enter a notarization fee greater than zero (PHP).",
			})
		}

		const [link] = await db
			.select({
				displayName: appointmentDocuments.displayName,
				documentType: appointmentDocuments.documentType,
			})
			.from(appointmentDocuments)
			.where(
				and(
					eq(appointmentDocuments.appointmentId, appointmentId),
					eq(appointmentDocuments.fileObjectId, fileObjectId)
				)
			)
			.limit(1)
		if (!link) {
			throw new ORPCError("NOT_FOUND", { message: "Document is not linked to this appointment" })
		}

		await db
			.update(appointmentDocuments)
			.set({ feePhp })
			.where(
				and(
					eq(appointmentDocuments.appointmentId, appointmentId),
					eq(appointmentDocuments.fileObjectId, fileObjectId)
				)
			)

		const documentType =
			typeof link.documentType === "string" && link.documentType.trim().length > 0
				? link.documentType.trim()
				: "signature_witnessing"

		const [qs] = await db
			.select({ id: quicksignProjects.id })
			.from(quicksignProjects)
			.where(
				and(
					eq(quicksignProjects.enpUserId, row.enpUserId),
					eq(quicksignProjects.documentFileObjectId, fileObjectId)
				)
			)
			.limit(1)

		if (qs) {
			await db
				.update(quicksignProjects)
				.set({
					description: meetingQuickSignDescription(documentType, feePhp),
					updatedAt: new Date(),
				})
				.where(eq(quicksignProjects.id, qs.id))
		}

		const list = await this.listAttachments(ctx, appointmentId)
		const updated = list.find(a => a.fileObjectId === fileObjectId)
		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Fee updated but document could not be loaded",
			})
		}

		await this.invalidateMeetingPaymentAfterFeeChange(
			appointmentId,
			row.clientUserId,
			row.enpUserId
		)

		return updated
	}

	async deleteMeetingDocument(
		ctx: QlegalSessionContext | null,
		appointmentId: string,
		fileObjectId: string
	): Promise<{ ok: true; fileObjectId: string }> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const row = await this.assertEnpInSessionForMeetingDocument(ctx, appointmentId)

		const [link] = await db
			.select({
				fileObjectId: appointmentDocuments.fileObjectId,
				ownerUserId: fileObjects.ownerUserId,
			})
			.from(appointmentDocuments)
			.innerJoin(fileObjects, eq(fileObjects.id, appointmentDocuments.fileObjectId))
			.where(
				and(
					eq(appointmentDocuments.appointmentId, appointmentId),
					eq(appointmentDocuments.fileObjectId, fileObjectId),
					isNull(fileObjects.deletedAt)
				)
			)
			.limit(1)
		if (!link) {
			throw new ORPCError("NOT_FOUND", { message: "Document is not linked to this appointment" })
		}

		const [signerCountRow] = await db
			.select({ n: count() })
			.from(meetingSignatureRequests)
			.where(
				and(
					eq(meetingSignatureRequests.appointmentId, appointmentId),
					eq(meetingSignatureRequests.documentFileObjectId, fileObjectId)
				)
			)
		const signerCount = Number(signerCountRow?.n ?? 0)
		if (signerCount > 0) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Remove signers before deleting this document, or delete only documents with no signers assigned yet.",
			})
		}

		const [qs] = await db
			.select({ id: quicksignProjects.id })
			.from(quicksignProjects)
			.where(
				and(
					eq(quicksignProjects.enpUserId, row.enpUserId),
					eq(quicksignProjects.documentFileObjectId, fileObjectId)
				)
			)
			.limit(1)

		if (qs) {
			await db.delete(quicksignSigners).where(eq(quicksignSigners.projectId, qs.id))
			await db.delete(quicksignProjects).where(eq(quicksignProjects.id, qs.id))
		}

		await db
			.delete(appointmentDocuments)
			.where(
				and(
					eq(appointmentDocuments.appointmentId, appointmentId),
					eq(appointmentDocuments.fileObjectId, fileObjectId)
				)
			)

		if (link.ownerUserId === row.enpUserId) {
			try {
				await this.files.softDelete(fileObjectId, ctx)
			} catch {
				// Unlink succeeded; storage row may already be gone.
			}
		}

		this.events.emitToUser(row.enpUserId, "appointments:meeting-document-removed", {
			appointmentId,
			fileObjectId,
		})
		if (row.clientUserId) {
			this.events.emitToUser(row.clientUserId, "appointments:meeting-document-removed", {
				appointmentId,
				fileObjectId,
			})
		}

		await this.invalidateMeetingPaymentAfterFeeChange(
			appointmentId,
			row.clientUserId,
			row.enpUserId
		)

		return { ok: true as const, fileObjectId }
	}

	async linkMeetingRecording(
		ctx: QlegalSessionContext | null,
		appointmentId: string,
		input: { fileObjectId: string; fileName: string }
	): Promise<MeetingRecording> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })

		const isAssignedEnp = row.enpUserId === ctx.userId
		const isAssignedPrincipal = row.clientUserId === ctx.userId
		if (!isAssignedEnp && !isAssignedPrincipal) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the assigned ENP or principal may link session recordings",
			})
		}
		if (row.status !== "in_session" && row.status !== "ended") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Recordings can only be linked during or immediately after a live session",
			})
		}

		const [file] = await db
			.select({ id: fileObjects.id })
			.from(fileObjects)
			.where(
				and(
					eq(fileObjects.id, input.fileObjectId),
					eq(fileObjects.ownerUserId, ctx.userId),
					eq(fileObjects.purpose, "session_recording"),
					isNull(fileObjects.deletedAt)
				)
			)
			.limit(1)

		if (!file) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Recording file is missing, not owned by you, or not marked as a session recording",
			})
		}

		const displayName = input.fileName.trim().slice(0, 255)
		const now = new Date()
		const existing = await db
			.select({ fileObjectId: appointmentDocuments.fileObjectId })
			.from(appointmentDocuments)
			.where(
				and(
					eq(appointmentDocuments.appointmentId, appointmentId),
					eq(appointmentDocuments.fileObjectId, input.fileObjectId)
				)
			)
			.limit(1)

		if (!existing.length) {
			await db.insert(appointmentDocuments).values({
				appointmentId,
				fileObjectId: input.fileObjectId,
				displayName,
				documentType: "SESSION_RECORDING",
				createdAt: now,
			})
		} else {
			await db
				.update(appointmentDocuments)
				.set({ displayName, documentType: "SESSION_RECORDING" })
				.where(
					and(
						eq(appointmentDocuments.appointmentId, appointmentId),
						eq(appointmentDocuments.fileObjectId, input.fileObjectId)
					)
				)
		}

		const list = await this.listMeetingRecordings(ctx, appointmentId)
		const linked = list.find(r => r.fileObjectId === input.fileObjectId)
		if (!linked) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Recording linked but could not be loaded",
			})
		}
		return linked
	}

	async deleteMeetingRecording(
		ctx: QlegalSessionContext | null,
		appointmentId: string,
		fileObjectId: string
	): Promise<{ ok: boolean }> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })
		if (row.enpUserId !== ctx.userId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the ENP for this appointment may delete meeting recordings",
			})
		}

		const [link] = await db
			.select({ fileObjectId: appointmentDocuments.fileObjectId })
			.from(appointmentDocuments)
			.innerJoin(fileObjects, eq(fileObjects.id, appointmentDocuments.fileObjectId))
			.where(
				and(
					eq(appointmentDocuments.appointmentId, appointmentId),
					eq(appointmentDocuments.fileObjectId, fileObjectId),
					eq(fileObjects.purpose, "session_recording"),
					isNull(fileObjects.deletedAt)
				)
			)
			.limit(1)
		if (!link) {
			throw new ORPCError("NOT_FOUND", { message: "Recording not found for this appointment" })
		}

		await this.files.softDelete(fileObjectId, ctx)
		return { ok: true }
	}

	async create(ctx: QlegalSessionContext | null, input: CreateAppointment): Promise<Appointment> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		let canBookAsClient = ctx.role === "client"

		if (!canBookAsClient) {
			const [existingClient] = await db
				.select({ userId: clientProfiles.userId })
				.from(clientProfiles)
				.where(eq(clientProfiles.userId, ctx.userId))
				.limit(1)
			canBookAsClient = Boolean(existingClient)
		}

		// If account has not bootstrapped client profile yet, create a minimal one on first booking attempt.
		// This prevents false 403s for sessions still carrying role "none" during onboarding edges.
		if (!canBookAsClient && ctx.role === "none") {
			const [user] = await db
				.select({ name: users.name })
				.from(users)
				.where(eq(users.id, ctx.userId))
				.limit(1)
			if (user) {
				const { firstName, lastName } = splitDisplayName(user.name ?? "")
				await db
					.insert(clientProfiles)
					.values({
						userId: ctx.userId,
						firstName,
						lastName,
						updatedAt: new Date(),
					})
					.onConflictDoNothing({ target: clientProfiles.userId })
				canBookAsClient = true
			}
		}

		if (!canBookAsClient) {
			throw new ORPCError("FORBIDDEN", { message: "Only clients can request appointments" })
		}

		const clientKyc = await assertProfileKycVerified(ctx.userId, "client", "booking")
		if (!clientKyc.ok) {
			throw new ORPCError("FORBIDDEN", { message: clientKyc.detail })
		}
		const clientGovId = await assertGovernmentIdAllowsNotarialActs(ctx.userId)
		if (!clientGovId.ok) {
			throw new ORPCError("FORBIDDEN", { message: clientGovId.detail })
		}

		const [enp] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, input.enpId))
			.limit(1)
		if (!enp || enp.certificateStatus !== "certified") {
			throw new ORPCError("NOT_FOUND", { message: "ENP not found or not certified" })
		}

		const selectedDocTypes = await this.enpDocTypes.resolveAndValidateSelection({
			enpId: input.enpId,
			documentTypeIds: input.documentTypeIds,
		})

		if (input.bookingInviteToken) {
			await this.assertValidBookingInvite(input.enpId, input.bookingInviteToken)
		}

		const bookingDocs = input.bookingDocuments
		const fileIds = bookingDocs.map(d => d.fileObjectId)
		await this.assertAppointmentFiles(ctx.userId, fileIds)

		const now = new Date()
		const [inserted] = await db
			.insert(appointments)
			.values({
				clientUserId: ctx.userId,
				enpUserId: input.enpId,
				title: input.title,
				description: input.description ?? null,
				status: "pending",
				kind: "standard",
				scheduledAt: new Date(input.scheduledAt),
				durationMinutes: input.durationMinutes,
				location: input.location ?? null,
				meetingUrl: input.meetingUrl ?? null,
				notes: input.notes ?? null,
				notarizationType: input.notarizationType,
				sessionMode: input.sessionMode,
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		if (!inserted) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Create failed" })

		await db.insert(appointmentDocuments).values(
			bookingDocs.map(doc => ({
				appointmentId: inserted.id,
				fileObjectId: doc.fileObjectId,
				displayName: doc.displayName?.trim() || null,
				createdAt: now,
			}))
		)

		await db.insert(appointmentDocumentTypes).values(
			selectedDocTypes.map(t => ({
				appointmentId: inserted.id,
				enpDocumentTypeId: t.id,
				pricePhpSnapshot: Math.floor(t.pricePhp),
				createdAt: now,
			}))
		)

		const shaped = (await this.shapeMany([inserted]))[0]!

		this.events.emitToUser(input.enpId, "appointments:pending", {
			appointmentId: inserted.id,
			clientId: ctx.userId,
		})

		return shaped
	}

	async sendBookingQuote(
		ctx: QlegalSessionContext | null,
		input: SendBookingQuote
	): Promise<Appointment> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const appointmentId = input.id
		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })
		if (ctx.userId !== row.enpUserId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the assigned ENP can send a booking quote",
			})
		}
		if (row.status !== "pending") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only pending appointments awaiting a quote can be quoted",
			})
		}

		const enpKyc = await assertProfileKycVerified(ctx.userId, "enp")
		if (!enpKyc.ok) throw new ORPCError("FORBIDDEN", { message: enpKyc.detail })
		const enpGovId = await assertGovernmentIdAllowsNotarialActs(ctx.userId)
		if (!enpGovId.ok) throw new ORPCError("FORBIDDEN", { message: enpGovId.detail })
		const enpCommission = await assertEnpCommissionAllowsNotarialActs(ctx.userId)
		if (!enpCommission.ok) throw new ORPCError("FORBIDDEN", { message: enpCommission.detail })

		const linkedDocs = await db
			.select({ fileObjectId: appointmentDocuments.fileObjectId })
			.from(appointmentDocuments)
			.innerJoin(fileObjects, eq(fileObjects.id, appointmentDocuments.fileObjectId))
			.where(
				and(
					eq(appointmentDocuments.appointmentId, appointmentId),
					eq(fileObjects.purpose, "appointment_attachment"),
					isNull(fileObjects.deletedAt)
				)
			)
		if (linkedDocs.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "This appointment has no booking documents to quote",
			})
		}

		const linkedIds = new Set(linkedDocs.map(d => d.fileObjectId))
		const lineIds = new Set(input.lineItems.map(li => li.fileObjectId))
		if (linkedIds.size !== lineIds.size || [...linkedIds].some(id => !lineIds.has(id))) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Quote must include exactly one line item per uploaded booking document",
			})
		}

		const bookedTypes = await this.loadBookedDocumentTypes(appointmentId)
		const bookedTypeIds = new Set(bookedTypes.map(t => t.id))

		const now = new Date()
		for (const item of input.lineItems) {
			const enpDocTypeId = item.enpDocumentTypeId?.trim()
			if (enpDocTypeId && !bookedTypeIds.has(enpDocTypeId)) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Document type is not part of this appointment booking",
				})
			}
			await db
				.update(appointmentDocuments)
				.set({
					documentType: item.notarizationType,
					feePhp: Math.floor(item.feePhp),
					enpDocumentTypeId: enpDocTypeId ?? null,
				})
				.where(
					and(
						eq(appointmentDocuments.appointmentId, appointmentId),
						eq(appointmentDocuments.fileObjectId, item.fileObjectId)
					)
				)
		}

		const primaryAct = input.lineItems[0]!.notarizationType
		const [updated] = await db
			.update(appointments)
			.set({
				status: "quote_sent",
				notarizationType: primaryAct,
				quoteSentAt: now,
				quoteNotes: input.notes?.trim() || null,
				updatedAt: now,
			})
			.where(eq(appointments.id, appointmentId))
			.returning()
		if (!updated) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Quote update failed" })

		const shaped = (await this.shapeMany([updated]))[0]!
		this.events.emitToUser(row.clientUserId, "appointments:updated", {
			appointmentId,
			status: "quote_sent",
		})
		return shaped
	}

	async acceptBookingQuote(
		ctx: QlegalSessionContext | null,
		appointmentId: string
	): Promise<Appointment> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })
		if (ctx.userId !== row.clientUserId) {
			throw new ORPCError("FORBIDDEN", { message: "Only the client can accept a booking quote" })
		}
		if (row.status !== "quote_sent") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only appointments with a sent quote can be accepted",
			})
		}

		return this.updateStatus(ctx, appointmentId, "confirmed")
	}

	async declineBookingQuote(
		ctx: QlegalSessionContext | null,
		input: DeclineBookingQuote
	): Promise<Appointment> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db.select().from(appointments).where(eq(appointments.id, input.id)).limit(1)
		if (!row) throw new ORPCError("NOT_FOUND", { message: `Appointment ${input.id} not found` })
		if (ctx.userId !== row.clientUserId) {
			throw new ORPCError("FORBIDDEN", { message: "Only the client can decline a booking quote" })
		}
		if (row.status !== "quote_sent") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only appointments with a sent quote can be declined",
			})
		}

		return this.updateStatus(ctx, input.id, "declined", input.declineReason)
	}

	async computeMeetingSessionFeeTotal(appointmentId: string): Promise<number> {
		const rows = await db
			.select({ feePhp: appointmentDocuments.feePhp })
			.from(appointmentDocuments)
			.innerJoin(fileObjects, eq(fileObjects.id, appointmentDocuments.fileObjectId))
			.where(
				and(
					eq(appointmentDocuments.appointmentId, appointmentId),
					eq(fileObjects.purpose, "appointment_attachment"),
					isNull(fileObjects.deletedAt)
				)
			)

		let total = 0
		for (const r of rows) {
			if (typeof r.feePhp === "number" && r.feePhp > 0) total += Math.floor(r.feePhp)
		}
		return total
	}

	private async resolveMeetingPaymentFees(appointmentId: string): Promise<{
		notarialFeePhp: number
		breakdown: MeetingFeeBreakdown
	}> {
		const notarialFeePhp = await this.computeMeetingSessionFeeTotal(appointmentId)
		const breakdown = computeMeetingPaymentBreakdown(notarialFeePhp)
		return { notarialFeePhp, breakdown }
	}

	private async findSucceededMeetingPaymentIntent(appointmentId: string) {
		const [row] = await db
			.select()
			.from(paymentIntents)
			.where(
				and(
					eq(paymentIntents.appointmentId, appointmentId),
					eq(paymentIntents.purpose, "meeting_session"),
					eq(paymentIntents.status, "succeeded")
				)
			)
			.orderBy(desc(paymentIntents.paidAt))
			.limit(1)
		return row ?? null
	}

	private async findActiveMeetingPaymentIntent(appointmentId: string) {
		const [row] = await db
			.select()
			.from(paymentIntents)
			.where(
				and(
					eq(paymentIntents.appointmentId, appointmentId),
					eq(paymentIntents.purpose, "meeting_session"),
					inArray(paymentIntents.status, ["pending", "processing"])
				)
			)
			.orderBy(desc(paymentIntents.createdAt))
			.limit(1)
		return row ?? null
	}

	private meetingPaymentMetadata(row: typeof paymentIntents.$inferSelect): {
		qrCode: string | null
		checkoutUrl: string | null
		paymentBrandLabel: string | null
	} {
		const meta = row.metadata
		if (!meta || typeof meta !== "object")
			return { qrCode: null, checkoutUrl: null, paymentBrandLabel: null }
		const m = meta as Record<string, unknown>
		const qrCode = typeof m.qrCode === "string" ? m.qrCode : null
		const checkoutUrl = typeof m.checkoutUrl === "string" ? m.checkoutUrl : null
		const paymentBrandLabel = typeof m.paymentBrandLabel === "string" ? m.paymentBrandLabel : null
		return { qrCode, checkoutUrl, paymentBrandLabel }
	}

	private intentPaymentProvider(
		intent: typeof paymentIntents.$inferSelect | null
	): MeetingPaymentProviderName {
		if (intent?.provider === "hitpay" || intent?.provider === "tlpe") {
			return intent.provider
		}
		return getMeetingPaymentProvider()
	}

	private shapeMeetingPaymentStatus(
		appointmentId: string,
		breakdown: MeetingFeeBreakdown,
		intent: typeof paymentIntents.$inferSelect | null
	): MeetingPaymentStatus {
		const totalFeePhp = breakdown.totalPhp
		const required = breakdown.notarialFeePhp > 0
		const paid = !required || intent?.status === "succeeded"
		const meta = intent
			? this.meetingPaymentMetadata(intent)
			: { qrCode: null, checkoutUrl: null, paymentBrandLabel: null }
		const intentAmountPhp =
			intent && typeof intent.amount === "number" ? Math.floor(intent.amount) : null
		const qrStaleFinal =
			!paid &&
			intent !== null &&
			intentAmountPhp !== null &&
			intentAmountPhp !== totalFeePhp &&
			(intent.status === "pending" || intent.status === "processing")
		const paymentProvider = this.intentPaymentProvider(intent)

		return {
			appointmentId,
			required,
			totalFeePhp,
			breakdown,
			paid,
			paymentIntentId: intent?.id ?? null,
			status: intent?.status ?? null,
			qrCode: paid || qrStaleFinal ? null : meta.qrCode,
			checkoutUrl: paid || qrStaleFinal ? null : meta.checkoutUrl,
			qrStale: qrStaleFinal,
			paymentProvider,
			sandboxTestMode: paymentProvider === "hitpay" ? hitpayDevSandboxTestEnabled() : undefined,
			tlpeTestMode: paymentProvider === "tlpe" ? this.tlpe.isDevSimulateEnabled() : undefined,
			selectedPaymentBrand: meta.paymentBrandLabel,
		}
	}

	private emitMeetingPaymentUpdated(
		appointmentId: string,
		clientUserId: string,
		enpUserId: string
	) {
		const payloadEvent = { appointmentId, status: "succeeded" as const }
		this.events.emitToUser(clientUserId, "appointments:payment-updated", payloadEvent)
		if (enpUserId !== clientUserId) {
			this.events.emitToUser(enpUserId, "appointments:payment-updated", payloadEvent)
		}
	}

	private emitMeetingPaymentRefresh(
		appointmentId: string,
		clientUserId: string,
		enpUserId: string
	) {
		const payloadEvent = { appointmentId, status: "refresh" as const }
		this.events.emitToUser(clientUserId, "appointments:payment-updated", payloadEvent)
		if (enpUserId !== clientUserId) {
			this.events.emitToUser(enpUserId, "appointments:payment-updated", payloadEvent)
		}
	}

	private async markMeetingPaymentIntentSucceeded(
		intent: typeof paymentIntents.$inferSelect,
		clientUserId: string,
		enpUserId: string,
		hitpayId?: string
	): Promise<typeof paymentIntents.$inferSelect> {
		if (intent.status === "succeeded") return intent

		const appointmentId = intent.appointmentId
		if (!appointmentId) return intent

		const now = new Date()
		const [updated] = await db
			.update(paymentIntents)
			.set({
				status: "succeeded",
				paidAt: now,
				updatedAt: now,
				...(hitpayId && !intent.externalId ? { externalId: hitpayId } : {}),
			})
			.where(eq(paymentIntents.id, intent.id))
			.returning()

		const finalRow = updated ?? intent
		this.emitMeetingPaymentUpdated(appointmentId, clientUserId, enpUserId)
		return finalRow
	}

	/**
	 * Poll remote provider when webhooks may not reach localhost.
	 */
	private async trySyncMeetingPaymentFromRemote(
		intent: typeof paymentIntents.$inferSelect,
		apt: { clientUserId: string; enpUserId: string }
	): Promise<typeof paymentIntents.$inferSelect | null> {
		if (intent.purpose !== "meeting_session") return null
		if (intent.status !== "pending" && intent.status !== "processing") return null

		if (intent.provider === "tlpe") {
			return this.trySyncMeetingPaymentFromTlpe(intent, apt)
		}
		if (intent.provider === "hitpay") {
			return this.trySyncMeetingPaymentFromHitpay(intent, apt)
		}
		return null
	}

	private async trySyncMeetingPaymentFromHitpay(
		intent: typeof paymentIntents.$inferSelect,
		apt: { clientUserId: string; enpUserId: string }
	): Promise<typeof paymentIntents.$inferSelect | null> {
		if (!this.hitpay.isConfigured()) return null

		const externalId = intent.externalId?.trim()
		if (!externalId) return null

		try {
			const remote = await this.hitpay.getPaymentRequest(externalId)
			if (!isHitpayPaymentRequestCompleted(remote.status)) return null

			if (remote.referenceNumber && remote.referenceNumber !== intent.id) {
				this.log.warn(
					`HitPay sync reference mismatch for intent ${intent.id}: expected ${intent.id}, got ${remote.referenceNumber}`
				)
				return null
			}
			if (Math.floor(intent.amount) !== remote.amountPhp) {
				this.log.warn(
					`HitPay sync amount mismatch for intent ${intent.id}: expected ${intent.amount}, got ${remote.amountPhp}`
				)
				return null
			}

			return await this.markMeetingPaymentIntentSucceeded(
				intent,
				apt.clientUserId,
				apt.enpUserId,
				remote.id
			)
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.warn(`HitPay payment sync failed for intent ${intent.id}: ${msg}`)
			return null
		}
	}

	private async trySyncMeetingPaymentFromTlpe(
		intent: typeof paymentIntents.$inferSelect,
		apt: { clientUserId: string; enpUserId: string }
	): Promise<typeof paymentIntents.$inferSelect | null> {
		if (!this.tlpe.isConfigured()) return null

		const candidates = [intent.externalId?.trim(), intent.id.trim()].filter((id): id is string =>
			Boolean(id)
		)
		if (!candidates.length) return null

		for (const transactionId of [...new Set(candidates)]) {
			try {
				const remote = await this.tlpe.syncPayment(transactionId)
				if (!remote.paid) continue

				return await this.markMeetingPaymentIntentSucceeded(
					intent,
					apt.clientUserId,
					apt.enpUserId,
					remote.transactionId
				)
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e)
				this.log.warn(`TLPE payment sync failed for intent ${intent.id} (${transactionId}): ${msg}`)
			}
		}
		return null
	}

	/** Cancel in-flight HitPay requests when session document fees change. */
	private async invalidateMeetingPaymentAfterFeeChange(
		appointmentId: string,
		clientUserId: string,
		enpUserId: string
	): Promise<void> {
		const active = await this.findActiveMeetingPaymentIntent(appointmentId)
		if (!active) return

		const { breakdown } = await this.resolveMeetingPaymentFees(appointmentId)
		if (Math.floor(active.amount) === breakdown.totalPhp) return

		const now = new Date()
		await db
			.update(paymentIntents)
			.set({ status: "cancelled", updatedAt: now })
			.where(
				and(
					eq(paymentIntents.appointmentId, appointmentId),
					eq(paymentIntents.purpose, "meeting_session"),
					inArray(paymentIntents.status, ["pending", "processing"])
				)
			)

		this.emitMeetingPaymentRefresh(appointmentId, clientUserId, enpUserId)
	}

	async getMeetingPaymentStatus(
		ctx: QlegalSessionContext | null,
		appointmentId: string
	): Promise<MeetingPaymentStatus> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })
		await assertMeetingParticipantAccess(ctx, row)

		const { breakdown } = await this.resolveMeetingPaymentFees(appointmentId)
		const succeeded = await this.findSucceededMeetingPaymentIntent(appointmentId)
		if (succeeded) {
			return this.shapeMeetingPaymentStatus(appointmentId, breakdown, succeeded)
		}
		const active = await this.findActiveMeetingPaymentIntent(appointmentId)
		if (active) {
			const synced = await this.trySyncMeetingPaymentFromRemote(active, {
				clientUserId: row.clientUserId,
				enpUserId: row.enpUserId,
			})
			const intent = synced ?? active
			return this.shapeMeetingPaymentStatus(appointmentId, breakdown, intent)
		}
		return this.shapeMeetingPaymentStatus(appointmentId, breakdown, null)
	}

	async listMeetingPaymentBrands(
		ctx: QlegalSessionContext | null,
		appointmentId: string
	): Promise<MeetingPaymentBrands> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select({ clientUserId: appointments.clientUserId, status: appointments.status })
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })

		if (ctx.userId !== row.clientUserId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the client for this appointment can view payment brands",
			})
		}
		if (row.status !== "in_session") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Payment brands are only available while the meeting is in session",
			})
		}

		const provider = getMeetingPaymentProvider()
		if (provider !== "tlpe" || !this.tlpe.isConfigured()) {
			throw new ORPCError("SERVICE_UNAVAILABLE", {
				message: "AltPayNet TLPE is not configured on this server",
			})
		}

		try {
			return await this.tlpe.listPaymentBrands()
		} catch (e) {
			const message = e instanceof Error ? e.message : "Could not load TLPE payment brands"
			throw new ORPCError("BAD_GATEWAY", { message })
		}
	}

	async createMeetingPayment(
		ctx: QlegalSessionContext | null,
		appointmentId: string,
		paymentOptionCode?: string
	): Promise<CreateMeetingPaymentResult> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })

		if (ctx.userId !== row.clientUserId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the client for this appointment can pay session fees",
			})
		}
		if (row.status !== "in_session") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Payment is only available while the meeting is in session",
			})
		}

		const { notarialFeePhp, breakdown } = await this.resolveMeetingPaymentFees(appointmentId)
		if (notarialFeePhp <= 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "No session fees are set on uploaded documents",
			})
		}

		const existingPaid = await this.findSucceededMeetingPaymentIntent(appointmentId)
		if (existingPaid) {
			const shaped = this.shapeMeetingPaymentStatus(appointmentId, breakdown, existingPaid)
			return { ...shaped, paymentIntentId: existingPaid.id, status: existingPaid.status }
		}

		const provider = getMeetingPaymentProvider()
		if (!isMeetingPaymentProviderConfigured(provider)) {
			throw new ORPCError("SERVICE_UNAVAILABLE", {
				message: `${meetingPaymentProviderLabel(provider)} is not configured on this server`,
			})
		}

		const now = new Date()
		await db
			.update(paymentIntents)
			.set({ status: "cancelled", updatedAt: now })
			.where(
				and(
					eq(paymentIntents.appointmentId, appointmentId),
					eq(paymentIntents.purpose, "meeting_session"),
					inArray(paymentIntents.status, ["pending", "processing"])
				)
			)

		const [clientUser] = await db
			.select({ email: users.email, name: users.name })
			.from(users)
			.where(eq(users.id, row.clientUserId))
			.limit(1)

		const [intent] = await db
			.insert(paymentIntents)
			.values({
				userId: row.clientUserId,
				appointmentId,
				amount: breakdown.totalPhp,
				currency: "PHP",
				status: "pending",
				description: `Meeting session fees · ${row.title}`,
				purpose: "meeting_session",
				provider,
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		if (!intent) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not create payment intent" })
		}

		try {
			if (provider === "tlpe") {
				const explicitPreference = paymentOptionCode?.trim()
				const resolvedOption = explicitPreference
					? await resolveTlpePaymentOption(explicitPreference)
					: await resolveTlpePaymentOption()

				if (explicitPreference && isTlpeBrandUnavailableOnTestApi(explicitPreference)) {
					throw new ORPCError("BAD_REQUEST", {
						message: tlpeBrandUnavailableMessage(explicitPreference),
					})
				}

				if (explicitPreference && !resolvedOption) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Payment brand "${explicitPreference}" is not available from AltPayNet`,
					})
				}

				const tlpeResult = await this.tlpe.createEasyPaymentLink({
					amountPhp: breakdown.totalPhp,
					transactionId: intent.id,
					description: `Meeting fees · ${row.title}`,
					customer: {
						email: clientUser?.email,
						name: clientUser?.name,
					},
					convenienceFixedFeePhp: breakdown.processingFeePhp,
					// Pass brand label — TLPE option JWTs expire between GET /options calls.
					paymentOptionCode: resolvedOption?.value ?? explicitPreference,
				})

				const tlpeExternalId =
					"tlpeTransactionId" in tlpeResult && typeof tlpeResult.tlpeTransactionId === "string"
						? tlpeResult.tlpeTransactionId
						: tlpeResult.transactionId

				const [updated] = await db
					.update(paymentIntents)
					.set({
						externalId: tlpeExternalId,
						status: "processing",
						metadata: {
							feeBreakdown: breakdown,
							checkoutUrl: tlpeResult.link,
							merchantReferenceId: intent.id,
							paymentOptionCode: resolvedOption?.code ?? null,
							paymentBrandLabel: resolvedOption?.value ?? null,
						},
						updatedAt: new Date(),
					})
					.where(eq(paymentIntents.id, intent.id))
					.returning()

				const finalRow = updated ?? intent
				const shaped = this.shapeMeetingPaymentStatus(appointmentId, breakdown, finalRow)
				return { ...shaped, paymentIntentId: finalRow.id, status: finalRow.status }
			}

			const hitpayResult = await this.hitpay.createQrphPaymentRequest({
				amountPhp: breakdown.totalPhp,
				referenceNumber: intent.id,
				purpose: `Meeting fees · ${row.title}`,
				email: clientUser?.email ?? undefined,
				name: clientUser?.name ?? undefined,
			})

			const [updated] = await db
				.update(paymentIntents)
				.set({
					externalId: hitpayResult.id,
					status: "processing",
					metadata: {
						feeBreakdown: breakdown,
						qrCode: hitpayResult.qrCode,
						checkoutUrl: hitpayResult.checkoutUrl ?? hitpayResult.url,
						hitpayStatus: hitpayResult.status,
					},
					updatedAt: new Date(),
				})
				.where(eq(paymentIntents.id, intent.id))
				.returning()

			const finalRow = updated ?? intent
			const shaped = this.shapeMeetingPaymentStatus(appointmentId, breakdown, finalRow)
			return { ...shaped, paymentIntentId: finalRow.id, status: finalRow.status }
		} catch (e) {
			await db
				.update(paymentIntents)
				.set({ status: "failed", updatedAt: new Date() })
				.where(eq(paymentIntents.id, intent.id))
			if (e instanceof ORPCError) throw e
			const msg = e instanceof Error ? e.message : String(e)
			if (msg.includes("is not available on the AltPayNet TLPE test API")) {
				throw new ORPCError("BAD_REQUEST", { message: msg })
			}
			throw new ORPCError("BAD_GATEWAY", {
				message: `${meetingPaymentProviderLabel(provider)} payment request failed: ${msg}`,
			})
		}
	}

	/**
	 * HitPay sandbox does not complete QRPH on hosted checkout ("Unknown error" on Pay).
	 * Use this in local dev to unblock meeting end/leave gates after creating a payment intent.
	 */
	async simulateMeetingPayment(
		ctx: QlegalSessionContext | null,
		appointmentId: string
	): Promise<MeetingPaymentStatus> {
		const provider = getMeetingPaymentProvider()
		if (!isMeetingPaymentDevSimulateAllowed(provider)) {
			throw new ORPCError("FORBIDDEN", {
				message:
					provider === "hitpay"
						? "Meeting payment simulation is only available in development with HitPay sandbox"
						: "Meeting payment simulation is only available in development with TLPE test API",
			})
		}
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })
		if (ctx.userId !== row.clientUserId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the client for this appointment can simulate session payment",
			})
		}
		if (row.status !== "in_session") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Payment simulation is only available while the meeting is in session",
			})
		}

		const { notarialFeePhp, breakdown } = await this.resolveMeetingPaymentFees(appointmentId)
		if (notarialFeePhp <= 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "No session fees are set on uploaded documents",
			})
		}

		const succeeded = await this.findSucceededMeetingPaymentIntent(appointmentId)
		if (succeeded) {
			return this.shapeMeetingPaymentStatus(appointmentId, breakdown, succeeded)
		}

		const now = new Date()
		const active = await this.findActiveMeetingPaymentIntent(appointmentId)
		let finalIntent = active

		if (active) {
			const [updated] = await db
				.update(paymentIntents)
				.set({
					status: "succeeded",
					paidAt: now,
					updatedAt: now,
					metadata: {
						...(typeof active.metadata === "object" && active.metadata
							? (active.metadata as Record<string, unknown>)
							: {}),
						feeBreakdown: breakdown,
						simulatedSandbox: true,
					},
				})
				.where(eq(paymentIntents.id, active.id))
				.returning()
			finalIntent = updated ?? active
		} else {
			const [inserted] = await db
				.insert(paymentIntents)
				.values({
					userId: row.clientUserId,
					appointmentId,
					amount: breakdown.totalPhp,
					currency: "PHP",
					status: "succeeded",
					paidAt: now,
					description: `Meeting session fees · ${row.title} (sandbox simulated)`,
					purpose: "meeting_session",
					provider,
					metadata: { feeBreakdown: breakdown, simulatedSandbox: true },
					createdAt: now,
					updatedAt: now,
				})
				.returning()
			finalIntent = inserted ?? null
		}

		if (!finalIntent) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Could not record simulated payment",
			})
		}

		this.emitMeetingPaymentUpdated(appointmentId, row.clientUserId, row.enpUserId)
		return this.shapeMeetingPaymentStatus(appointmentId, breakdown, finalIntent)
	}

	async assertMeetingPaymentCompleteForEnd(appointmentId: string): Promise<void> {
		const { notarialFeePhp } = await this.resolveMeetingPaymentFees(appointmentId)
		if (notarialFeePhp <= 0) return

		const succeeded = await this.findSucceededMeetingPaymentIntent(appointmentId)
		if (!succeeded) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"Client must complete QRPH payment for session document fees before ending the meeting",
			})
		}
	}

	/** Blocks new meeting document uploads after the client has paid session fees. */
	async assertMeetingDocumentUploadAllowed(appointmentId: string): Promise<void> {
		const { notarialFeePhp } = await this.resolveMeetingPaymentFees(appointmentId)
		if (notarialFeePhp <= 0) return

		const succeeded = await this.findSucceededMeetingPaymentIntent(appointmentId)
		if (succeeded) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Session payment is complete. No further documents can be uploaded for this meeting.",
			})
		}
	}

	async updateStatus(
		ctx: QlegalSessionContext | null,
		id: string,
		status: Appointment["status"],
		declineReason?: string
	): Promise<Appointment> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1)
		if (!row) throw new ORPCError("NOT_FOUND", { message: `Appointment ${id} not found` })

		this.assertAppointmentAccess(ctx, row)
		const isAssignedEnp = ctx.userId === row.enpUserId
		const isAssignedClient = ctx.userId === row.clientUserId

		if (status === "confirmed") {
			if (row.status === "quote_sent") {
				if (!isAssignedClient) {
					throw new ORPCError("FORBIDDEN", {
						message: "Only the client can accept a booking quote",
					})
				}
			} else if (row.status === "pending") {
				if (!isAssignedEnp) {
					throw new ORPCError("FORBIDDEN", {
						message: "Only the assigned ENP can confirm this appointment",
					})
				}
				const hasBookingDocs = await this.hasBookingAttachments(id)
				if (hasBookingDocs) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"Send a per-document quote first; the client must accept before this appointment can be confirmed",
					})
				}
				const enpKyc = await assertProfileKycVerified(ctx.userId, "enp")
				if (!enpKyc.ok) throw new ORPCError("FORBIDDEN", { message: enpKyc.detail })
				const enpGovId = await assertGovernmentIdAllowsNotarialActs(ctx.userId)
				if (!enpGovId.ok) throw new ORPCError("FORBIDDEN", { message: enpGovId.detail })
				const enpCommission = await assertEnpCommissionAllowsNotarialActs(ctx.userId)
				if (!enpCommission.ok) throw new ORPCError("FORBIDDEN", { message: enpCommission.detail })
			} else {
				throw new ORPCError("BAD_REQUEST", {
					message: "Only pending or quote-sent appointments can be confirmed",
				})
			}
		} else if (status === "declined") {
			if (row.status === "quote_sent") {
				if (!isAssignedClient) {
					throw new ORPCError("FORBIDDEN", {
						message: "Only the client can decline a booking quote",
					})
				}
			} else if (row.status === "pending") {
				if (!isAssignedEnp) {
					throw new ORPCError("FORBIDDEN", {
						message: "Only the assigned ENP can decline this appointment",
					})
				}
				const enpKyc = await assertProfileKycVerified(ctx.userId, "enp")
				if (!enpKyc.ok) throw new ORPCError("FORBIDDEN", { message: enpKyc.detail })
				const enpGovId = await assertGovernmentIdAllowsNotarialActs(ctx.userId)
				if (!enpGovId.ok) throw new ORPCError("FORBIDDEN", { message: enpGovId.detail })
				const enpCommission = await assertEnpCommissionAllowsNotarialActs(ctx.userId)
				if (!enpCommission.ok) throw new ORPCError("FORBIDDEN", { message: enpCommission.detail })
			} else {
				throw new ORPCError("BAD_REQUEST", {
					message: "Only pending or quote-sent appointments can be declined",
				})
			}
			if (!declineReason?.trim()) {
				throw new ORPCError("BAD_REQUEST", { message: "declineReason is required when declining" })
			}
		} else if (status === "cancelled") {
			if (!isAssignedClient) {
				throw new ORPCError("FORBIDDEN", {
					message: "Only the client can cancel their appointment",
				})
			}
			if (row.status !== "pending" && row.status !== "quote_sent") {
				throw new ORPCError("BAD_REQUEST", {
					message: "Only pending or quote-sent appointments can be cancelled",
				})
			}
		} else if (status === "in_session") {
			// Legacy-only compatibility: active commission hearings now use CommissionHearingsService.
			const isLegacyCommissionHearingAppointment = row.kind === "commission_hearing"
			const isParticipant = isAssignedEnp || isAssignedClient
			if (!isParticipant) {
				throw new ORPCError("FORBIDDEN", {
					message: "Only the assigned ENP or client can join this session",
				})
			}
			if (row.status === "in_session") {
				// Idempotent rejoin: either party can reach an already-open room.
				await this.sessions.ensureRoomForAppointment(id)
				return (await this.shapeMany([row]))[0]!
			}
			if (row.status !== "confirmed") {
				throw new ORPCError("BAD_REQUEST", {
					message: "Only confirmed appointments can move to in session",
				})
			}
			if (isLegacyCommissionHearingAppointment) {
				if (!isAssignedClient) {
					throw new ORPCError("FORBIDDEN", {
						message: "Only the Electronic Notary Administrator can start this hearing",
					})
				}
			} else {
				// Only the assigned ENP may transition confirmed → in_session.
				// Clients can join only once the notary has opened the session.
				if (!isAssignedEnp) {
					throw new ORPCError("FORBIDDEN", {
						message: "Only the notary can start this meeting",
					})
				}
				const enpKyc = await assertProfileKycVerified(ctx.userId, "enp")
				if (!enpKyc.ok) throw new ORPCError("FORBIDDEN", { message: enpKyc.detail })
				const enpGovId = await assertGovernmentIdAllowsNotarialActs(ctx.userId)
				if (!enpGovId.ok) throw new ORPCError("FORBIDDEN", { message: enpGovId.detail })
				const enpCommission = await assertEnpCommissionAllowsNotarialActs(ctx.userId)
				if (!enpCommission.ok) throw new ORPCError("FORBIDDEN", { message: enpCommission.detail })
			}
		} else if (status === "ended") {
			// Legacy-only compatibility: active commission hearings now use CommissionHearingsService.
			const isLegacyCommissionHearingAppointment = row.kind === "commission_hearing"
			const canEnd = isAssignedEnp || (isLegacyCommissionHearingAppointment && isAssignedClient)
			if (!canEnd) {
				throw new ORPCError("FORBIDDEN", {
					message: isLegacyCommissionHearingAppointment
						? "Only the ENA or applicant can end this hearing"
						: "Only the assigned ENP can end the session",
				})
			}
			if (row.status !== "in_session") {
				throw new ORPCError("BAD_REQUEST", {
					message: "Only an in-session appointment can be ended",
				})
			}
			if (!isLegacyCommissionHearingAppointment) {
				await this.assertMeetingPaymentCompleteForEnd(id)
				if (row.enbSigningStatus !== "completed") {
					throw new ORPCError("BAD_REQUEST", {
						message:
							row.enbSigningStatus === "active"
								? "All principals must sign the ENB before you can end the session"
								: "Complete notarization and collect ENB signatures before ending the session",
					})
				}
			}
		} else {
			throw new ORPCError("BAD_REQUEST", {
				message: "Unsupported status transition via this endpoint",
			})
		}

		const now = new Date()
		const lead = env.APPOINTMENT_SESSION_LEAD_MINUTES

		let nextCanStart = false
		let nextCanRejoin = false
		if (status === "confirmed") {
			nextCanStart = computeCanStart({
				status: "confirmed",
				scheduledAt: row.scheduledAt,
				durationMinutes: row.durationMinutes,
				now,
				leadMinutes: lead,
			})
		} else if (status === "in_session") {
			nextCanRejoin = true
		}

		const [updated] = await db
			.update(appointments)
			.set({
				status,
				declineReason: status === "declined" ? (declineReason ?? null) : null,
				confirmedAt: status === "confirmed" ? now : row.confirmedAt,
				canStart: nextCanStart,
				canRejoin: nextCanRejoin,
				updatedAt: now,
			})
			.where(eq(appointments.id, id))
			.returning()

		if (!updated) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Update failed" })

		if (status === "in_session") {
			await this.sessions.ensureRoomForAppointment(id)
		}
		if (status === "ended") {
			await this.sessions.endRoomForAppointment(id)
			// Legacy commission-hearing appointment rows never create notarized documents or ENB acts.
			if (row.kind !== "commission_hearing") {
				await this.markQuicksignProjectsCompletedWhenMeetingEnds(id, row.enpUserId)
				this.populateNotarialRegistryOnMeetingEnd(id, row.enpUserId, now)
			}
		}

		const shaped = (await this.shapeMany([updated]))[0]!

		if (
			status === "confirmed" ||
			status === "declined" ||
			status === "in_session" ||
			status === "ended"
		) {
			const payload = { appointmentId: id, status }
			this.events.emitToUser(row.clientUserId, "appointments:updated", payload)
			if (row.enpUserId !== row.clientUserId) {
				this.events.emitToUser(row.enpUserId, "appointments:updated", payload)
			}
		}

		if (status === "confirmed" || status === "declined") {
			const [clientUser] = await db
				.select({ email: users.email })
				.from(users)
				.where(eq(users.id, row.clientUserId))
				.limit(1)
			if (clientUser?.email) {
				const template = status === "confirmed" ? "appointment_confirmed" : "appointment_declined"
				await this.email.sendTransactional(clientUser.email, template, {
					appointmentTitle: row.title,
					scheduledAt: row.scheduledAt.toISOString(),
					enpName: shaped.enpName,
					declineReason: status === "declined" ? (declineReason ?? "") : "",
				})
			}
		}

		return shaped
	}

	private async assertAppointmentParticipantAccess(
		ctx: QlegalSessionContext,
		row: typeof appointments.$inferSelect
	) {
		if (ctx.userId === row.enpUserId || ctx.userId === row.clientUserId) return
		if (await isSessionRoomGuestForAppointment(row.id, ctx.userId)) return
		throw new ORPCError("FORBIDDEN", { message: "You cannot access this appointment" })
	}

	private assertAppointmentAccess(
		ctx: QlegalSessionContext,
		row: typeof appointments.$inferSelect
	) {
		// Authorize by ownership first; role hydration can be temporarily stale ("none")
		// when session context is reconstructed in edge onboarding/auth flows.
		const ok = ctx.userId === row.enpUserId || ctx.userId === row.clientUserId
		if (!ok) {
			throw new ORPCError("FORBIDDEN", { message: "You cannot access this appointment" })
		}
	}

	private async assertValidBookingInvite(enpUserId: string, plaintext: string) {
		const hash = sha256Hex(plaintext)
		const [row] = await db
			.select({
				hash: enpProfiles.bookingInviteTokenHash,
				expiresAt: enpProfiles.bookingInviteExpiresAt,
			})
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, enpUserId))
			.limit(1)

		const stored = row?.hash
		const exp = row?.expiresAt
		if (!stored || !exp || exp.getTime() < Date.now()) {
			throw new ORPCError("BAD_REQUEST", {
				message: "This ENP does not have an active booking invite",
			})
		}
		const a = Buffer.from(stored, "hex")
		const b = Buffer.from(hash, "hex")
		if (a.length !== b.length || !timingSafeEqual(a, b)) {
			throw new ORPCError("BAD_REQUEST", { message: "Invalid booking invite token" })
		}
	}

	/**
	 * Create a local project record. `appointment_id` is left null so multiple meeting
	 * instruments per appointment are allowed (unique is per appointment on that column).
	 */
	private async ensureProjectForMeetingDocument(args: {
		enpUserId: string
		ctx: QlegalSessionContext
		sessionMode: "remote" | "in_person" | "hybrid"
		fileObjectId: string
		documentName: string
		documentType: string
		feePhp?: number
	}): Promise<void> {
		const [existingQs] = await db
			.select({
				id: quicksignProjects.id,
				doconchainProjectUuid: quicksignProjects.doconchainProjectUuid,
			})
			.from(quicksignProjects)
			.where(
				and(
					eq(quicksignProjects.enpUserId, args.enpUserId),
					eq(quicksignProjects.documentFileObjectId, args.fileObjectId)
				)
			)
			.limit(1)

		if (existingQs?.doconchainProjectUuid?.trim()) {
			return
		}

		const uuid = randomUUID()
		const now = new Date()
		const qsDescription = meetingQuickSignDescription(args.documentType, args.feePhp)
		if (existingQs) {
			await db
				.update(quicksignProjects)
				.set({
					doconchainProjectUuid: uuid,
					title: args.documentName,
					description: qsDescription,
					status: "pending_signatures",
					updatedAt: now,
				})
				.where(eq(quicksignProjects.id, existingQs.id))
			return
		}

		await db.insert(quicksignProjects).values({
			enpUserId: args.enpUserId,
			documentFileObjectId: args.fileObjectId,
			title: args.documentName,
			description: qsDescription,
			status: "pending_signatures",
			doconchainProjectUuid: uuid,
			appointmentId: null,
			expiresAt: new Date(now.getTime() + 14 * 86400000),
			createdAt: now,
			updatedAt: now,
		})
	}

	private async assertEnpInSessionForMeetingDocument(
		ctx: QlegalSessionContext,
		appointmentId: string
	): Promise<typeof appointments.$inferSelect> {
		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })
		if (row.enpUserId !== ctx.userId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the ENP for this appointment may manage session documents",
			})
		}
		if (row.status !== "in_session") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Documents can only be changed while the meeting is in session",
			})
		}
		return row
	}

	private async assertEnpMeetingDocumentFile(enpUserId: string, fileId: string) {
		const [file] = await db
			.select({ id: fileObjects.id })
			.from(fileObjects)
			.where(
				and(
					eq(fileObjects.id, fileId),
					eq(fileObjects.ownerUserId, enpUserId),
					eq(fileObjects.purpose, "appointment_attachment"),
					isNull(fileObjects.deletedAt)
				)
			)
			.limit(1)
		if (!file) {
			throw new ORPCError("BAD_REQUEST", {
				message: "File is missing, not owned by you, or not marked as an appointment attachment",
			})
		}
	}

	private async hasBookingAttachments(appointmentId: string): Promise<boolean> {
		const [row] = await db
			.select({ total: count() })
			.from(appointmentDocuments)
			.innerJoin(fileObjects, eq(fileObjects.id, appointmentDocuments.fileObjectId))
			.where(
				and(
					eq(appointmentDocuments.appointmentId, appointmentId),
					eq(fileObjects.purpose, "appointment_attachment"),
					isNull(fileObjects.deletedAt)
				)
			)
		return Number(row?.total ?? 0) > 0
	}

	private async assertAppointmentFiles(clientUserId: string, fileIds: string[]) {
		const rows = await db
			.select({ id: fileObjects.id })
			.from(fileObjects)
			.where(
				and(
					inArray(fileObjects.id, fileIds),
					eq(fileObjects.ownerUserId, clientUserId),
					eq(fileObjects.purpose, "appointment_attachment"),
					isNull(fileObjects.deletedAt)
				)
			)
		if (rows.length !== fileIds.length) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"One or more files are missing, not owned by you, or not marked as appointment attachments",
			})
		}
	}

	private async shapeMany(rows: (typeof appointments.$inferSelect)[]): Promise<Appointment[]> {
		if (!rows.length) return []

		const userIds = [...new Set(rows.flatMap(r => [r.clientUserId, r.enpUserId]))]
		const names = await this.loadDisplayNames(userIds)

		const ids = rows.map(r => r.id)
		const counts =
			ids.length === 0
				? []
				: await db
						.select({
							appointmentId: appointmentDocuments.appointmentId,
							n: count(appointmentDocuments.fileObjectId),
						})
						.from(appointmentDocuments)
						.where(inArray(appointmentDocuments.appointmentId, ids))
						.groupBy(appointmentDocuments.appointmentId)

		const countMap = new Map(counts.map(c => [c.appointmentId, c.n]))

		const feeTotals =
			ids.length === 0
				? []
				: await db
						.select({
							appointmentId: appointmentDocuments.appointmentId,
							total: sql<number>`coalesce(sum(${appointmentDocuments.feePhp}), 0)`,
						})
						.from(appointmentDocuments)
						.where(inArray(appointmentDocuments.appointmentId, ids))
						.groupBy(appointmentDocuments.appointmentId)

		const feeTotalMap = new Map(
			feeTotals.map(row => [row.appointmentId, Math.max(0, Math.floor(Number(row.total) || 0))])
		)

		const lead = env.APPOINTMENT_SESSION_LEAD_MINUTES
		const now = new Date()

		return rows.map(row => {
			const clientName = names.get(row.clientUserId) ?? "Client"
			const enpName = names.get(row.enpUserId) ?? "ENP"
			const canStart = computeCanStart({
				status: row.status,
				scheduledAt: row.scheduledAt,
				durationMinutes: row.durationMinutes,
				now,
				leadMinutes: lead,
			})
			return {
				id: row.id,
				clientId: row.clientUserId,
				clientName,
				enpId: row.enpUserId,
				enpName,
				title: row.title,
				description: row.description,
				status: row.status,
				scheduledAt: row.scheduledAt.toISOString(),
				durationMinutes: row.durationMinutes,
				location: row.location,
				isVirtual: row.sessionMode === "remote",
				meetingUrl: row.meetingUrl,
				notes: row.notes,
				notarizationType: row.notarizationType,
				sessionMode: row.sessionMode,
				kind: row.kind,
				declineReason: row.declineReason,
				quoteSentAt: row.quoteSentAt?.toISOString() ?? null,
				quoteNotes: row.quoteNotes,
				quoteTotalPhp: row.quoteSentAt != null ? (feeTotalMap.get(row.id) ?? 0) : null,
				documentsCount: countMap.get(row.id) ?? 0,
				canStart,
				canRejoin: computeCanRejoin(row.status),
				enbSigningStatus: row.enbSigningStatus,
				enbSigningStartedAt: row.enbSigningStartedAt?.toISOString() ?? null,
				enbSigningCompletedAt: row.enbSigningCompletedAt?.toISOString() ?? null,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			}
		})
	}

	private async loadDisplayNames(userIds: string[]): Promise<Map<string, string>> {
		const map = new Map<string, string>()
		const [cRows, eRows, uRows] = await Promise.all([
			db
				.select({
					userId: clientProfiles.userId,
					firstName: clientProfiles.firstName,
					lastName: clientProfiles.lastName,
				})
				.from(clientProfiles)
				.where(inArray(clientProfiles.userId, userIds)),
			db
				.select({
					userId: enpProfiles.userId,
					prefix: enpProfiles.prefix,
					firstName: enpProfiles.firstName,
					lastName: enpProfiles.lastName,
					suffix: enpProfiles.suffix,
				})
				.from(enpProfiles)
				.where(inArray(enpProfiles.userId, userIds)),
			db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds)),
		])

		for (const c of cRows) {
			map.set(c.userId, `${c.firstName} ${c.lastName}`.trim())
		}
		for (const e of eRows) {
			map.set(e.userId, formatEnpName(e))
		}
		for (const u of uRows) {
			if (!map.has(u.id) && u.name) map.set(u.id, u.name)
		}
		for (const id of userIds) {
			if (!map.has(id)) map.set(id, "User")
		}
		return map
	}
}

function splitCityProvince(raw: string | null | undefined): [string, string] {
	if (!raw) return ["", ""]
	const parts = raw.split(",").map(s => s.trim())
	if (parts.length >= 2) return [parts[0]!, parts.slice(1).join(", ")]
	return [raw.trim(), ""]
}
