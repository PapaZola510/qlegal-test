import {
	BadRequestException,
	Controller,
	ForbiddenException,
	HttpException,
	Inject,
	Param,
	Post,
	Req,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { randomUUID } from "node:crypto"
import * as os from "node:os"
import * as path from "node:path"
import { ORPCError } from "@orpc/server"
import type { Express, Request } from "express"
import { diskStorage } from "multer"

import type { AppointmentAttachment } from "@repo/contracts"

import { SlidingWindowRateLimitService } from "@/common/rate-limit/sliding-window-rate-limit.service"
import { SessionContextInterceptor } from "@/common/session/session-context.interceptor"
import { env } from "@/config/env.config"
import { SESSION_RECORDING_MAX_BYTES } from "@/modules/v1/files/file-buckets"
import { FilesService } from "@/modules/v1/files/files.service"
import { QlegalSessionGuard } from "@/shared/guards/qlegal-session.guard"

import { AppointmentsService } from "./appointments.service"

function orpcErrorToHttpException(error: InstanceType<typeof ORPCError>): HttpException {
	const status =
		error.code === "BAD_REQUEST"
			? 400
			: error.code === "UNAUTHORIZED"
				? 401
				: error.code === "FORBIDDEN"
					? 403
					: error.code === "NOT_FOUND"
						? 404
						: error.code === "TOO_MANY_REQUESTS"
							? 429
							: error.code === "INTERNAL_SERVER_ERROR"
								? 500
								: 500
	return new HttpException({ message: error.message, statusCode: status }, status)
}

function assertCanUploadMeetingRecording(status: string): void {
	if (status === "in_session" || status === "ended") {
		return
	}
	throw new BadRequestException(
		"Recordings can only be uploaded during or immediately after a live session"
	)
}

/** Browsers and multer often send empty or non-standard MIME types for WebM captures. */
function normalizeRecordingUpload(file: Express.Multer.File): Express.Multer.File {
	const raw = (file.mimetype ?? "").trim().toLowerCase()
	const base = raw.split(";")[0]?.trim() ?? ""
	if (
		base.startsWith("video/") ||
		base.startsWith("audio/") ||
		base === "application/octet-stream" ||
		base === "application/webm"
	) {
		file.mimetype = base === "application/webm" ? "video/webm" : base
		return file
	}

	const ext = path.extname(file.originalname || "").toLowerCase()
	if (ext === ".webm") {
		file.mimetype = "video/webm"
		return file
	}
	if (ext === ".mp4") {
		file.mimetype = "video/mp4"
		return file
	}

	file.mimetype = "video/webm"
	return file
}

const multerOptions = {
	storage: diskStorage({
		destination: (_req: Request, _file: Express.Multer.File, cb) => {
			cb(null, os.tmpdir())
		},
		filename: (_req: Request, file: Express.Multer.File, cb) => {
			const ext = path.extname(file.originalname) || ".bin"
			cb(null, `${randomUUID()}${ext}`)
		},
	}),
	limits: { fileSize: 50 * 1024 * 1024 },
}

const recordingMulterOptions = {
	storage: diskStorage({
		destination: (_req: Request, _file: Express.Multer.File, cb) => {
			cb(null, os.tmpdir())
		},
		filename: (_req: Request, file: Express.Multer.File, cb) => {
			const ext = path.extname(file.originalname) || ".bin"
			cb(null, `${randomUUID()}${ext}`)
		},
	}),
	limits: { fileSize: SESSION_RECORDING_MAX_BYTES },
}

@Controller({ path: "appointments", version: "1" })
@UseGuards(QlegalSessionGuard)
export class MeetingDocumentsController {
	constructor(
		private readonly appointments: AppointmentsService,
		@Inject(FilesService) private readonly files: FilesService,
		private readonly rateLimit: SlidingWindowRateLimitService
	) {}

	@Post(":id/meeting-documents/principal-upload")
	@UseInterceptors(SessionContextInterceptor, FileInterceptor("file", multerOptions))
	async principalUpload(
		@Param("id") appointmentId: string,
		@UploadedFile() file: Express.Multer.File | undefined,
		@Req() req: Request
	): Promise<AppointmentAttachment> {
		if (!file) {
			throw new BadRequestException("Multipart field `file` is required")
		}
		const q = req.qlegalSessionContext
		if (!q?.userId) {
			throw new ForbiddenException("Authentication required")
		}

		this.rateLimit.check(`file-upload:${q.userId}`, {
			limit: env.FILE_UPLOAD_RATE_LIMIT_MAX,
			windowMs: env.FILE_UPLOAD_RATE_LIMIT_WINDOW_MS,
			message: "File upload rate limit exceeded. Try again later.",
		})

		const body = (req.body ?? {}) as Record<string, unknown>
		const documentName = String(body["document_name"] ?? "").trim()
		const documentType = String(body["document_type"] ?? "").trim()
		const enpDocumentTypeIdRaw = String(body["enp_document_type_id"] ?? "").trim()
		const enpDocumentTypeId = enpDocumentTypeIdRaw.length > 0 ? enpDocumentTypeIdRaw : undefined
		if (!documentName) {
			throw new BadRequestException("Multipart field `document_name` is required")
		}
		if (!documentType) {
			throw new BadRequestException("Multipart field `document_type` is required")
		}

		const { appointment, enpSubOrgId } =
			await this.appointments.resolveEnpSubOrgIdForAppointment(appointmentId)
		if (appointment.clientUserId !== q.userId) {
			throw new ForbiddenException("Only the booking client may upload as the principal")
		}
		if (appointment.status !== "in_session") {
			throw new BadRequestException(
				"Documents can only be uploaded while the meeting is in session"
			)
		}

		try {
			await this.appointments.assertMeetingDocumentUploadAllowed(appointmentId)
		} catch (error) {
			if (error instanceof ORPCError) {
				throw orpcErrorToHttpException(error)
			}
			throw error
		}

		const { fileObjectId } = await this.files.uploadMultipart({
			subOrgId: enpSubOrgId,
			userId: q.userId,
			file,
			rawBucket: "qlegal-documents",
			rawPurpose: "appointment_attachment",
		})

		return this.appointments.linkPrincipalMeetingDocument(q, appointmentId, {
			fileObjectId,
			documentName,
			documentType,
			enpDocumentTypeId,
		})
	}

	@Post(":id/meeting-recordings/upload")
	@UseInterceptors(SessionContextInterceptor, FileInterceptor("file", recordingMulterOptions))
	async uploadMeetingRecording(
		@Param("id") appointmentId: string,
		@UploadedFile() file: Express.Multer.File | undefined,
		@Req() req: Request
	) {
		if (!file) {
			throw new BadRequestException("Multipart field `file` is required")
		}
		const q = req.qlegalSessionContext
		if (!q?.userId) {
			throw new ForbiddenException("Authentication required")
		}

		try {
			this.rateLimit.check(`file-upload:${q.userId}`, {
				limit: env.FILE_UPLOAD_RATE_LIMIT_MAX,
				windowMs: env.FILE_UPLOAD_RATE_LIMIT_WINDOW_MS,
				message: "File upload rate limit exceeded. Try again later.",
			})
		} catch (e) {
			if (e instanceof ORPCError) throw orpcErrorToHttpException(e)
			throw e
		}

		const body = (req.body ?? {}) as Record<string, unknown>
		const fileName = String(
			body["file_name"] ?? file.originalname ?? "meeting-recording.webm"
		).trim()
		if (fileName.length > 255) {
			throw new BadRequestException("file_name must be 255 characters or fewer")
		}

		let appointment: Awaited<
			ReturnType<AppointmentsService["resolveEnpSubOrgIdForAppointment"]>
		>["appointment"]
		let enpSubOrgId: string
		try {
			const resolved = await this.appointments.resolveEnpSubOrgIdForAppointment(appointmentId)
			appointment = resolved.appointment
			enpSubOrgId = resolved.enpSubOrgId
		} catch (e) {
			if (e instanceof ORPCError) throw orpcErrorToHttpException(e)
			throw e
		}

		const isAssignedEnp = appointment.enpUserId === q.userId
		const isAssignedPrincipal = appointment.clientUserId === q.userId
		if (!isAssignedEnp && !isAssignedPrincipal) {
			throw new ForbiddenException(
				"Only the assigned ENP or principal may upload meeting recordings"
			)
		}
		assertCanUploadMeetingRecording(appointment.status)

		const normalizedFile = normalizeRecordingUpload(file)

		const { fileObjectId } = await this.files.uploadMultipart({
			subOrgId: enpSubOrgId,
			userId: q.userId,
			file: normalizedFile,
			rawBucket: "qlegal-sessions",
			rawPurpose: "session_recording",
		})

		try {
			return await this.appointments.linkMeetingRecording(q, appointmentId, {
				fileObjectId,
				fileName,
			})
		} catch (e) {
			if (e instanceof ORPCError) throw orpcErrorToHttpException(e)
			throw e
		}
	}
}
