import { Logger } from "@nestjs/common"
import {
	OnGatewayConnection,
	OnGatewayDisconnect,
	OnGatewayInit,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from "@nestjs/websockets"
import { fromNodeHeaders } from "better-auth/node"
import { and, eq } from "drizzle-orm"
import { Server, Socket } from "socket.io"
import { z } from "zod"

import { getAuth } from "@repo/auth"
import {
	appointments,
	commissionHearingRoomParticipants,
	commissionHearingRooms,
	dmConversations,
	sessionRoomGuests,
	sessionRooms,
	users,
} from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import { env } from "@/config/env.config"

import { EventsWsMetricsService } from "./events-ws.metrics"
import { dmRoom, sessionRoom, userRoom } from "./events-ws.rooms"
import { EventsService } from "./events.service"

const joinRoomSchema = z.object({
	roomId: z.string().uuid(),
})

const joinDmSchema = z.object({
	conversationId: z.string().min(1),
})

const dmTypingSchema = z.object({
	conversationId: z.string().min(1),
	isTyping: z.boolean(),
})

const sessionRecordingNoticeSchema = z.object({
	roomId: z.string().uuid(),
	status: z.enum(["started", "acknowledged", "stopped"]),
	startedAt: z.string().datetime().optional(),
})

type SessionParticipantInfo = {
	role: "enp" | "client" | "guest_signer"
	displayName: string
}

type SessionRecordingNoticePayload = {
	sessionRoomId: string
	status: "started" | "acknowledged" | "stopped"
	senderUserId: string
	senderRole: SessionParticipantInfo["role"]
	senderDisplayName: string
	startedAt?: string
}

export type QlegalSocketData = {
	userId?: string
}

declare module "socket.io" {
	interface SocketData extends QlegalSocketData {}
}

const wsCorsOrigins = env.CORS_ORIGINS.split(",").map(origin => origin.trim())

function getSocketUserId(client: Socket): string | undefined {
	return typeof client.data.userId === "string" ? client.data.userId : undefined
}

/**
 * Authenticated Socket.IO gateway (namespace `/events`).
 *
 * Rooms: `user:<userId>` (auto), `session:<roomId>`, `dm:<conversationId>`.
 */
@WebSocketGateway({
	namespace: "/events",
	path: "/socket.io",
	addTrailingSlash: false,
	cors: { origin: wsCorsOrigins, credentials: true },
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer()
	server!: Server

	private readonly logger = new Logger(EventsGateway.name)
	private readonly activeRecordingNotices = new Map<
		string,
		Omit<SessionRecordingNoticePayload, "status"> & { status: "started" | "acknowledged" }
	>()

	constructor(
		private readonly eventsService: EventsService,
		private readonly metrics: EventsWsMetricsService
	) {}

	afterInit(): void {
		this.eventsService.attachServer(this.server)
		this.logger.log("Events WebSocket gateway initialized (/events)")
	}

	async handleConnection(client: Socket): Promise<void> {
		let session: { user?: { id?: string | null } | null } | null = null
		try {
			session = await getAuth().api.getSession({
				headers: fromNodeHeaders(client.handshake.headers),
			})
		} catch (error) {
			this.logger.error("WebSocket session resolution failed", error)
		}

		const userId = session?.user?.id
		if (!userId) {
			this.metrics.onAuthRejected(client.id, "no_session")
			client.disconnect(true)
			return
		}

		client.data.userId = userId
		await client.join(userRoom(userId))
		this.metrics.onConnect(userId, client.id)
	}

	handleDisconnect(client: Socket): void {
		this.metrics.onDisconnect(getSocketUserId(client), client.id, "closed")
	}

	@SubscribeMessage("ping")
	handlePing(client: Socket): void {
		client.emit("pong", { timestamp: new Date().toISOString() })
	}

	@SubscribeMessage("join-session")
	async handleJoinSession(client: Socket, raw: unknown): Promise<void> {
		const parsed = joinRoomSchema.safeParse(raw)
		if (!parsed.success) {
			client.emit("ws:error", {
				code: "invalid_payload",
				message: "join-session expects { roomId: uuid }",
			})
			return
		}
		const userId = getSocketUserId(client)
		if (!userId) {
			client.emit("ws:error", { code: "unauthenticated", message: "Missing user" })
			return
		}
		const allowed = await verifySessionRoomMembership(userId, parsed.data.roomId)
		if (!allowed) {
			client.emit("ws:error", {
				code: "session_forbidden",
				message: "You are not allowed to join this session room",
			})
			return
		}
		await client.join(sessionRoom(parsed.data.roomId))
		client.emit("ws:joined", { kind: "session", roomId: parsed.data.roomId })
		const activeRecording = this.activeRecordingNotices.get(parsed.data.roomId)
		if (activeRecording) {
			client.emit("session:recording-notice", activeRecording)
		}
	}

	@SubscribeMessage("leave-session")
	async handleLeaveSession(client: Socket, raw: unknown): Promise<void> {
		const parsed = joinRoomSchema.safeParse(raw)
		if (!parsed.success) {
			return
		}
		await client.leave(sessionRoom(parsed.data.roomId))
	}

	@SubscribeMessage("session:recording-notice")
	async handleSessionRecordingNotice(client: Socket, raw: unknown): Promise<void> {
		const parsed = sessionRecordingNoticeSchema.safeParse(raw)
		if (!parsed.success) {
			client.emit("ws:error", {
				code: "invalid_payload",
				message:
					"session:recording-notice expects { roomId: uuid, status: 'started' | 'acknowledged' | 'stopped' }",
			})
			return
		}
		const userId = getSocketUserId(client)
		if (!userId) {
			client.emit("ws:error", { code: "unauthenticated", message: "Missing user" })
			return
		}
		const participantInfo = await getSessionRoomParticipantInfo(userId, parsed.data.roomId)
		if (!participantInfo) {
			client.emit("ws:error", {
				code: "session_forbidden",
				message: "You are not allowed to broadcast to this session room",
			})
			return
		}
		const payload: SessionRecordingNoticePayload = {
			sessionRoomId: parsed.data.roomId,
			status: parsed.data.status,
			startedAt: parsed.data.startedAt,
			senderUserId: userId,
			senderRole: participantInfo.role,
			senderDisplayName: participantInfo.displayName,
		}

		if (payload.status === "stopped") {
			this.activeRecordingNotices.delete(parsed.data.roomId)
		} else {
			this.activeRecordingNotices.set(parsed.data.roomId, {
				...payload,
				status: payload.status,
			})
		}

		this.eventsService.emitToSession(parsed.data.roomId, "session:recording-notice", payload)
		const participantUserIds = await listSessionRoomParticipantUserIds(parsed.data.roomId)
		for (const participantUserId of participantUserIds) {
			this.eventsService.emitToUser(participantUserId, "session:recording-notice", payload)
		}
	}

	@SubscribeMessage("join-dm")
	async handleJoinDm(client: Socket, raw: unknown): Promise<void> {
		const parsed = joinDmSchema.safeParse(raw)
		if (!parsed.success) {
			client.emit("ws:error", {
				code: "invalid_payload",
				message: "join-dm expects { conversationId: string }",
			})
			return
		}
		const userId = getSocketUserId(client)
		if (!userId) {
			client.emit("ws:error", { code: "unauthenticated", message: "Missing user" })
			return
		}
		const allowed = await verifyDmMembership(userId, parsed.data.conversationId)
		if (!allowed) {
			client.emit("ws:error", {
				code: "dm_forbidden",
				message: "You are not allowed to join this DM room",
			})
			return
		}
		await client.join(dmRoom(parsed.data.conversationId))
		client.emit("ws:joined", { kind: "dm", conversationId: parsed.data.conversationId })
	}

	@SubscribeMessage("leave-dm")
	async handleLeaveDm(client: Socket, raw: unknown): Promise<void> {
		const parsed = joinDmSchema.safeParse(raw)
		if (!parsed.success) {
			return
		}
		await client.leave(dmRoom(parsed.data.conversationId))
	}

	@SubscribeMessage("dm:typing")
	async handleDmTyping(client: Socket, raw: unknown): Promise<void> {
		const parsed = dmTypingSchema.safeParse(raw)
		if (!parsed.success) {
			client.emit("ws:error", {
				code: "invalid_payload",
				message: "dm:typing expects { conversationId: string, isTyping: boolean }",
			})
			return
		}

		const userId = getSocketUserId(client)
		if (!userId) {
			client.emit("ws:error", { code: "unauthenticated", message: "Missing user" })
			return
		}

		const allowed = await verifyDmMembership(userId, parsed.data.conversationId)
		if (!allowed) {
			client.emit("ws:error", {
				code: "dm_forbidden",
				message: "You are not allowed to type in this DM room",
			})
			return
		}

		this.eventsService.emitToDm(parsed.data.conversationId, "dm:typing", {
			conversationId: parsed.data.conversationId,
			senderUserId: userId,
			isTyping: parsed.data.isTyping,
		})
	}
}

async function getSessionRoomParticipantInfo(
	userId: string,
	roomId: string
): Promise<SessionParticipantInfo | null> {
	const [row] = await db
		.select({
			clientId: appointments.clientUserId,
			enpId: appointments.enpUserId,
			endedAt: sessionRooms.endedAt,
			aptStatus: appointments.status,
		})
		.from(sessionRooms)
		.innerJoin(appointments, eq(appointments.id, sessionRooms.appointmentId))
		.where(eq(sessionRooms.id, roomId))
		.limit(1)

	if (!row || row.endedAt || row.aptStatus !== "in_session") return null

	const role: "enp" | "client" | "guest_signer" | null =
		userId === row.enpId ? "enp" : userId === row.clientId ? "client" : null

	if (role) {
		const [userRow] = await db
			.select({ name: users.name })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)
		return userRow ? { role, displayName: userRow.name } : null
	}

	const [guestRow] = await db
		.select({ name: users.name })
		.from(sessionRoomGuests)
		.innerJoin(users, eq(users.id, sessionRoomGuests.userId))
		.where(and(eq(sessionRoomGuests.sessionRoomId, roomId), eq(sessionRoomGuests.userId, userId)))
		.limit(1)

	return guestRow ? { role: "guest_signer", displayName: guestRow.name } : null
}

async function listSessionRoomParticipantUserIds(roomId: string): Promise<string[]> {
	const [row] = await db
		.select({
			clientId: appointments.clientUserId,
			enpId: appointments.enpUserId,
			endedAt: sessionRooms.endedAt,
			aptStatus: appointments.status,
		})
		.from(sessionRooms)
		.innerJoin(appointments, eq(appointments.id, sessionRooms.appointmentId))
		.where(eq(sessionRooms.id, roomId))
		.limit(1)

	if (!row || row.endedAt || row.aptStatus !== "in_session") {
		return []
	}

	const participantUserIds = new Set([row.clientId, row.enpId])
	const guestRows = await db
		.select({ userId: sessionRoomGuests.userId })
		.from(sessionRoomGuests)
		.where(eq(sessionRoomGuests.sessionRoomId, roomId))

	for (const guestRow of guestRows) {
		participantUserIds.add(guestRow.userId)
	}

	return [...participantUserIds]
}

async function verifySessionRoomMembership(userId: string, roomId: string): Promise<boolean> {
	const [row] = await db
		.select({
			clientId: appointments.clientUserId,
			enpId: appointments.enpUserId,
			endedAt: sessionRooms.endedAt,
			aptStatus: appointments.status,
		})
		.from(sessionRooms)
		.innerJoin(appointments, eq(appointments.id, sessionRooms.appointmentId))
		.where(eq(sessionRooms.id, roomId))
		.limit(1)

	if (row && !row.endedAt && row.aptStatus === "in_session") {
		if (row.clientId === userId || row.enpId === userId) {
			return true
		}

		const [guest] = await db
			.select({ userId: sessionRoomGuests.userId })
			.from(sessionRoomGuests)
			.where(and(eq(sessionRoomGuests.sessionRoomId, roomId), eq(sessionRoomGuests.userId, userId)))
			.limit(1)

		return !!guest
	}

	const [hearingRow] = await db
		.select({
			enaUserId: commissionHearingRooms.enaUserId,
			applicantUserId: commissionHearingRooms.applicantUserId,
			status: commissionHearingRooms.status,
		})
		.from(commissionHearingRooms)
		.where(eq(commissionHearingRooms.id, roomId))
		.limit(1)

	if (
		hearingRow?.status === "in_session" &&
		(hearingRow.enaUserId === userId || hearingRow.applicantUserId === userId)
	) {
		return true
	}

	const [hearingParticipant] = await db
		.select({ userId: commissionHearingRoomParticipants.userId })
		.from(commissionHearingRoomParticipants)
		.innerJoin(
			commissionHearingRooms,
			eq(commissionHearingRooms.id, commissionHearingRoomParticipants.hearingRoomId)
		)
		.where(
			and(
				eq(commissionHearingRoomParticipants.hearingRoomId, roomId),
				eq(commissionHearingRoomParticipants.userId, userId),
				eq(commissionHearingRooms.status, "in_session")
			)
		)
		.limit(1)

	return !!hearingParticipant
}

async function verifyDmMembership(userId: string, conversationId: string): Promise<boolean> {
	const [row] = await db
		.select({ low: dmConversations.lowUserId, high: dmConversations.highUserId })
		.from(dmConversations)
		.where(eq(dmConversations.id, conversationId))
		.limit(1)
	if (!row) return false
	return row.low === userId || row.high === userId
}
