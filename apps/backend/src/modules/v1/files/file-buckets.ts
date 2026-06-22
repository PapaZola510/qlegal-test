import { BadRequestException, PayloadTooLargeException } from "@nestjs/common"

/** Matches `file_objects.bucket` in `@repo/db/schema`. */
export type QlegalFileBucket = "qlegal-kyc" | "qlegal-documents" | "qlegal-sessions"

/** Matches `file_objects.purpose` in `@repo/db/schema`. */
export type QlegalFilePurpose =
	| "kyc_id"
	| "kyc_liveness"
	| "kyc_national_id"
	| "qs_original"
	| "qs_signed"
	| "ai_analysis"
	| "session_recording"
	| "generated_certificate"
	| "registry_pdf"
	| "appointment_attachment"
	| "commission_application"
	| "commission_opposition"
	| "compliance_export"

const BUCKET_PURPOSES: Record<QlegalFileBucket, readonly QlegalFilePurpose[]> = {
	"qlegal-kyc": ["kyc_id", "kyc_liveness", "kyc_national_id"],
	"qlegal-documents": [
		"qs_original",
		"qs_signed",
		"ai_analysis",
		"generated_certificate",
		"registry_pdf",
		"appointment_attachment",
		"commission_application",
		"commission_opposition",
		"compliance_export",
	],
	"qlegal-sessions": ["session_recording"],
}

/** Long screen captures (20–30+ min) can exceed 2GB; keep in sync with meeting-recording multer limits. */
export const SESSION_RECORDING_MAX_BYTES = 4 * 1024 * 1024 * 1024

const BUCKET_MAX_BYTES: Record<QlegalFileBucket, number> = {
	"qlegal-kyc": 10 * 1024 * 1024,
	"qlegal-documents": 50 * 1024 * 1024,
	"qlegal-sessions": SESSION_RECORDING_MAX_BYTES,
}

export function assertPurposeForBucket(bucket: QlegalFileBucket, purpose: QlegalFilePurpose): void {
	if (!BUCKET_PURPOSES[bucket].includes(purpose)) {
		throw new BadRequestException(`purpose "${purpose}" is not allowed for bucket "${bucket}"`)
	}
}

export function maxBytesForBucket(bucket: QlegalFileBucket): number {
	return BUCKET_MAX_BYTES[bucket]
}

function isImageMime(mime: string): boolean {
	return mime.startsWith("image/")
}

function isVideoMime(mime: string): boolean {
	return mime.startsWith("video/")
}

function isAudioMime(mime: string): boolean {
	return mime.startsWith("audio/")
}

export function assertMimeAllowedForBucket(bucket: QlegalFileBucket, mime: string): void {
	const m = mime.toLowerCase()
	if (bucket === "qlegal-kyc") {
		if (m === "application/pdf" || isImageMime(m)) {
			return
		}
	}
	if (bucket === "qlegal-documents") {
		if (
			m === "application/pdf" ||
			m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
			isImageMime(m)
		) {
			return
		}
	}
	if (bucket === "qlegal-sessions") {
		if (
			isVideoMime(m) ||
			isAudioMime(m) ||
			m === "application/octet-stream" ||
			m === "application/webm"
		) {
			return
		}
	}
	throw new BadRequestException(`MIME type "${mime}" is not allowed for bucket "${bucket}"`)
}

export function assertFileSizeForBucket(bucket: QlegalFileBucket, sizeBytes: number): void {
	const max = maxBytesForBucket(bucket)
	if (sizeBytes > max) {
		throw new PayloadTooLargeException(
			`File exceeds maximum size of ${max} bytes for bucket "${bucket}"`
		)
	}
}
