import { Injectable } from "@nestjs/common"
import {
	EgressClient,
	EncodedFileOutput,
	EncodedFileType,
	S3Upload,
	type EgressInfo,
} from "livekit-server-sdk"

import { env } from "@/config/env.config"

export interface LiveKitRoomRecordingStartResult {
	egressId: string
	roomName: string
	s3Key: string
	info: EgressInfo
}

export interface LiveKitRoomRecordingStopResult {
	egressId: string
	roomName: string
	s3Key: string | null
	info: EgressInfo
}

@Injectable()
export class LiveKitEgressService {
	isConfigured(): boolean {
		const accessKey = env.LIVEKIT_EGRESS_S3_ACCESS_KEY_ID ?? env.S3_ACCESS_KEY_ID
		const secret = env.LIVEKIT_EGRESS_S3_SECRET_ACCESS_KEY ?? env.S3_SECRET_ACCESS_KEY
		return Boolean(
			env.LIVEKIT_URL?.trim() &&
			env.LIVEKIT_API_KEY?.trim() &&
			env.LIVEKIT_API_SECRET?.trim() &&
			accessKey?.trim() &&
			secret?.trim()
		)
	}

	private client(): EgressClient {
		const host = env.LIVEKIT_URL?.trim()
		const apiKey = env.LIVEKIT_API_KEY?.trim()
		const apiSecret = env.LIVEKIT_API_SECRET?.trim()
		if (!host || !apiKey || !apiSecret) {
			throw new Error(
				"LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET are required for egress"
			)
		}
		return new EgressClient(host, apiKey, apiSecret)
	}

	async startRoomRecording(roomName: string): Promise<LiveKitRoomRecordingStartResult> {
		const s3Key = this.recordingKey(roomName)
		const info = await this.client().startRoomCompositeEgress(
			roomName,
			new EncodedFileOutput({
				fileType: EncodedFileType.MP4,
				filepath: s3Key,
				output: {
					case: "s3",
					value: this.s3UploadConfig(),
				},
			}),
			{ layout: "grid" }
		)

		return {
			egressId: info.egressId,
			roomName,
			s3Key,
			info,
		}
	}

	async stopRoomRecording(egressId: string): Promise<LiveKitRoomRecordingStopResult> {
		const info = await this.client().stopEgress(egressId)
		return {
			egressId: info.egressId || egressId,
			roomName: info.roomName,
			s3Key: info.fileResults[0]?.filename ?? null,
			info,
		}
	}

	private s3UploadConfig(): S3Upload {
		const accessKey = env.LIVEKIT_EGRESS_S3_ACCESS_KEY_ID ?? env.S3_ACCESS_KEY_ID
		const secret = env.LIVEKIT_EGRESS_S3_SECRET_ACCESS_KEY ?? env.S3_SECRET_ACCESS_KEY
		if (!accessKey?.trim() || !secret?.trim()) {
			throw new Error("S3 credentials are required for LiveKit egress recording")
		}

		return new S3Upload({
			accessKey,
			secret,
			region: env.LIVEKIT_EGRESS_S3_REGION ?? env.S3_REGION ?? "us-east-1",
			endpoint: env.LIVEKIT_EGRESS_S3_ENDPOINT ?? env.S3_ENDPOINT ?? "",
			bucket: env.LIVEKIT_EGRESS_S3_BUCKET ?? "qlegal-sessions",
			forcePathStyle:
				(env.LIVEKIT_EGRESS_S3_FORCE_PATH_STYLE ?? env.S3_FORCE_PATH_STYLE) === "true",
		})
	}

	private recordingKey(roomName: string): string {
		const prefix = (env.LIVEKIT_EGRESS_S3_PREFIX ?? "commission-hearings").replace(/^\/+|\/+$/g, "")
		const safeRoom = roomName.replace(/[^a-zA-Z0-9._-]/g, "-")
		return `${prefix}/${safeRoom}/${Date.now()}.mp4`
	}
}
