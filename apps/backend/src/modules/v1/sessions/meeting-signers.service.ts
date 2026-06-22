import { Injectable, Logger } from "@nestjs/common"
import { ORPCError } from "@orpc/server"
import { and, asc, eq, inArray } from "drizzle-orm"
import type { Response } from "express"
import { PDFDocument } from "pdf-lib"

import type {
	DocoChainPlotLinkResult,
	DocoChainSignLinkResult,
	InitiateMeetingSigningResult,
	ListMeetingDocumentSignerAssignmentsResult,
	ListMeetingDocumentSignersResult,
	MarkMeetingDocumentPlottedResult,
	MarkSignedForCurrentUserResult,
	MeetingSignerParticipant,
} from "@repo/contracts"
import type { SignatureField } from "@repo/db/schema"
import {
	appointmentDocuments,
	appointments,
	clientProfiles,
	enpProfiles,
	meetingSignatureRequests,
	quicksignProjects,
	quicksignSigners,
	sessionRoomGuests,
	sessionRooms,
	users,
} from "@repo/db/schema"

import { LocalSigningService } from "@/services/signing/local-signing.service"
import { LocalStorageService } from "@/services/storage/local-storage.service"
import { NotarizedPdfDeliveryService } from "@/services/email/notarized-pdf-delivery.service"
import { NotarizedPdfArchiveService } from "@/services/notarized-pdf/notarized-pdf-archive.service"
import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { assertMeetingNotarizedPdfViewAllowed } from "@/modules/v1/appointments/lib/meeting-payment-gates"
import { assertEnpCommissionAllowsNotarialActs } from "@/modules/v1/auth-profile/lib/assert-enp-commission-active"
import { assertGovernmentIdAllowsNotarialActs } from "@/modules/v1/auth-profile/lib/assert-government-id-allows-notarial-acts"
import { FilesService } from "@/modules/v1/files/files.service"
import { IenAttestationService } from "@/modules/v1/ien-attestation/ien-attestation.service"
import { RegistryService } from "@/modules/v1/registry/registry.service"

type MeetingSignerRole = "notary" | "principal" | "witness"

@Injectable()
export class MeetingSignersService {
	private readonly log = new Logger(MeetingSignersService.name)

	constructor(
		private readonly localStorage: LocalStorageService,
		private readonly localSigning: LocalSigningService,
		private readonly notarizedPdfDelivery: NotarizedPdfDeliveryService,
		private readonly notarizedArchive: NotarizedPdfArchiveService,
		private readonly files: FilesService,
		private readonly ienAttestation: IenAttestationService,
		private readonly registry: RegistryService
	) {}

	async listMeetingSignerParticipants(
		ctx: QlegalSessionContext | null,
		meetingId: string
	): Promise<MeetingSignerParticipant[]> {
		const apt = await this.loadAppointmentForMeeting(ctx, meetingId)
		this.assertAuthenticated(ctx)
		await this.assertCanParticipateInMeeting(ctx, apt)

		const [room] = await db
			.select({ id: sessionRooms.id })
			.from(sessionRooms)
			.where(eq(sessionRooms.appointmentId, apt.id))
			.limit(1)

		const guestIds = room?.id
			? (
					await db
						.select({ userId: sessionRoomGuests.userId })
						.from(sessionRoomGuests)
						.where(eq(sessionRoomGuests.sessionRoomId, room.id))
				).map(g => g.userId)
			: []

		const userIds = [...new Set([apt.enpUserId, apt.clientUserId, ...guestIds])]
		const emails = await this.loadEmails(userIds)
		const names = await this.loadDisplayNames(userIds)

		const out: MeetingSignerParticipant[] = []
		for (const userId of userIds) {
			const email = emails.get(userId)
			if (!email) continue
			let role: MeetingSignerParticipant["role"] = "guest_signer"
			if (userId === apt.enpUserId) role = "enp"
			else if (userId === apt.clientUserId) role = "client"
			out.push({
				userId,
				displayName: names.get(userId) ?? "Participant",
				email,
				role,
			})
		}
		return out
	}

	async listMeetingDocumentSignerAssignments(
		ctx: QlegalSessionContext | null,
		meetingId: string,
		documentId: string
	): Promise<ListMeetingDocumentSignerAssignmentsResult> {
		const apt = await this.loadAppointmentForMeeting(ctx, meetingId)
		this.assertAuthenticated(ctx)
		await this.assertCanParticipateInMeeting(ctx, apt)
		await this.assertDocumentOnAppointment(apt.id, documentId)

		const rows = await db
			.select({
				signerUserId: meetingSignatureRequests.signerUserId,
				signerRole: meetingSignatureRequests.signerRole,
				signingOrder: meetingSignatureRequests.signingOrder,
			})
			.from(meetingSignatureRequests)
			.where(
				and(
					eq(meetingSignatureRequests.appointmentId, apt.id),
					eq(meetingSignatureRequests.documentFileObjectId, documentId)
				)
			)
			.orderBy(asc(meetingSignatureRequests.signingOrder))

		return {
			signers: rows.map(r => ({
				userId: r.signerUserId,
				role: r.signerRole as MeetingSignerRole,
				signingOrder: r.signingOrder,
			})),
		}
	}

