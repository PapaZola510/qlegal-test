import { ForbiddenException, Injectable } from "@nestjs/common"
import type { Server } from "socket.io"

import { EventsWsMetricsService } from "./events-ws.metrics"
import { dmRoom, sessionRoom, userRoom } from "./events-ws.rooms"

/**
 * Server-side emit helpers for feature modules (sessions, DMs, notifications).
 * Uses the same room naming as {@link EventsGateway}.
 */
@Injectable()
export class EventsService {
	private server: Server | null = null

	constructor(private readonly metrics: EventsWsMetricsService) {}

	/**
	 * Called once from {@link EventsGateway} after the Socket.IO server is ready.
	 */
	attachServer(server: Server): void {
		this.server = server
	}

	emitToSession(roomId: string, event: string, data: unknown): void {
		this.server?.to(sessionRoom(roomId)).emit(event, data)
	}

	emitToDm(conversationId: string, event: string, data: unknown): void {
		this.server?.to(dmRoom(conversationId)).emit(event, data)
	}

	/**
	 * Push to every tab where the target user has an authenticated connection.
	 */
	emitToUser(targetUserId: string, event: string, data: unknown): void {
		this.server?.to(userRoom(targetUserId)).emit(event, data)
	}

	/**
	 * Same as {@link emitToUser} but rejects when the acting user is not the recipient.
	 * Use from user-scoped HTTP/oRPC handlers to prevent mis-wired cross-user pushes.
	 */
	emitToUserScoped(actorUserId: string, targetUserId: string, event: string, data: unknown): void {
		if (actorUserId !== targetUserId) {
			this.metrics.onCrossUserReject(actorUserId, targetUserId, event)
			throw new ForbiddenException("Cross-user WebSocket emit rejected")
		}
		this.emitToUser(targetUserId, event, data)
	}
}
