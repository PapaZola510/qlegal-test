import { Injectable } from "@nestjs/common"
import { AccessToken, TrackSource } from "livekit-server-sdk"

import { env } from "@/config/env.config"

export type LiveKitParticipantRole =
	| "enp"
	| "client"
	| "guest_signer"
	| "admin_host"
	| "hearing_applicant"
	| "hearing_oppositor"

@Injectable()
export class LiveKitTokenService {
	/**
	 * Mints a short-lived JWT for joining a LiveKit room. Never exposes API secret to clients.
	 */
	async mintParticipantToken(args: {
		roomName: string
		identity: string
		displayName: string
		role: LiveKitParticipantRole
	}): Promise<string> {
		const apiKey = env.LIVEKIT_API_KEY
		const apiSecret = env.LIVEKIT_API_SECRET
		if (!apiKey?.trim() || !apiSecret?.trim()) {
			throw new Error("LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be configured to issue tokens")
		}

		const metadata = JSON.stringify({ role: args.role, displayName: args.displayName })
		const token = new AccessToken(apiKey, apiSecret, {
			identity: args.identity,
			name: args.displayName,
			metadata,
			ttl: "15m",
		})
		token.addGrant({
			roomJoin: true,
			room: args.roomName,
			canPublish: true,
			canSubscribe: true,
			canPublishData: true,
			// Explicit sources so principals/clients always get screen share (not only camera/mic).
			canPublishSources: [
				TrackSource.CAMERA,
				TrackSource.MICROPHONE,
				TrackSource.SCREEN_SHARE,
				TrackSource.SCREEN_SHARE_AUDIO,
			],
		})
		return token.toJwt()
	}

	livekitWsUrl(): string | undefined {
		const raw = env.LIVEKIT_URL?.trim()
		return raw || undefined
	}
}
