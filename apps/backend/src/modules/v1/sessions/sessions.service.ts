import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common"
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { ORPCError } from "@orpc/server"
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm"

import type {
	InviteSessionGuestInput,
	JoinTokenPayload,
	LobbyCheckResult,
	NotarialSession,
	SessionChatMessage,
	SessionGuestIntendedRole,
	SessionStatus,
} from "@repo/contracts"
import {
	accounts,
	appointmentDocuments,
	appointments,
	clientProfiles,
	enpProfiles,
	hypervergeTransactions,
	livenessValidations,
	sessionMessages,
	sessionRoomGuests,
	sessionRooms,
	users,
} from "@repo/db/schema"

import { EMAIL_ADAPTER, type EmailAdapter } from "@/services/email/email-adapter"
import {
	buildSessionGuestInviteEmail,
	formatSessionGuestRoleLabel,
} from "@/services/email/session-guest-invite-email"
import { LiveKitTokenService } from "@/services/livekit/livekit-token.service"
import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { env, publicAppUrl } from "@/config/env.config"

import { AppointmentsService } from "../appointments/appointments.service"
import { assertGovernmentIdAllowsNotarialActs } from "../auth-profile/lib/assert-government-id-allows-notarial-acts"
import { assertProfileKycVerified } from "../auth-profile/lib/assert-profile-kyc-verified"
import { EventsService } from "../events/events.service"
import { hasRecentAllowedLocationAudit } from "./location-verification.service"

function sha256Hex(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex")
}

function mapSessionStatus(
	row: typeof sessionRooms.$inferSelect,
	appointmentStatus: string
): SessionStatus {
	if (row.endedAt) return "completed"
	if (appointmentStatus === "in_session") return "active"
	return "scheduled"
}

@Injectable()
export class SessionsService {
	private readonly log = new Logger(SessionsService.name)

	constructor(
		private readonly livekit: LiveKitTokenService,
		private readonly events: EventsService,
		@Inject(EMAIL_ADAPTER) private readonly email: EmailAdapter,
		@Inject(forwardRef(() => AppointmentsService))
		private readonly appointments: AppointmentsService
	) {}

	async ensureRoomForAppointment(appointmentId: string): Promise<void> {
		const [apt] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!apt || apt.status !== "in_session") return

		const [existing] = await db
			.select({ id: sessionRooms.id })
			.from(sessionRooms)
			.where(eq(sessionRooms.appointmentId, appointmentId))
			.limit(1)
		if (existing) return

