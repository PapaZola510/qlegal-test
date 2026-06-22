"use client"

import { io, type Socket } from "socket.io-client"

import type {
	CommissionHearingChatMessage,
	MeetingEnbSigningWsEvent,
	SessionChatMessage,
	SessionRecordingNotice,
} from "@repo/contracts"

import { env } from "@/env"

/**
 * Known server → client events on the `/events` namespace.
 * Extend this map as features add real-time payloads.
 */
export type QlegalServerToClientEvents = {
	"pong": (payload: { timestamp: string }) => void
	"ws:error": (payload: { code: string; message: string }) => void
	"ws:joined": (payload: {
		kind: "session" | "dm"
		roomId?: string
		conversationId?: string
	}) => void
	/** ENP inbox: new pending appointment (payload from backend `EventsService`) */
	"appointments:pending": (payload: { appointmentId: string; clientId: string }) => void
	/** Client: confirm / decline / other updates */
	"appointments:updated": (payload: { appointmentId: string; status: string }) => void
	"appointments:payment-updated": (payload: {
		appointmentId: string
		status: "succeeded" | string
	}) => void
	"signed:ctc-payment-updated": (payload: { requestId: string; status: string }) => void
	"commission-hearing:payment-updated": (payload: {
		hearingRoomId: string
		status: string
		paidAt: string | null
	}) => void
	"commission-hearing:opposition-updated": (payload: {
		hearingRoomId: string | null
		applicationId: string
		oppositionId: string
		status: string
	}) => void
	/** ENP inbox: a client uploaded a document for review */
	"document-review:pending": (payload: { reviewRequestId: string; clientId: string }) => void
	/** Client: ENP approved, rejected, or the request was cancelled */
	"document-review:updated": (payload: {
		reviewRequestId: string
		status: string
		appointmentId?: string
	}) => void
	/** LiveKit session room: persisted chat mirrored over WebSocket */
	"session:chat": (payload: SessionChatMessage) => void
	/** LiveKit session room: ENP started or stopped local session recording */
	"session:recording-notice": (payload: SessionRecordingNotice) => void
	/** LiveKit session room: ENB principal e-sign phase updated */
	"session:enb-signing": (payload: MeetingEnbSigningWsEvent) => void
	/** Commission hearing room: ENA opened the hearing */
	"commission-hearing:opened": (payload: { hearingRoomId: string }) => void
	/** Commission hearing room: ENA ended the hearing */
	"commission-hearing:ended": (payload: { hearingRoomId: string }) => void
	/** Commission hearing application: ENA granted or denied the application */
	"commission-hearing:decided": (payload: { applicationId: string; status: string }) => void
	/** Commission hearing room: persisted chat mirrored over WebSocket */
	"commission-hearing:chat": (payload: CommissionHearingChatMessage) => void
	/** Commission hearing room: server-side egress recording state changed */
	"commission-hearing:recording": (payload: {
		hearingRoomId: string
		status: "started" | "stopped"
		egressId?: string | null
		fileObjectId?: string | null
	}) => void
	/** DM thread: new message (payload matches {@link Message} from contracts) */
	"dm:message": (payload: Record<string, unknown>) => void
	"dm:conversation-updated": (payload: {
		conversationId: string
		lastMessagePreview: string
		lastMessageAt: string
	}) => void
	"dm:read": (payload: { conversationId: string; readerUserId: string; readAt: string }) => void
	"dm:typing": (payload: {
		conversationId: string
		senderUserId: string
		isTyping: boolean
	}) => void
}

let socket: Socket | null = null
const qlegalEventHandlers = new Map<
	keyof QlegalServerToClientEvents,
	Set<(payload: unknown) => void>
>()
let bufferedRecordingNotice: SessionRecordingNotice | null = null

function logWsLifecycle(message: string, detail: unknown): void {
	if (env.NODE_ENV !== "development") {
		return
	}
	const c = globalThis.console
	if (typeof c?.info === "function") {
		c.info(`[qlegal-ws] ${message}`, detail)
	}
}

function backendOrigin(): string {
	if (env.NEXT_PUBLIC_WS_ORIGIN) {
		return env.NEXT_PUBLIC_WS_ORIGIN.replace(/\/$/, "")
	}
	// Default: same-origin. Next.js rewrites proxy `/socket.io/*` to the Nest backend.
	// This avoids hardcoding ports (your backend might run on :3080, not :3000).
	if (typeof window !== "undefined") {
		return window.location.origin.replace(/\/$/, "")
	}

	// Fallback for non-browser contexts (should not happen because this module is `"use client"`).
	return env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3001"
}

/**
 * Lazily creates the tab-scoped Socket.IO client (namespace `/events`, cookies/credentials).
 * Call {@link ensureQlegalSocketConnected} after the user is authenticated.
 */
export function getQlegalSocket(): Socket {
	if (socket) {
		return socket
	}

	const instance = io(`${backendOrigin()}/events`, {
		path: "/socket.io",
		addTrailingSlash: false,
		autoConnect: false,
		withCredentials: true,
		reconnection: true,
		reconnectionAttempts: Number.POSITIVE_INFINITY,
		reconnectionDelay: 1000,
		reconnectionDelayMax: 30_000,
		transports: ["polling", "websocket"],
	})

	instance.io.on("reconnect", attempt => {
		logWsLifecycle("reconnect", { attempt })
		// Socket.IO room memberships are per-connection — re-join after reconnect.
		const rooms = [...joinedSessionRooms]
		joinedSessionRooms.clear()
		for (const roomId of rooms) {
			void joinSessionRoom(roomId).catch(() => undefined)
		}
	})

	instance.io.on("reconnect_attempt", attempt => {
		logWsLifecycle("reconnect_attempt", { attempt })
	})

	attachBufferedEventForwarders(instance)
	socket = instance
	return instance
}

