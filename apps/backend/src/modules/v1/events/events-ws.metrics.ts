import { Injectable, Logger } from "@nestjs/common"

/**
 * Lightweight counters and structured logs for the /events WebSocket gateway.
 */
@Injectable()
export class EventsWsMetricsService {
	private readonly logger = new Logger(EventsWsMetricsService.name)

	private connectCount = 0
	private disconnectCount = 0
	private authRejectedCount = 0
	private crossUserRejectCount = 0

	onAuthRejected(socketId: string, reason: string): void {
		this.authRejectedCount++
		this.logger.warn(
			`ws_auth_rejected count=${this.authRejectedCount} socketId=${socketId} reason=${reason}`
		)
	}

	onConnect(userId: string, socketId: string): void {
		this.connectCount++
		this.logger.log(`ws_connect total=${this.connectCount} userId=${userId} socketId=${socketId}`)
	}

	onDisconnect(userId: string | undefined, socketId: string, reason: string): void {
		this.disconnectCount++
		this.logger.log(
			`ws_disconnect total=${this.disconnectCount} userId=${userId ?? "unknown"} socketId=${socketId} reason=${reason}`
		)
	}

	onCrossUserReject(actorUserId: string, targetUserId: string, event: string): void {
		this.crossUserRejectCount++
		this.logger.warn(
			`ws_cross_user_rejected total=${this.crossUserRejectCount} actorUserId=${actorUserId} targetUserId=${targetUserId} event=${event}`
		)
	}
}