		const livekitRoomName = `qlegal-apt-${appointmentId}`
		const now = new Date()
		await db.insert(sessionRooms).values({
			appointmentId,
			livekitRoomName,
			startedAt: now,
			createdAt: now,
			updatedAt: now,
		})
	}

	async endRoomForAppointment(appointmentId: string): Promise<void> {
		const now = new Date()
		await db
			.update(sessionRooms)
			.set({ endedAt: now, updatedAt: now })
			.where(and(eq(sessionRooms.appointmentId, appointmentId), isNull(sessionRooms.endedAt)))
	}

	async lobbyCheck(
		ctx: QlegalSessionContext | null,
		input: { appointmentId: string; guestInviteToken?: string }
	): Promise<LobbyCheckResult> {
		if (!ctx?.userId) return { kind: "unauthenticated" }

		const [apt] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, input.appointmentId))
			.limit(1)
		if (!apt) return { kind: "not_found" }

		const [room] = await db
			.select()
			.from(sessionRooms)
			.where(eq(sessionRooms.appointmentId, input.appointmentId))
			.limit(1)

		if (apt.status !== "in_session") {
			return { kind: "wrong_status", status: apt.status }
		}
		if (!room) {
			return { kind: "wrong_status", status: apt.status }
		}
		if (room.endedAt) {
			return { kind: "session_ended" }
		}

		const isEnp = ctx.userId === apt.enpUserId
		const isClient = ctx.userId === apt.clientUserId
		const isLegacyCommissionHearingAppointment = apt.kind === "commission_hearing"

		const lobbyMeta = await this.loadLobbyAppointmentMeta(apt)

		if (isEnp || isClient) {
			const role = isEnp ? "enp" : "client"
			// Legacy-only compatibility: pre-dedicated ENA hearings used appointment rows with
			// the ENA in the client slot. New hearings use commission_hearing_rooms instead.
			if (!(isLegacyCommissionHearingAppointment && isClient)) {
				const profileKyc = await assertProfileKycVerified(ctx.userId, role)
				if (!profileKyc.ok) return { kind: "identity_required", detail: profileKyc.detail }
			}
			if (!isLegacyCommissionHearingAppointment) {
				const govId = await assertGovernmentIdAllowsNotarialActs(ctx.userId)
				if (!govId.ok) return { kind: "identity_required", detail: govId.detail }
			}
			const liveness = await this.assertAppointmentLivenessOk(ctx.userId, input.appointmentId)
			if (!liveness.ok) return { kind: "identity_required", detail: liveness.detail }
			const displayName = await this.loadDisplayName(ctx.userId)
			return {
				kind: "ok",
				sessionRoomId: room.id,
				livekitRoomName: room.livekitRoomName,
				participantRole: role,
				displayName,
				...lobbyMeta,
			}
		}

		if (!input.guestInviteToken?.trim()) {
			return { kind: "forbidden" }
		}

		const guestOk = await this.verifyGuestInvite(room, input.guestInviteToken.trim())
		if (guestOk === "invalid") return { kind: "guest_invite_invalid" }
		if (guestOk === "expired") return { kind: "guest_invite_expired" }

		if (!(env.NODE_ENV === "development" && env.SESSION_DEV_RELAX_IDENTITY === "true")) {
			const google = await this.hasGoogleAccount(ctx.userId)
			if (!google) return { kind: "guest_requires_google" }

			const hv = await this.hasSuccessfulHyperverge(ctx.userId)
			if (!hv) {
				return {
					kind: "identity_required",
					detail:
						"Complete identity verification (government ID), session liveness, and location on the join screen before entering the meeting.",
				}
			}
		}

		const displayName = await this.loadDisplayName(ctx.userId)
		const guestKycComplete = await this.hasSuccessfulHyperverge(ctx.userId)
		const guestLivenessComplete = (
			await this.assertAppointmentLivenessOk(ctx.userId, input.appointmentId)
		).ok
		const guestIntendedRole = room.guestInviteIntendedRole ?? undefined

		return {
			kind: "ok",
			sessionRoomId: room.id,
			livekitRoomName: room.livekitRoomName,
			participantRole: "guest_signer",
			displayName,
			guestIntendedRole,
			guestKycComplete,
			guestLivenessComplete,
			...lobbyMeta,
		}
	}

	async issueJoinToken(
		ctx: QlegalSessionContext | null,
		appointmentId: string
	): Promise<JoinTokenPayload> {
		const lobby = await this.lobbyCheck(ctx, { appointmentId })
		if (lobby.kind !== "ok") {
			const detail = "detail" in lobby ? lobby.detail : undefined
			throw new ORPCError("FORBIDDEN", {
				message: `Lobby check failed: ${lobby.kind}${detail ? ` - ${detail}` : ""}`,
			})
		}
		if (lobby.participantRole === "guest_signer") {
			throw new ORPCError("FORBIDDEN", {
				message: "Use the guest join-token endpoint for guest signers",
			})
		}
		await this.assertRecentAllowedLocation(ctx!.userId, appointmentId)
		return this.mintJoinPayload(ctx!.userId, lobby)
	}

	async issueGuestJoinToken(
		ctx: QlegalSessionContext | null,
		input: { appointmentId: string; guestInviteToken: string }
	): Promise<JoinTokenPayload> {
		const lobby = await this.lobbyCheck(ctx, {
			appointmentId: input.appointmentId,
			guestInviteToken: input.guestInviteToken,
		})
		if (lobby.kind !== "ok") {
			const detail = "detail" in lobby ? lobby.detail : undefined
			throw new ORPCError("FORBIDDEN", {
				message: `Guest lobby check failed: ${lobby.kind}${detail ? ` - ${detail}` : ""}`,
			})
		}
		if (lobby.participantRole !== "guest_signer") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Guest invite token is only for non-party participants",
			})
		}

		const [room] = await db
			.select()
			.from(sessionRooms)
			.where(eq(sessionRooms.appointmentId, input.appointmentId))
			.limit(1)
		if (!room) throw new ORPCError("NOT_FOUND", { message: "Session room not found" })

		await this.assertRecentAllowedLocation(ctx!.userId, input.appointmentId)

		await db
			.insert(sessionRoomGuests)
			.values({ sessionRoomId: room.id, userId: ctx!.userId, createdAt: new Date() })
			.onConflictDoNothing()

		return this.mintJoinPayload(ctx!.userId, lobby)
	}

	/**
	 * Refuse the LiveKit token unless the lobby location pipeline produced a
	 * recent allowed audit row for this user/appointment, so a client cannot
	 * skip the in-browser check by calling the mint directly. Honors
	 * `SESSION_DEV_RELAX_LOCATION=true` in development.
	 */
	private async assertRecentAllowedLocation(userId: string, appointmentId: string): Promise<void> {
		const ok = await hasRecentAllowedLocationAudit(userId, appointmentId)
		if (ok) return
		throw new ORPCError("FORBIDDEN", {
			message: "Location not verified. Complete the lobby location check, then try again.",
		})
	}

	async enableGuestSigner(
		ctx: QlegalSessionContext | null,
		sessionRoomId: string
	): Promise<{ guestInviteToken: string; expiresAt: string }> {
		const { room } = await this.assertEnpActiveSessionRoom(ctx, sessionRoomId)
		const { token, expiresAt } = await this.mintGuestInviteToken(room.id)
		return { guestInviteToken: token, expiresAt: expiresAt.toISOString() }
	}

	async inviteSessionGuest(
		ctx: QlegalSessionContext | null,
		input: InviteSessionGuestInput
	): Promise<{ guestInviteToken: string; expiresAt: string; joinMeetingUrl: string }> {
		const [room] = await db
			.select()
			.from(sessionRooms)
			.where(eq(sessionRooms.appointmentId, input.appointmentId))
			.limit(1)
		if (!room) throw new ORPCError("NOT_FOUND", { message: "Session room not found" })

		const { apt } = await this.assertEnpActiveSessionRoom(ctx, room.id)
		if (apt.id !== input.appointmentId) {
			throw new ORPCError("NOT_FOUND", { message: "Appointment not found" })
		}

		const { token, expiresAt } = await this.mintGuestInviteToken(room.id, input.intendedRole)
		const joinMeetingUrl = this.buildGuestMeetingUrl(input.appointmentId, token)

		if (input.sendEmail) {
			const enpName = (await this.loadDisplayNames([apt.enpUserId])).get(apt.enpUserId) ?? "ENP"
			const invite = buildSessionGuestInviteEmail({
				enpName,
				appointmentTitle: apt.title,
				intendedRoleLabel: formatSessionGuestRoleLabel(input.intendedRole),
				joinMeetingUrl,
			})
			await this.email.sendQuicksignSessionInvite(input.recipientEmail.trim(), invite)
		}

		return {
			guestInviteToken: token,
			expiresAt: expiresAt.toISOString(),
			joinMeetingUrl,
		}
	}

	async listSessionChat(
		ctx: QlegalSessionContext | null,
		sessionRoomId: string
	): Promise<SessionChatMessage[]> {
		await this.assertSessionChatAccess(ctx, sessionRoomId)

		const rows = await db
			.select({
				id: sessionMessages.id,
				sessionRoomId: sessionMessages.sessionRoomId,
				senderUserId: sessionMessages.senderUserId,
				body: sessionMessages.body,
				createdAt: sessionMessages.createdAt,
			})
			.from(sessionMessages)
			.where(eq(sessionMessages.sessionRoomId, sessionRoomId))
			.orderBy(desc(sessionMessages.createdAt))
			.limit(200)

		const senderIds = [...new Set(rows.map(r => r.senderUserId))]
		const names = await this.loadDisplayNames(senderIds)

		return rows.reverse().map(r => ({
			id: r.id,
			sessionRoomId: r.sessionRoomId,
			senderUserId: r.senderUserId,
			senderName: names.get(r.senderUserId) ?? "User",
			body: r.body,
			createdAt: r.createdAt.toISOString(),
		}))
	}

	async sendSessionChat(
		ctx: QlegalSessionContext | null,
		sessionRoomId: string,
		body: string
	): Promise<SessionChatMessage> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [r0] = await db
			.select()
			.from(sessionRooms)
			.where(eq(sessionRooms.id, sessionRoomId))
			.limit(1)
		if (!r0) throw new ORPCError("NOT_FOUND", { message: "Session room not found" })
		if (r0.endedAt) throw new ORPCError("BAD_REQUEST", { message: "Session has ended" })

		await this.assertSessionChatAccess(ctx, sessionRoomId)

		const now = new Date()
		const [inserted] = await db
			.insert(sessionMessages)
			.values({
				sessionRoomId,
				senderUserId: ctx.userId,
				body,
				createdAt: now,
			})
			.returning()

		if (!inserted)
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to save message" })

		const senderName = await this.loadDisplayName(ctx.userId)
		const dto: SessionChatMessage = {
			id: inserted.id,
			sessionRoomId: inserted.sessionRoomId,
			senderUserId: inserted.senderUserId,
			senderName,
			body: inserted.body,
			createdAt: inserted.createdAt.toISOString(),
		}

		this.events.emitToSession(sessionRoomId, "session:chat", dto)
		return dto
	}

	async findAll(ctx: QlegalSessionContext | null): Promise<NotarialSession[]> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const roomRows = await db
			.select({ room: sessionRooms, apt: appointments })
			.from(sessionRooms)
			.innerJoin(appointments, eq(appointments.id, sessionRooms.appointmentId))
			.where(or(eq(appointments.clientUserId, ctx.userId), eq(appointments.enpUserId, ctx.userId)))
			.orderBy(desc(sessionRooms.createdAt))

		return this.shapeMany(roomRows.map(r => ({ ...r.room, appointment: r.apt })))
	}

	async findOne(ctx: QlegalSessionContext | null, sessionRoomId: string): Promise<NotarialSession> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select({ room: sessionRooms, apt: appointments })
			.from(sessionRooms)
			.innerJoin(appointments, eq(appointments.id, sessionRooms.appointmentId))
			.where(eq(sessionRooms.id, sessionRoomId))
			.limit(1)

		if (!row) throw new ORPCError("NOT_FOUND", { message: `Session ${sessionRoomId} not found` })
		this.assertAppointmentParty(ctx, row.apt)
		return (await this.shapeMany([{ ...row.room, appointment: row.apt }]))[0]!
	}

	async updateSessionStatus(
		ctx: QlegalSessionContext | null,
		sessionRoomId: string,
		status: SessionStatus,
		notes?: string
	): Promise<NotarialSession> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select({ room: sessionRooms, apt: appointments })
			.from(sessionRooms)
			.innerJoin(appointments, eq(appointments.id, sessionRooms.appointmentId))
			.where(eq(sessionRooms.id, sessionRoomId))
			.limit(1)

		if (!row) throw new ORPCError("NOT_FOUND", { message: `Session ${sessionRoomId} not found` })
		if (ctx.userId !== row.apt.enpUserId) {
			throw new ORPCError("FORBIDDEN", { message: "Only the ENP can update session status" })
		}

		if (status === "completed" || status === "cancelled") {
			void notes
			await this.appointments.updateStatus(ctx, row.apt.id, "ended", undefined)
			return this.findOne(ctx, sessionRoomId)
		}

		const now = new Date()
		await db.update(sessionRooms).set({ updatedAt: now }).where(eq(sessionRooms.id, sessionRoomId))

		return this.findOne(ctx, sessionRoomId)
	}

	private async mintJoinPayload(
		userId: string,
		lobby: Extract<LobbyCheckResult, { kind: "ok" }>
	): Promise<JoinTokenPayload> {
		const ws = this.livekit.livekitWsUrl()
		if (!ws) {
			throw new ORPCError("SERVICE_UNAVAILABLE", {
				message: "LiveKit is not configured on the server",
			})
		}

		let token: string
		try {
			token = await this.livekit.mintParticipantToken({
				roomName: lobby.livekitRoomName,
				identity: userId,
				displayName: lobby.displayName,
				role: lobby.participantRole,
			})
		} catch (e) {
			const msg = e instanceof Error ? e.message : "LiveKit token error"
			throw new ORPCError("SERVICE_UNAVAILABLE", { message: msg })
		}

		return {
			token,
			livekitUrl: ws,
			livekitRoomName: lobby.livekitRoomName,
			sessionRoomId: lobby.sessionRoomId,
			participantRole: lobby.participantRole,
			displayName: lobby.displayName,
		}
	}

	private buildGuestMeetingUrl(appointmentId: string, guestInviteToken: string): string {
		const base = publicAppUrl().replace(/\/$/, "")
		const q = new URLSearchParams({ guest: guestInviteToken })
		return `${base}/appointments/${appointmentId}/meeting?${q.toString()}`
	}

	private async mintGuestInviteToken(
		sessionRoomId: string,
		intendedRole?: SessionGuestIntendedRole
	): Promise<{ token: string; expiresAt: Date }> {
		const token = randomBytes(24).toString("base64url")
		const hash = sha256Hex(token)
		const expiresAt = new Date(Date.now() + 48 * 3600_000)
		const now = new Date()

		await db
			.update(sessionRooms)
			.set({
				guestInviteTokenHash: hash,
				guestInviteExpiresAt: expiresAt,
				guestInviteIntendedRole: intendedRole ?? null,
				updatedAt: now,
			})
			.where(eq(sessionRooms.id, sessionRoomId))

		return { token, expiresAt }
	}

	private async assertEnpActiveSessionRoom(
		ctx: QlegalSessionContext | null,
		sessionRoomId: string
	): Promise<{ room: typeof sessionRooms.$inferSelect; apt: typeof appointments.$inferSelect }> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [room] = await db
			.select()
			.from(sessionRooms)
			.where(eq(sessionRooms.id, sessionRoomId))
			.limit(1)
		if (!room) throw new ORPCError("NOT_FOUND", { message: "Session room not found" })

		const [apt] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, room.appointmentId))
			.limit(1)
		if (!apt) throw new ORPCError("NOT_FOUND", { message: "Appointment not found" })
		if (ctx.userId !== apt.enpUserId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the assigned ENP can create a guest invite",
			})
		}
		if (apt.status !== "in_session" || room.endedAt) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Guest invite is only available during an active session",
			})
		}

		return { room, apt }
	}

	private async loadLobbyAppointmentMeta(
		apt: typeof appointments.$inferSelect
	): Promise<{ appointmentTitle: string; enpName: string }> {
		const names = await this.loadDisplayNames([apt.enpUserId])
		return {
			appointmentTitle: apt.title,
			enpName: names.get(apt.enpUserId) ?? "Electronic Notary Public",
		}
	}

	private async verifyGuestInvite(
		room: typeof sessionRooms.$inferSelect,
		plaintext: string
	): Promise<"ok" | "invalid" | "expired"> {
		const hash = sha256Hex(plaintext)
		const stored = room.guestInviteTokenHash
		const exp = room.guestInviteExpiresAt
		if (!stored || !exp) return "invalid"
		if (exp.getTime() < Date.now()) return "expired"
		const a = Buffer.from(stored, "hex")
		const b = Buffer.from(hash, "hex")
		if (a.length !== b.length || !timingSafeEqual(a, b)) return "invalid"
		return "ok"
	}

	private async hasGoogleAccount(userId: string): Promise<boolean> {
		const [row] = await db
			.select({ id: accounts.userId })
			.from(accounts)
			.where(and(eq(accounts.userId, userId), eq(accounts.providerId, "google")))
			.limit(1)
		return !!row
	}

	private async hasSuccessfulHyperverge(userId: string): Promise<boolean> {
		const [row] = await db
			.select({ id: hypervergeTransactions.id })
			.from(hypervergeTransactions)
			.where(
				and(eq(hypervergeTransactions.userId, userId), eq(hypervergeTransactions.status, "success"))
			)
			.orderBy(desc(hypervergeTransactions.createdAt))
			.limit(1)
		return !!row
	}

	private async assertAppointmentLivenessOk(
		userId: string,
		appointmentId: string
	): Promise<{ ok: true } | { ok: false; detail: string }> {
		if (env.NODE_ENV === "development" && env.SESSION_DEV_RELAX_IDENTITY === "true") {
			return { ok: true }
		}
		const [passed] = await db
			.select({ id: livenessValidations.id })
			.from(livenessValidations)
			.where(
				and(
					eq(livenessValidations.userId, userId),
					eq(livenessValidations.appointmentId, appointmentId),
					eq(livenessValidations.status, "pass")
				)
			)
			.limit(1)

		if (!passed) {
			return {
				ok: false,
				detail: "Complete the session liveness check in the lobby before joining the meeting.",
			}
		}
		return { ok: true }
	}

	private assertAppointmentParty(ctx: QlegalSessionContext, apt: typeof appointments.$inferSelect) {
		const ok = ctx.userId === apt.clientUserId || ctx.userId === apt.enpUserId
		if (!ok) throw new ORPCError("FORBIDDEN", { message: "You cannot access this session" })
	}

	private async assertSessionChatAccess(ctx: QlegalSessionContext | null, sessionRoomId: string) {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select({ room: sessionRooms, apt: appointments })
			.from(sessionRooms)
			.innerJoin(appointments, eq(appointments.id, sessionRooms.appointmentId))
			.where(eq(sessionRooms.id, sessionRoomId))
			.limit(1)

		if (!row) throw new ORPCError("NOT_FOUND", { message: "Session room not found" })
		if (row.apt.status !== "in_session") {
			throw new ORPCError("FORBIDDEN", {
				message: "Chat is only available during an active session",
			})
		}

		const isParty = ctx.userId === row.apt.clientUserId || ctx.userId === row.apt.enpUserId
		if (isParty) return

		const [guest] = await db
			.select({ one: sessionRoomGuests.userId })
			.from(sessionRoomGuests)
			.where(
				and(
					eq(sessionRoomGuests.sessionRoomId, sessionRoomId),
					eq(sessionRoomGuests.userId, ctx.userId)
				)
			)
			.limit(1)

		if (!guest) throw new ORPCError("FORBIDDEN", { message: "You cannot access this session chat" })
	}

	private async loadDisplayName(userId: string): Promise<string> {
		const map = await this.loadDisplayNames([userId])
		return map.get(userId) ?? "Participant"
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

	private async shapeMany(
		rows: Array<
			{ appointment: typeof appointments.$inferSelect } & typeof sessionRooms.$inferSelect
		>
	): Promise<NotarialSession[]> {
		if (!rows.length) return []

		const appointmentIds = rows.map(r => r.appointmentId)
		const docRows =
			appointmentIds.length === 0
				? []
				: await db
						.select({
							appointmentId: appointmentDocuments.appointmentId,
							fileObjectId: appointmentDocuments.fileObjectId,
						})
						.from(appointmentDocuments)
						.where(inArray(appointmentDocuments.appointmentId, appointmentIds))

		const docMap = new Map<string, string[]>()
		for (const d of docRows) {
			const list = docMap.get(d.appointmentId) ?? []
			list.push(d.fileObjectId)
			docMap.set(d.appointmentId, list)
		}

		const clientIds = [...new Set(rows.map(r => r.appointment.clientUserId))]
		const clientNames = await this.loadDisplayNames(clientIds)

		return rows.map(r => {
			const apt = r.appointment
			const status = mapSessionStatus(r, apt.status)
			return {
				id: r.id,
				appointmentId: apt.id,
				livekitRoomName: r.livekitRoomName,
				enpId: apt.enpUserId,
				clientId: apt.clientUserId,
				clientName: clientNames.get(apt.clientUserId) ?? "Client",
				status,
				startedAt: r.startedAt.toISOString(),
				endedAt: r.endedAt ? r.endedAt.toISOString() : null,
				recordingUrl: null,
				documentIds: docMap.get(apt.id) ?? [],
				notes: null,
				createdAt: r.createdAt,
				updatedAt: r.updatedAt,
			}
		})
	}
}