function attachBufferedEventForwarders(instance: Socket): void {
	const forward = <K extends keyof QlegalServerToClientEvents>(event: K) => {
		instance.on(
			event as never,
			((payload: unknown) => {
				if (event === "session:recording-notice") {
					const notice = payload as SessionRecordingNotice
					bufferedRecordingNotice = notice.status === "stopped" ? null : notice
				}
				for (const handler of qlegalEventHandlers.get(event) ?? []) {
					handler(payload)
				}
			}) as never
		)
	}

	forward("pong")
	forward("ws:error")
	forward("ws:joined")
	forward("appointments:pending")
	forward("appointments:updated")
	forward("appointments:payment-updated")
	forward("signed:ctc-payment-updated")
	forward("document-review:pending")
	forward("document-review:updated")
	forward("session:chat")
	forward("session:recording-notice")
	forward("commission-hearing:opened")
	forward("commission-hearing:ended")
	forward("commission-hearing:decided")
	forward("commission-hearing:chat")
	forward("commission-hearing:recording")
	forward("commission-hearing:payment-updated")
	forward("commission-hearing:opposition-updated")
	forward("dm:message")
	forward("dm:conversation-updated")
	forward("dm:read")
	forward("dm:typing")
}

export function ensureQlegalSocketConnected(): void {
	const client = getQlegalSocket()
	if (!client.connected) {
		client.connect()
	}
}

function whenSocketConnected(): Promise<void> {
	const client = getQlegalSocket()
	if (client.connected) {
		return Promise.resolve()
	}
	return new Promise(resolve => {
		client.once("connect", () => resolve())
	})
}

const joinedSessionRooms = new Set<string>()

/** Join a LiveKit session room for real-time events (chat, recording notices). */
export async function joinSessionRoom(roomId: string): Promise<void> {
	ensureQlegalSocketConnected()
	await whenSocketConnected()
	if (joinedSessionRooms.has(roomId)) {
		return
	}

	const client = getQlegalSocket()
	await new Promise<void>((resolve, reject) => {
		const timeout = window.setTimeout(() => {
			client.off("ws:joined", onJoined)
			client.off("ws:error", onError)
			reject(new Error("Timed out joining session room"))
		}, 10_000)

		const onJoined = (payload: { kind: string; roomId?: string }) => {
			if (payload.kind !== "session" || payload.roomId !== roomId) {
				return
			}
			window.clearTimeout(timeout)
			client.off("ws:joined", onJoined)
			client.off("ws:error", onError)
			joinedSessionRooms.add(roomId)
			resolve()
		}

		const onError = (payload: { code: string; message: string }) => {
			if (payload.code !== "session_forbidden") {
				return
			}
			window.clearTimeout(timeout)
			client.off("ws:joined", onJoined)
			client.off("ws:error", onError)
			reject(new Error(payload.message))
		}

		client.on("ws:joined", onJoined)
		client.on("ws:error", onError)
		client.emit("join-session", { roomId })
	})
}

export function leaveSessionRoom(roomId: string): void {
	if (!joinedSessionRooms.has(roomId)) {
		return
	}
	joinedSessionRooms.delete(roomId)
	emitQlegalClientEvent("leave-session", { roomId })
}

export function destroyQlegalSocket(): void {
	if (!socket) {
		return
	}
	socket.removeAllListeners()
	socket.disconnect()
	socket = null
	qlegalEventHandlers.clear()
	bufferedRecordingNotice = null
}

export function subscribeQlegalEvent<K extends keyof QlegalServerToClientEvents>(
	event: K,
	handler: QlegalServerToClientEvents[K]
): () => void {
	const listener = handler as (payload: unknown) => void
	let handlers = qlegalEventHandlers.get(event)
	if (!handlers) {
		handlers = new Set()
		qlegalEventHandlers.set(event, handlers)
	}
	handlers.add(listener)
	if (event === "session:recording-notice" && bufferedRecordingNotice) {
		window.setTimeout(() => listener(bufferedRecordingNotice), 0)
	}
	getQlegalSocket()
	return () => {
		handlers?.delete(listener)
	}
}

export function emitQlegalClientEvent(
	event:
		| "ping"
		| "join-session"
		| "leave-session"
		| "join-dm"
		| "leave-dm"
		| "dm:typing"
		| "session:recording-notice",
	payload?: unknown
): void {
	const client = getQlegalSocket()
	client.emit(event, payload)
}

/** Like {@link emitQlegalClientEvent} but waits until the socket is connected first. */
export async function emitQlegalClientEventAsync(
	event:
		| "ping"
		| "join-session"
		| "leave-session"
		| "join-dm"
		| "leave-dm"
		| "dm:typing"
		| "session:recording-notice",
	payload?: unknown
): Promise<void> {
	ensureQlegalSocketConnected()
	await whenSocketConnected()
	emitQlegalClientEvent(event, payload)
}