	async setMeetingDocumentSigners(
		ctx: QlegalSessionContext | null,
		meetingId: string,
		documentId: string,
		signers: { userId: string; role: MeetingSignerRole }[]
	): Promise<ListMeetingDocumentSignerAssignmentsResult> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const apt = await this.loadAppointmentForMeeting(ctx, meetingId)
		if (ctx.userId !== apt.enpUserId) {
			throw new ORPCError("FORBIDDEN", { message: "Only the ENP may assign signers" })
		}
		await this.assertEnpCommissionActiveForNotarialActs(apt.enpUserId)
		if (apt.status !== "in_session") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Signer assignment is only allowed during an active session",
			})
		}

		await this.assertDocumentOnAppointment(apt.id, documentId)
		const qs = await this.loadQuicksignProjectForDocument(apt.enpUserId, documentId)
		if (!qs) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Quicksign project is required before assigning signers",
			})
		}

		const participants = await this.listMeetingSignerParticipants(ctx, meetingId)
		const participantIds = new Set(participants.map(p => p.userId))
		for (const s of signers) {
			if (!participantIds.has(s.userId)) {
				throw new ORPCError("BAD_REQUEST", { message: "All signers must be meeting participants" })
			}
		}

		const nonEnp = signers.filter(s => s.userId !== apt.enpUserId)
		if (nonEnp.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "At least one signer besides the ENP (notary) is required",
			})
		}

		const userMeta = await this.loadSignerUserMeta(signers.map(s => s.userId))
		for (const s of signers) {
			if (!userMeta.has(s.userId)) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Each signer must have a profile with email before assignment",
				})
			}
		}

		await this.ensureDoconchainProjectForSignerAssignment({
			apt,
			documentId,
			qs,
			signers,
			userMeta,
		})

		const now = new Date()
		await db
			.delete(meetingSignatureRequests)
			.where(
				and(
					eq(meetingSignatureRequests.appointmentId, apt.id),
					eq(meetingSignatureRequests.documentFileObjectId, documentId)
				)
			)

		let order = 1
		for (const s of signers) {
			const role: MeetingSignerRole =
				s.userId === apt.enpUserId ? "notary" : s.role === "witness" ? "witness" : "principal"
			await db.insert(meetingSignatureRequests).values({
				appointmentId: apt.id,
				documentFileObjectId: documentId,
				signerUserId: s.userId,
				signerRole: role,
				signingOrder: order,
				status: "pending",
				createdAt: now,
				updatedAt: now,
			})
			order += 1
		}

		await db.delete(quicksignSigners).where(eq(quicksignSigners.projectId, qs.id))

		order = 1
		for (const s of signers) {
			const meta = userMeta.get(s.userId)
			if (!meta) continue
			await db.insert(quicksignSigners).values({
				projectId: qs.id,
				firstName: meta.firstName,
				lastName: meta.lastName,
				email: meta.email,
				sequenceOrder: order,
				createdAt: now,
				updatedAt: now,
			})
			order += 1
		}

		this.log.debug(
			`setMeetingDocumentSigners appointment=${apt.id} document=${documentId} count=${signers.length}`
		)

		return this.listMeetingDocumentSignerAssignments(ctx, meetingId, documentId)
	}

	async listMeetingDocumentSigners(
		ctx: QlegalSessionContext | null,
		meetingId: string,
		documentId: string
	): Promise<ListMeetingDocumentSignersResult> {
		const apt = await this.loadAppointmentForMeeting(ctx, meetingId)
		this.assertAuthenticated(ctx)
		await this.assertCanParticipateInMeeting(ctx, apt)
		await this.assertDocumentOnAppointment(apt.id, documentId)

		const rows = await db
			.select({
				signerUserId: meetingSignatureRequests.signerUserId,
				signerRole: meetingSignatureRequests.signerRole,
				signingOrder: meetingSignatureRequests.signingOrder,
				status: meetingSignatureRequests.status,
				signedAt: meetingSignatureRequests.signedAt,
			})
			.from(meetingSignatureRequests)
			.where(
				and(
					eq(meetingSignatureRequests.appointmentId, apt.id),
					eq(meetingSignatureRequests.documentFileObjectId, documentId)
				)
			)
			.orderBy(asc(meetingSignatureRequests.signingOrder))

		const userIds = rows.map(r => r.signerUserId)
		const emails = await this.loadEmails(userIds)
		const names = await this.loadDisplayNames(userIds)

		let [qs] = await db
			.select({
				id: quicksignProjects.id,
				doconchainProjectUuid: quicksignProjects.doconchainProjectUuid,
				plotCompletedAt: quicksignProjects.plotCompletedAt,
				status: quicksignProjects.status,
				notarizedFileObjectId: quicksignProjects.notarizedFileObjectId,
			})
			.from(quicksignProjects)
			.where(
				and(
					eq(quicksignProjects.enpUserId, apt.enpUserId),
					eq(quicksignProjects.documentFileObjectId, documentId)
				)
			)
			.limit(1)

		const qsSignerCount = qs
			? (
					await db
						.select({ id: quicksignSigners.id })
						.from(quicksignSigners)
						.where(eq(quicksignSigners.projectId, qs.id))
				).length
			: 0

		let currentAssigned = false
		const signers = rows.map(r => {
			const signed = r.status === "signed"
			let status: "signed" | "current" | "waiting" = "waiting"
			if (signed) status = "signed"
			else if (!currentAssigned) {
				const priorUnsigned = rows.some(
					p => p.signingOrder < r.signingOrder && p.status !== "signed"
				)
				if (!priorUnsigned) {
					status = "current"
					currentAssigned = true
				}
			}
			return {
				userId: r.signerUserId,
				email: emails.get(r.signerUserId) ?? "",
				displayName: names.get(r.signerUserId) ?? "Signer",
				sequence: r.signingOrder,
				role: r.signerRole as MeetingSignerRole,
				signedAt: r.signedAt ? r.signedAt.toISOString() : null,
				status,
			}
		})

		const signedCount = signers.filter(s => s.status === "signed").length
		const totalCount = signers.length
		const completed = totalCount > 0 && signedCount === totalCount

		// Do not resolve vault PDF URLs here — that blocks the meeting UI. View/Download use
		// GET …/notarized-pdf on demand; background job copies the sealed file into our storage.
		const notarizedDocumentUrl: string | null = null

		if (completed && qs?.id && qs.status !== "completed") {
			await this.checkAndFinalizeSignatures(apt.id, documentId, qs.id, qs)

			const [updated] = await db
				.select({
					id: quicksignProjects.id,
					doconchainProjectUuid: quicksignProjects.doconchainProjectUuid,
					plotCompletedAt: quicksignProjects.plotCompletedAt,
					status: quicksignProjects.status,
					notarizedFileObjectId: quicksignProjects.notarizedFileObjectId,
				})
				.from(quicksignProjects)
				.where(eq(quicksignProjects.id, qs.id))
				.limit(1)
			if (updated) qs = updated

			if (qs?.status === "completed") {
				this.notarizedPdfDelivery.scheduleDeliveryForQuicksignProject(qs.id)
				this.notarizedArchive.scheduleArchiveToS3(qs.id)
			}
		}

		const notarizationStatus = qs?.status ?? null
		const notarizedStoredInDb = Boolean(qs?.notarizedFileObjectId?.trim())
		const notarizedPdfReady = completed && notarizedStoredInDb

		return {
			signers,
			persistedSignerCount: qsSignerCount,
			signedCount,
			totalCount,
			completed,
			plotCompletedAt: qs?.plotCompletedAt?.toISOString() ?? null,
			projectId: qs?.id?.trim() ?? null,
			doconchainProjectUuid: qs?.doconchainProjectUuid?.trim() ?? null,
			notarizedDocumentUrl,
			notarizationStatus,
			notarizedStoredInDb,
			notarizedPdfReady,
		}
	}

	private async checkAndFinalizeSignatures(
		appointmentId: string,
		documentFileId: string,
		quicksignProjectId: string,
		qs: {
			id: string
			status: string | null
			notarizedFileObjectId: string | null
		}
	): Promise<boolean> {
		try {
			const reqRows = await db
				.select({
					id: meetingSignatureRequests.id,
					signerUserId: meetingSignatureRequests.signerUserId,
					status: meetingSignatureRequests.status,
					signedAt: meetingSignatureRequests.signedAt,
				})
				.from(meetingSignatureRequests)
				.where(
					and(
						eq(meetingSignatureRequests.appointmentId, appointmentId),
						eq(meetingSignatureRequests.documentFileObjectId, documentFileId)
					)
				)

			const allSigned = reqRows.length > 0 && reqRows.every(r => r.status === "signed")
			if (!allSigned) return false
			if (qs.status === "completed") return true

			const now = new Date()
			for (const row of reqRows) {
				const [user] = await db
					.select({ email: users.email })
					.from(users)
					.where(eq(users.id, row.signerUserId))
					.limit(1)
				const emailNorm = user?.email?.trim().toLowerCase()
				if (!emailNorm) continue

				const sig = await this.localStorage.readSignature(quicksignProjectId, emailNorm)
				if (!sig && row.status === "signed") continue
				if (sig) {
					await this.localSigning.stampSignature(quicksignProjectId, emailNorm, sig)
				}
			}

			await db
				.update(quicksignProjects)
				.set({ status: "completed", completedAt: now, updatedAt: now })
				.where(eq(quicksignProjects.id, quicksignProjectId))

			this.log.debug(
				`checkAndFinalizeSignatures completed project=${quicksignProjectId.slice(0, 8)}…`
			)
			return true
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.debug(`Meeting signature finalization skipped: ${msg.slice(0, 160)}`)
			return false
		}
	}

	async streamMeetingDocumentNotarizedPdf(
		ctx: QlegalSessionContext | null,
		meetingId: string,
		documentId: string,
		res: Response,
		opts?: { download?: boolean }
	): Promise<void> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const apt = await this.loadAppointmentForMeeting(ctx, meetingId)
		await this.assertCanParticipateInMeeting(ctx, apt)
		await this.assertDocumentOnAppointment(apt.id, documentId)
		await assertMeetingNotarizedPdfViewAllowed(apt.id, ctx.userId, apt.enpUserId, {
			documentFileObjectId: documentId,
			appointmentStatus: apt.status,
			clientUserId: apt.clientUserId,
		})

		const qs = await this.loadQuicksignProjectForDocument(apt.enpUserId, documentId)
		if (!qs) {
			throw new ORPCError("BAD_REQUEST", { message: "Quicksign project is required" })
		}

		const rows = await db
			.select({ status: meetingSignatureRequests.status })
			.from(meetingSignatureRequests)
			.where(
				and(
					eq(meetingSignatureRequests.appointmentId, apt.id),
					eq(meetingSignatureRequests.documentFileObjectId, documentId)
				)
			)

		if (!rows.length) {
			throw new ORPCError("BAD_REQUEST", { message: "No signers assigned for this document" })
		}

		const allSigned = rows.every(r => r.status === "signed")
		if (!allSigned) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Notarized PDF is available after all assigned signers have signed",
			})
		}

		await this.checkAndFinalizeSignatures(apt.id, documentId, qs.id, qs)

		if (qs.status !== "completed") {
			const now = new Date()
			await db
				.update(quicksignProjects)
				.set({ status: "completed", completedAt: now, updatedAt: now })
				.where(eq(quicksignProjects.id, qs.id))
		}

		if (!qs.notarizedPdfEmailedAt) {
			this.notarizedPdfDelivery.scheduleDeliveryForQuicksignProject(qs.id)
		}
		this.notarizedArchive.scheduleArchiveToS3(qs.id)

		try {
			await this.registry.syncActsFromEndedMeeting({
				appointmentId: apt.id,
				enpUserId: apt.enpUserId,
				meetingEndedAt: new Date(),
				onlyFileObjectId: documentId,
				allowDuringActiveSession: true,
				allowWhenMeetingSignaturesComplete: true,
			})
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.warn(`Registry act sync before notarized PDF view skipped: ${msg.slice(0, 200)}`)
		}

		await this.notarizedArchive.streamQuicksignNotarizedPdf(qs.id, res, {
			download: opts?.download === true,
		})
	}

	async generateMeetingDocumentPlotLink(
		ctx: QlegalSessionContext | null,
		meetingId: string,
		documentId: string
	): Promise<DocoChainPlotLinkResult> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const apt = await this.loadAppointmentForMeeting(ctx, meetingId)
		if (ctx.userId !== apt.enpUserId) {
			throw new ORPCError("FORBIDDEN", { message: "Only the ENP may plot signature fields" })
		}
		await this.assertEnpCommissionActiveForNotarialActs(apt.enpUserId)
		if (apt.status !== "in_session") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Plotting is only allowed during an active session",
			})
		}

		await this.assertDocumentOnAppointment(apt.id, documentId)
		const qs = await this.loadQuicksignProjectForDocument(apt.enpUserId, documentId)
		if (!qs) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Quicksign project is required before plotting",
			})
		}

		const assignments = await this.listMeetingDocumentSignerAssignments(ctx, meetingId, documentId)
		if (!assignments.signers.length) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Assign signers before plotting signature fields",
			})
		}
		if (qs.plotCompletedAt) {
			throw new ORPCError("BAD_REQUEST", { message: "This document has already been plotted" })
		}

		const signers = [...assignments.signers]
			.sort((a, b) => a.signingOrder - b.signingOrder)
			.map(s => ({ userId: s.userId, role: s.role }))
		const userMeta = await this.loadSignerUserMeta(signers.map(s => s.userId))

		await this.ensureDoconchainProjectForSignerAssignment({
			apt,
			documentId,
			qs,
			signers,
			userMeta,
		})

		const plotLink = `/meetings/${meetingId}/documents/${documentId}/plot`
		return { plotLink }
	}

	async markMeetingDocumentPlotted(
		ctx: QlegalSessionContext | null,
		meetingId: string,
		documentId: string,
		signatureFields?: SignatureField[]
	): Promise<MarkMeetingDocumentPlottedResult> {
		this.log.debug(
			`markMeetingDocumentPlotted START meetingId=${meetingId} documentId=${documentId} signatureFieldsCount=${signatureFields?.length ?? 0}`
		)

		try {
			if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

			this.log.debug(`markMeetingDocumentPlotted loading appointment for meeting=${meetingId}`)
			const apt = await this.loadAppointmentForMeeting(ctx, meetingId)
			this.log.debug(`markMeetingDocumentPlotted appointment loaded id=${apt.id} enpUserId=${apt.enpUserId} status=${apt.status}`)

			if (ctx.userId !== apt.enpUserId) {
				throw new ORPCError("FORBIDDEN", { message: "Only the ENP may confirm plotting" })
			}
			await this.assertEnpCommissionActiveForNotarialActs(apt.enpUserId)
			if (apt.status !== "in_session") {
				throw new ORPCError("BAD_REQUEST", {
					message: "Plotting confirmation is only allowed during an active session",
				})
			}

			this.log.debug(`markMeetingDocumentPlotted asserting document on appointment`)
			await this.assertDocumentOnAppointment(apt.id, documentId)

			this.log.debug(`markMeetingDocumentPlotted loading quicksign project for enpUserId=${apt.enpUserId} documentId=${documentId}`)
			const qs = await this.loadQuicksignProjectForDocument(apt.enpUserId, documentId)
			if (!qs) {
				throw new ORPCError("BAD_REQUEST", { message: "Quicksign project is required" })
			}
			this.log.debug(`markMeetingDocumentPlotted quicksign project found id=${qs.id} status=${qs.status} plotCompletedAt=${qs.plotCompletedAt}`)

			this.log.debug(`markMeetingDocumentPlotted loading signer assignments`)
			const assignments = await this.listMeetingDocumentSignerAssignments(ctx, meetingId, documentId)
			if (!assignments.signers.length) {
				throw new ORPCError("BAD_REQUEST", { message: "Assign signers before confirming plotting" })
			}
			this.log.debug(`markMeetingDocumentPlotted found ${assignments.signers.length} signer assignments`)

			const now = new Date()
			this.log.debug(`markMeetingDocumentPlotted updating quicksign project id=${qs.id} with plotCompletedAt, status=pending_signatures, signatureFieldsCount=${signatureFields?.length ?? 0}`)
			await db
				.update(quicksignProjects)
				.set({
					plotCompletedAt: now,
					status: "pending_signatures",
					updatedAt: now,
					...(signatureFields && signatureFields.length > 0
						? { signatureFields }
						: {}),
				})
				.where(eq(quicksignProjects.id, qs.id))

			this.log.debug(`markMeetingDocumentPlotted SUCCESS appointment=${apt.id} document=${documentId}`)
			return { ok: true }
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			const stack = e instanceof Error ? e.stack : undefined
			this.log.error(
				`markMeetingDocumentPlotted ERROR meetingId=${meetingId} documentId=${documentId}: ${msg}`
			)
			if (stack) this.log.error(`markMeetingDocumentPlotted STACK: ${stack}`)
			throw e
		}
	}

	async initiateMeetingSigning(
		ctx: QlegalSessionContext | null,
		meetingId: string,
		documentId: string,
		email: string,
		_projectUuidInput?: string,
		isPlotting?: boolean
	): Promise<InitiateMeetingSigningResult> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const apt = await this.loadAppointmentForMeeting(ctx, meetingId)
		await this.assertCanParticipateInMeeting(ctx, apt)
		if (apt.status !== "in_session") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Signing is only allowed during an active session",
			})
		}

		await this.assertDocumentOnAppointment(apt.id, documentId)
		const qs = await this.loadQuicksignProjectForDocument(apt.enpUserId, documentId)
		if (!qs) {
			throw new ORPCError("BAD_REQUEST", { message: "Quicksign project is required" })
		}
		const projectUuid = qs.id

		if (isPlotting === true) {
			if (ctx.userId !== apt.enpUserId) {
				throw new ORPCError("FORBIDDEN", { message: "Only the ENP may plot signature fields" })
			}
			const plot = await this.generateMeetingDocumentPlotLink(ctx, meetingId, documentId)
			return { projectUuid, link: plot.plotLink, kind: "plot" }
		}

		const signerEmail = email.trim()
		const sessionEmail = (await this.loadEmails([ctx.userId])).get(ctx.userId)
		if (!sessionEmail || sessionEmail.toLowerCase() !== signerEmail.toLowerCase()) {
			throw new ORPCError("FORBIDDEN", { message: "Signing email must match your account" })
		}

		const assignments = await this.listMeetingDocumentSignerAssignments(ctx, meetingId, documentId)
		if (!assignments.signers.some(s => s.userId === ctx.userId)) {
			throw new ORPCError("FORBIDDEN", { message: "You are not assigned to sign this document" })
		}

		await this.assertMeetingSignerCanSignNow({
			appointmentId: apt.id,
			documentId,
			signerUserId: ctx.userId,
			enpUserId: apt.enpUserId,
			plotCompletedAt: qs?.plotCompletedAt,
		})

		return { projectUuid, link: "/local-sign", kind: "sign" }
	}

	async generateMeetingDocumentSignLink(
		ctx: QlegalSessionContext | null,
		meetingId: string,
		documentId: string,
		signerEmail: string
	): Promise<DocoChainSignLinkResult> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const apt = await this.loadAppointmentForMeeting(ctx, meetingId)
		await this.assertCanParticipateInMeeting(ctx, apt)
		if (apt.status !== "in_session") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Signing is only allowed during an active session",
			})
		}
		await this.assertDocumentOnAppointment(apt.id, documentId)

		const qs = await this.loadQuicksignProjectForDocument(apt.enpUserId, documentId)
		if (!qs) {
			throw new ORPCError("BAD_REQUEST", { message: "Quicksign project is required" })
		}

		const email = signerEmail.trim()
		const sessionEmail = (await this.loadEmails([ctx.userId])).get(ctx.userId)
		if (!sessionEmail || sessionEmail.toLowerCase() !== email.toLowerCase()) {
			throw new ORPCError("FORBIDDEN", { message: "Signing email must match your account" })
		}

		const assignments = await this.listMeetingDocumentSignerAssignments(ctx, meetingId, documentId)
		if (!assignments.signers.some(s => s.userId === ctx.userId)) {
			throw new ORPCError("FORBIDDEN", { message: "You are not assigned to sign this document" })
		}

		await this.assertMeetingSignerCanSignNow({
			appointmentId: apt.id,
			documentId,
			signerUserId: ctx.userId,
			enpUserId: apt.enpUserId,
			plotCompletedAt: qs?.plotCompletedAt,
		})

		return { signLink: "/local-sign" }
	}

	async markSignedForCurrentUser(
		ctx: QlegalSessionContext | null,
		meetingId: string,
		documentId: string,
		signaturePngBase64?: string
	): Promise<MarkSignedForCurrentUserResult> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const apt = await this.loadAppointmentForMeeting(ctx, meetingId)
		await this.assertCanParticipateInMeeting(ctx, apt)
		await this.assertDocumentOnAppointment(apt.id, documentId)

		const qs = await this.loadQuicksignProjectForDocument(apt.enpUserId, documentId)
		if (!qs) {
			throw new ORPCError("BAD_REQUEST", { message: "Quicksign project is required" })
		}

		await this.assertMeetingSignerCanSignNow({
			appointmentId: apt.id,
			documentId,
			signerUserId: ctx.userId,
			enpUserId: apt.enpUserId,
			plotCompletedAt: qs?.plotCompletedAt,
		})

		const [row] = await db
			.select({
				id: meetingSignatureRequests.id,
				status: meetingSignatureRequests.status,
			})
			.from(meetingSignatureRequests)
			.where(
				and(
					eq(meetingSignatureRequests.appointmentId, apt.id),
					eq(meetingSignatureRequests.documentFileObjectId, documentId),
					eq(meetingSignatureRequests.signerUserId, ctx.userId)
				)
			)
			.limit(1)

		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "You are not assigned to sign this document" })
		}

		if (row.status === "signed") {
			return { ok: true }
		}

		if (signaturePngBase64) {
			const [user] = await db
				.select({ email: users.email })
				.from(users)
				.where(eq(users.id, ctx.userId))
				.limit(1)
			if (user?.email) {
				await this.localStorage.saveSignature(qs.id, user.email, signaturePngBase64)
			}
		}

		const now = new Date()
		await db
			.update(meetingSignatureRequests)
			.set({ status: "signed", signedAt: now, updatedAt: now })
			.where(eq(meetingSignatureRequests.id, row.id))

		return { ok: true }
	}

	private assertAuthenticated(
		ctx: QlegalSessionContext | null
	): asserts ctx is QlegalSessionContext {
		if (!ctx?.userId) {
			throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		}
	}

	/** Applies to principal, witness, guest, and notary — signing order is enforced for everyone. */
	private async assertMeetingSignerCanSignNow(args: {
		appointmentId: string
		documentId: string
		signerUserId: string
		enpUserId: string
		plotCompletedAt: Date | null | undefined
	}): Promise<void> {
		if (!args.plotCompletedAt && args.signerUserId !== args.enpUserId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Wait for the ENP to plot signature fields before signing",
			})
		}

		const rows = await db
			.select({
				signerUserId: meetingSignatureRequests.signerUserId,
				signingOrder: meetingSignatureRequests.signingOrder,
				status: meetingSignatureRequests.status,
			})
			.from(meetingSignatureRequests)
			.where(
				and(
					eq(meetingSignatureRequests.appointmentId, args.appointmentId),
					eq(meetingSignatureRequests.documentFileObjectId, args.documentId)
				)
			)
			.orderBy(asc(meetingSignatureRequests.signingOrder))

		const mine = rows.find(r => r.signerUserId === args.signerUserId)
		if (!mine) {
			throw new ORPCError("FORBIDDEN", { message: "You are not assigned to sign this document" })
		}
		if (mine.status === "signed") {
			throw new ORPCError("BAD_REQUEST", { message: "You have already signed this document" })
		}

		const earlierUnsigned = rows.some(
			r => r.signingOrder < mine.signingOrder && r.status !== "signed"
		)
		if (earlierUnsigned) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Wait for earlier signers to finish before opening your signing link",
			})
		}
	}

	private async assertEnpCommissionActiveForNotarialActs(enpUserId: string): Promise<void> {
		const govId = await assertGovernmentIdAllowsNotarialActs(enpUserId)
		if (!govId.ok) {
			throw new ORPCError("FORBIDDEN", { message: govId.detail })
		}
		const commission = await assertEnpCommissionAllowsNotarialActs(enpUserId)
		if (!commission.ok) {
			throw new ORPCError("FORBIDDEN", { message: commission.detail })
		}
	}

	private async loadAppointmentForMeeting(ctx: QlegalSessionContext | null, meetingId: string) {
		this.assertAuthenticated(ctx)
		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, meetingId))
			.limit(1)
		if (!row) throw new ORPCError("NOT_FOUND", { message: `Meeting ${meetingId} not found` })
		return row
	}

	private async assertCanParticipateInMeeting(
		ctx: QlegalSessionContext,
		apt: typeof appointments.$inferSelect
	) {
		if (ctx.userId === apt.enpUserId || ctx.userId === apt.clientUserId) return

		const [room] = await db
			.select({ id: sessionRooms.id })
			.from(sessionRooms)
			.where(eq(sessionRooms.appointmentId, apt.id))
			.limit(1)

		if (!room?.id) {
			throw new ORPCError("FORBIDDEN", { message: "You cannot access this meeting" })
		}

		const [guest] = await db
			.select({ userId: sessionRoomGuests.userId })
			.from(sessionRoomGuests)
			.where(
				and(eq(sessionRoomGuests.sessionRoomId, room.id), eq(sessionRoomGuests.userId, ctx.userId))
			)
			.limit(1)

		if (!guest) {
			throw new ORPCError("FORBIDDEN", { message: "You cannot access this meeting" })
		}
	}

	private async assertDocumentOnAppointment(appointmentId: string, documentId: string) {
		const [link] = await db
			.select({ fileObjectId: appointmentDocuments.fileObjectId })
			.from(appointmentDocuments)
			.where(
				and(
					eq(appointmentDocuments.appointmentId, appointmentId),
					eq(appointmentDocuments.fileObjectId, documentId)
				)
			)
			.limit(1)
		if (!link) throw new ORPCError("NOT_FOUND", { message: "Document not found on this meeting" })
	}

	private async loadQuicksignProjectForDocument(enpUserId: string, documentId: string) {
		const [row] = await db
			.select({
				id: quicksignProjects.id,
				doconchainProjectUuid: quicksignProjects.doconchainProjectUuid,
				plotCompletedAt: quicksignProjects.plotCompletedAt,
				status: quicksignProjects.status,
				notarizedPdfEmailedAt: quicksignProjects.notarizedPdfEmailedAt,
				notarizedFileObjectId: quicksignProjects.notarizedFileObjectId,
			})
			.from(quicksignProjects)
			.where(
				and(
					eq(quicksignProjects.enpUserId, enpUserId),
					eq(quicksignProjects.documentFileObjectId, documentId)
				)
			)
			.limit(1)
		return row
	}

	private async loadEmails(userIds: string[]): Promise<Map<string, string>> {
		const map = new Map<string, string>()
		if (!userIds.length) return map
		const rows = await db
			.select({ id: users.id, email: users.email })
			.from(users)
			.where(inArray(users.id, userIds))
		for (const r of rows) {
			if (r.email) map.set(r.id, r.email)
		}
		return map
	}

	private async loadDisplayNames(userIds: string[]): Promise<Map<string, string>> {
		const map = new Map<string, string>()
		if (!userIds.length) return map

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
			const parts = [e.prefix, e.firstName, e.lastName, e.suffix].filter(Boolean)
			map.set(e.userId, parts.join(" ").trim() || "ENP")
		}
		for (const u of uRows) {
			if (!map.has(u.id) && u.name) map.set(u.id, u.name)
		}
		for (const id of userIds) {
			if (!map.has(id)) map.set(id, "User")
		}
		return map
	}

	/**
	 * Signers are managed via `meetingSignatureRequests` — no DocOnChain signer sync needed.
	 */
	private async syncDoconchainProjectSigners(_args: {
		enpUserId: string
		projectUuid: string
		signers: { userId: string; role: MeetingSignerRole }[]
		userMeta: Map<string, { firstName: string; lastName: string; email: string }>
	}): Promise<void> {
		// no-op: signer management is local
	}

	/** Before first plot, save the PDF locally and auto-generate signature fields. */
	private async ensureDoconchainProjectForSignerAssignment(args: {
		apt: typeof appointments.$inferSelect
		documentId: string
		qs: {
			id: string
			doconchainProjectUuid: string | null
			plotCompletedAt: Date | null
		}
		signers: { userId: string; role: MeetingSignerRole }[]
		userMeta: Map<string, { firstName: string; lastName: string; email: string }>
	}): Promise<string> {
		const localProjectId = args.qs.id
		if (args.qs.plotCompletedAt) {
			return localProjectId
		}

		const pdfBuffer = await this.files.readStoredFileBuffer(args.documentId)
		await this.localStorage.savePdf(localProjectId, pdfBuffer)

		const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })
		const pageCount = pdfDoc.getPageCount()
		const lastPageIndex = Math.max(0, pageCount - 1)

		const fields: SignatureField[] = []
		let fieldIndex = 0
		for (const signer of args.signers) {
			const meta = args.userMeta.get(signer.userId)
			if (!meta) continue
			fields.push({
				signerEmail: meta.email,
				pageIndex: lastPageIndex,
				x: 50,
				y: 50 + fieldIndex * 70,
				width: 200,
				height: 60,
			})
			fieldIndex++
		}

		const now = new Date()
		await db
			.update(quicksignProjects)
			.set({
				signatureFields: fields,
				status: "pending_signatures",
				updatedAt: now,
			})
			.where(eq(quicksignProjects.id, localProjectId))

		this.log.debug(
			`ensureDoconchainProjectForSignerAssignment: saved PDF + ${fields.length} fields for project=${localProjectId.slice(0, 8)}…`
		)
		return localProjectId
	}

	private async resolveEnpSubOrgIds(enpUserId: string): Promise<string[]> {
		const [enp] = await db
			.select({ subOrgId: enpProfiles.subOrgId })
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, enpUserId))
			.limit(1)
		return enp?.subOrgId ? [enp.subOrgId] : []
	}

	private async loadEnpRow(enpUserId: string) {
		const [row] = await db
			.select({
				firstName: enpProfiles.firstName,
				lastName: enpProfiles.lastName,
				email: users.email,
			})
			.from(enpProfiles)
			.innerJoin(users, eq(users.id, enpProfiles.userId))
			.where(eq(enpProfiles.userId, enpUserId))
			.limit(1)
		return row
	}

	private async loadSignerUserMeta(
		userIds: string[]
	): Promise<Map<string, { firstName: string; lastName: string; email: string }>> {
		const map = new Map<string, { firstName: string; lastName: string; email: string }>()
		if (!userIds.length) return map

		const emails = await this.loadEmails(userIds)
		const [cRows, eRows] = await Promise.all([
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
					firstName: enpProfiles.firstName,
					lastName: enpProfiles.lastName,
				})
				.from(enpProfiles)
				.where(inArray(enpProfiles.userId, userIds)),
		])

		for (const c of cRows) {
			const email = emails.get(c.userId)
			if (email) map.set(c.userId, { firstName: c.firstName, lastName: c.lastName, email })
		}
		for (const e of eRows) {
			const email = emails.get(e.userId)
			if (email) map.set(e.userId, { firstName: e.firstName, lastName: e.lastName, email })
		}
		for (const id of userIds) {
			if (map.has(id)) continue
			const email = emails.get(id)
			if (!email) continue
			map.set(id, { firstName: "Guest", lastName: ".", email })
		}
		return map
	}
}
