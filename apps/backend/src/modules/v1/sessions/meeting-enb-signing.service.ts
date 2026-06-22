import { Injectable, Logger } from "@nestjs/common"
import { ORPCError } from "@orpc/server"
import { and, asc, desc, eq, inArray } from "drizzle-orm"

import {
	formatEnbEntryNumber,
	type MeetingEnbSignatureRequest,
	type MeetingEnbSigningStatus,
	type SignMeetingEnbEntryInput,
} from "@repo/contracts"
import {
	appointmentDocuments,
	appointments,
	clientProfiles,
	enpProfiles,
	meetingEnbSignatureRequests,
	meetingSignatureRequests,
	quicksignProjects,
	registryActs,
	sessionRoomGuests,
	sessionRooms,
	users,
} from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { EventsService } from "@/modules/v1/events/events.service"
import { IenAttestationService } from "@/modules/v1/ien-attestation/ien-attestation.service"
import { RegistryService } from "@/modules/v1/registry/registry.service"

const MEETING_FILE_DEDUPE_PREFIX = "qlegal-file:"

function parseFileObjectIdFromDescription(description: string | null | undefined): string | null {
	if (!description?.trim()) return null
	const segments = description.includes("|") ? description.split("|") : [description]
	for (const part of segments) {
		const segment = part.trim()
		if (segment.startsWith(MEETING_FILE_DEDUPE_PREFIX)) {
			return segment.slice(MEETING_FILE_DEDUPE_PREFIX.length).trim() || null
		}
	}
	return null
}

@Injectable()
export class MeetingEnbSigningService {
	private readonly log = new Logger(MeetingEnbSigningService.name)

	constructor(
		private readonly registry: RegistryService,
		private readonly events: EventsService,
		private readonly ienAttestation: IenAttestationService
	) {}

	async getStatus(
		ctx: QlegalSessionContext | null,
		meetingId: string
	): Promise<MeetingEnbSigningStatus> {
		const apt = await this.loadAppointmentForMeeting(ctx, meetingId)
		this.assertAuthenticated(ctx)
		await this.assertCanParticipateInMeeting(ctx, apt)
		return this.buildStatus(apt, ctx!.userId)
	}

