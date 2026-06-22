import { env } from "@/env"

export function avRecordingStreamHref(fileObjectId: string, download = false): string {
	const base = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
	const query = download ? "?download=1" : ""
	return `${base}/v1/compliance/recordings/${encodeURIComponent(fileObjectId)}/stream${query}`
}

export function avRecordingDownloadFilename(fileObjectId: string, mime: string): string {
	if (mime.includes("webm")) return `av-recording-${fileObjectId.slice(0, 8)}.webm`
	if (mime.includes("mp4")) return `av-recording-${fileObjectId.slice(0, 8)}.mp4`
	return `av-recording-${fileObjectId.slice(0, 8)}.bin`
}