	async startEnbSigning(
		ctx: QlegalSessionContext | null,
		meetingId: string
	): Promise<MeetingEnbSigningStatus> {
		const apt = await this.loadAppointmentForMeeting(ctx, meetingId)
		this.assertAuthenticated(ctx)
		if (ctx!.userId !== apt.enpUserId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the assigned notary can start ENB signing",
			})
		}
		if (apt.status !== "in_session") {
			throw new ORPCError("BAD_REQUEST", {
				message: "ENB signing can only start during an active session",
			})
		}
		if (apt.enbSigningStatus === "completed") {
			return this.buildStatus(apt, ctx.userId)
		}

		await this.assertAllDocumentsNotarized(apt.id, apt.enpUserId)

		const now = new Date()
		if (apt.enbSigningStatus === "not_started") {
			const { created } = await this.registry.syncActsFromEndedMeeting({
				appointmentId: apt.id,
				enpUserId: apt.enpUserId,
				meetingEndedAt: now,
				allowDuringActiveSession: true,
			})
			this.log.log(`ENB signing: synced ${created} draft registry act(s) for appointment ${apt.id}`)
			await this.createSignatureRequests(apt.id, apt.clientUserId)
		}

		const [updated] = await db
			.update(appointments)
			.set({
				enbSigningStatus: "active",
				enbSigningStartedAt: apt.enbSigningStartedAt ?? now,
				updatedAt: now,
			})
			.where(eq(appointments.id, apt.id))
			.returning()

		const nextApt = updated ?? apt
		await this.maybeCompleteSigning(nextApt)
		const status = await this.buildStatus(
			(await db.select().from(appointments).where(eq(appointments.id, apt.id)).limit(1))[0] ??
				nextApt,
			ctx.userId
		)
		await this.emitSigningUpdate(apt.id, status)
		return status
	}

	async listRequests(
		ctx: QlegalSessionContext | null,
		meetingId: string
	): Promise<MeetingEnbSignatureRequest[]> {
		const apt = await this.loadAppointmentForMeeting(ctx, meetingId)
		this.assertAuthenticated(ctx)
		await this.assertCanParticipateInMeeting(ctx, apt)
		return this.loadAllRequests(apt.id)
	}

	async signEntry(
		ctx: QlegalSessionContext | null,
		input: SignMeetingEnbEntryInput
	): Promise<{ ok: boolean; status: MeetingEnbSigningStatus }> {
		const apt = await this.loadAppointmentForMeeting(ctx, input.meetingId)
		this.assertAuthenticated(ctx)
		await this.assertCanParticipateInMeeting(ctx, apt)
		if (apt.status !== "in_session") {
			throw new ORPCError("BAD_REQUEST", { message: "Session is no longer active" })
		}
		if (apt.enbSigningStatus !== "active") {
			throw new ORPCError("BAD_REQUEST", { message: "ENB signing is not active for this session" })
		}

		const [row] = await db
			.select()
			.from(meetingEnbSignatureRequests)
			.where(
				and(
					eq(meetingEnbSignatureRequests.id, input.requestId),
					eq(meetingEnbSignatureRequests.appointmentId, apt.id)
				)
			)
			.limit(1)
		if (!row) throw new ORPCError("NOT_FOUND", { message: "Signature request not found" })
		if (row.signerUserId !== ctx!.userId) {
			throw new ORPCError("FORBIDDEN", { message: "You may only sign your own ENB entry" })
		}
		if (row.status === "signed") {
			const status = await this.buildStatus(apt, ctx.userId)
			return { ok: true, status }
		}

		const [act] = await db
			.select({ description: registryActs.description })
			.from(registryActs)
			.where(eq(registryActs.id, row.registryActId))
			.limit(1)
		const documentFileId = parseFileObjectIdFromDescription(act?.description)
		if (documentFileId) {
			await this.ienAttestation.recordAppointmentAttestationIfRequired(
				ctx,
				apt.id,
				documentFileId,
				row.signerRole
			)
		}

		const acknowledgment = input.signatureAcknowledgment.trim()
		const now = new Date()
		await db
			.update(meetingEnbSignatureRequests)
			.set({
				status: "signed",
				signatureAcknowledgment: acknowledgment,
				signatureImageData: input.signatureImageData,
				signedAt: now,
				updatedAt: now,
			})
			.where(eq(meetingEnbSignatureRequests.id, row.id))

		const [freshApt] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, apt.id))
			.limit(1)
		if (freshApt) await this.maybeCompleteSigning(freshApt)

		const [finalApt] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, apt.id))
			.limit(1)
		const status = await this.buildStatus(finalApt ?? apt, ctx.userId)
		await this.emitSigningUpdate(apt.id, status)
		return { ok: true, status }
	}

	private async createSignatureRequests(appointmentId: string, fallbackClientUserId: string) {
		const acts = await db
			.select()
			.from(registryActs)
			.where(eq(registryActs.appointmentId, appointmentId))
			.orderBy(asc(registryActs.createdAt))

		if (!acts.length) return

		const fileIds = acts
			.map(a => parseFileObjectIdFromDescription(a.description))
			.filter((id): id is string => Boolean(id))

		const signerRows =
			fileIds.length > 0
				? await db
						.select({
							documentFileObjectId: meetingSignatureRequests.documentFileObjectId,
							signerUserId: meetingSignatureRequests.signerUserId,
							signerRole: meetingSignatureRequests.signerRole,
						})
						.from(meetingSignatureRequests)
						.where(
							and(
								eq(meetingSignatureRequests.appointmentId, appointmentId),
								inArray(meetingSignatureRequests.documentFileObjectId, fileIds),
								inArray(meetingSignatureRequests.signerRole, ["principal", "witness"])
							)
						)
				: []

		const signersByFile = new Map<
			string,
			{ signerUserId: string; signerRole: "principal" | "witness" }[]
		>()
		for (const r of signerRows) {
			const role = r.signerRole === "witness" ? "witness" : "principal"
			const list = signersByFile.get(r.documentFileObjectId) ?? []
			if (!list.some(p => p.signerUserId === r.signerUserId)) {
				list.push({ signerUserId: r.signerUserId, signerRole: role })
			}
			signersByFile.set(r.documentFileObjectId, list)
		}

		const userIds = new Set<string>()
		for (const act of acts) {
			const fileId = parseFileObjectIdFromDescription(act.description)
			const signers = fileId
				? (signersByFile.get(fileId) ?? [
						{ signerUserId: fallbackClientUserId, signerRole: "principal" as const },
					])
				: [{ signerUserId: fallbackClientUserId, signerRole: "principal" as const }]
			for (const s of signers) userIds.add(s.signerUserId)
		}
		const names = await this.loadDisplayNames([...userIds])
		const now = new Date()

		for (const act of acts) {
			const fileId = parseFileObjectIdFromDescription(act.description)
			const signers = fileId
				? (signersByFile.get(fileId) ?? [
						{ signerUserId: fallbackClientUserId, signerRole: "principal" as const },
					])
				: [{ signerUserId: fallbackClientUserId, signerRole: "principal" as const }]
			const entryNumber =
				act.entryNumber?.trim() ||
				formatEnbEntryNumber({
					actNumber: act.actNumber,
					pageNo: act.pageNo,
					executedAt: act.executedAt,
				})

			for (const signer of signers) {
				const defaultName = signer.signerRole === "witness" ? "Witness" : "Principal"
				const signerName = names.get(signer.signerUserId) ?? defaultName
				await db
					.insert(meetingEnbSignatureRequests)
					.values({
						appointmentId,
						registryActId: act.id,
						signerUserId: signer.signerUserId,
						signerRole: signer.signerRole,
						signerName,
						entryNumber,
						documentTitle: act.title,
						status: "pending",
						createdAt: now,
						updatedAt: now,
					})
					.onConflictDoNothing({
						target: [
							meetingEnbSignatureRequests.registryActId,
							meetingEnbSignatureRequests.signerUserId,
						],
					})
			}
		}
	}

	private async maybeCompleteSigning(apt: typeof appointments.$inferSelect) {
		const rows = await db
			.select({ status: meetingEnbSignatureRequests.status })
			.from(meetingEnbSignatureRequests)
			.where(eq(meetingEnbSignatureRequests.appointmentId, apt.id))

		if (!rows.length) {
			const now = new Date()
			await db
				.update(appointments)
				.set({
					enbSigningStatus: "completed",
					enbSigningCompletedAt: now,
					updatedAt: now,
				})
				.where(eq(appointments.id, apt.id))
			return
		}

		const allSigned = rows.every(r => r.status === "signed")
		if (!allSigned) return

		const now = new Date()
		await db
			.update(appointments)
			.set({
				enbSigningStatus: "completed",
				enbSigningCompletedAt: now,
				updatedAt: now,
			})
			.where(eq(appointments.id, apt.id))
	}

	private async buildStatus(
		apt: typeof appointments.$inferSelect,
		currentUserId: string
	): Promise<MeetingEnbSigningStatus> {
		const all = await this.loadAllRequests(apt.id)
		const signedCount = all.filter(r => r.status === "signed").length
		const myPending = all.filter(r => r.signerUserId === currentUserId && r.status === "pending")
		return {
			appointmentId: apt.id,
			status: apt.enbSigningStatus,
			startedAt: apt.enbSigningStartedAt?.toISOString() ?? null,
			completedAt: apt.enbSigningCompletedAt?.toISOString() ?? null,
			totalRequests: all.length,
			signedCount,
			pendingCount: all.length - signedCount,
			myPending,
		}
	}

	private async loadAllRequests(appointmentId: string): Promise<MeetingEnbSignatureRequest[]> {
		const rows = await db
			.select()
			.from(meetingEnbSignatureRequests)
			.where(eq(meetingEnbSignatureRequests.appointmentId, appointmentId))
			.orderBy(asc(meetingEnbSignatureRequests.createdAt))

		return rows.map(r => ({
			id: r.id,
			appointmentId: r.appointmentId,
			registryActId: r.registryActId,
			signerUserId: r.signerUserId,
			signerRole: r.signerRole,
			signerName: r.signerName,
			entryNumber: r.entryNumber,
			documentTitle: r.documentTitle,
			status: r.status,
			signatureAcknowledgment: r.signatureAcknowledgment ?? null,
			signatureImageData: r.signatureImageData ?? null,
			signedAt: r.signedAt?.toISOString() ?? null,
		}))
	}

	private async emitSigningUpdate(appointmentId: string, status: MeetingEnbSigningStatus) {
		const [room] = await db
			.select({ id: sessionRooms.id })
			.from(sessionRooms)
			.where(eq(sessionRooms.appointmentId, appointmentId))
			.limit(1)
		if (!room) return
		this.events.emitToSession(room.id, "session:enb-signing", {
			appointmentId,
			status: status.status,
			pendingCount: status.pendingCount,
			signedCount: status.signedCount,
		})
	}

	private async assertAllDocumentsNotarized(appointmentId: string, enpUserId: string) {
		const docs = await db
			.select({ fileObjectId: appointmentDocuments.fileObjectId })
			.from(appointmentDocuments)
			.where(eq(appointmentDocuments.appointmentId, appointmentId))

		const notarizable = docs.filter(d => d.fileObjectId)
		if (!notarizable.length) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Add and notarize at least one document before completing notarization",
			})
		}

		for (const doc of notarizable) {
			const [qs] = await db
				.select({ status: quicksignProjects.status })
				.from(quicksignProjects)
				.where(
					and(
						eq(quicksignProjects.enpUserId, enpUserId),
						eq(quicksignProjects.documentFileObjectId, doc.fileObjectId)
					)
				)
				.orderBy(desc(quicksignProjects.createdAt))
				.limit(1)
			if (!qs || qs.status !== "completed") {
				throw new ORPCError("BAD_REQUEST", {
					message: "All documents must be fully notarized before ENB signing can begin",
				})
			}
		}
	}

	private async loadAppointmentForMeeting(ctx: QlegalSessionContext | null, meetingId: string) {
		const [apt] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, meetingId))
			.limit(1)
		if (!apt) throw new ORPCError("NOT_FOUND", { message: "Meeting not found" })
		return apt
	}

	private assertAuthenticated(
		ctx: QlegalSessionContext | null
	): asserts ctx is QlegalSessionContext {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
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
					firstName: enpProfiles.firstName,
					lastName: enpProfiles.lastName,
				})
				.from(enpProfiles)
				.where(inArray(enpProfiles.userId, userIds)),
			db
				.select({ id: users.id, name: users.name, email: users.email })
				.from(users)
				.where(inArray(users.id, userIds)),
		])
		for (const u of uRows) {
			const name = u.name?.trim() || u.email?.split("@")[0] || "Participant"
			map.set(u.id, name)
		}
		for (const c of cRows) {
			const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim()
			if (name) map.set(c.userId, name)
		}
		for (const e of eRows) {
			const name = `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim()
			if (name) map.set(e.userId, name)
		}
		return map
	}
}
