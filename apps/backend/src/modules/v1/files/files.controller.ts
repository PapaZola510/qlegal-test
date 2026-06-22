import {
	BadRequestException,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	Post,
	Req,
	Res,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { randomUUID } from "node:crypto"
import * as os from "node:os"
import * as path from "node:path"
import type { Express, Request, Response } from "express"
import { diskStorage } from "multer"

import { SlidingWindowRateLimitService } from "@/common/rate-limit/sliding-window-rate-limit.service"
import { SessionContextInterceptor } from "@/common/session/session-context.interceptor"
import { env } from "@/config/env.config"
import { AuditEvent } from "@/shared/decorators/audit-event.decorator"
import { Roles } from "@/shared/decorators/roles.decorator"
import { TenantSubOrgFromInput } from "@/shared/decorators/tenant-sub-org.decorator"
import { FileObjectTenancyGuard } from "@/shared/guards/file-object-tenancy.guard"
import { QlegalSessionGuard } from "@/shared/guards/qlegal-session.guard"
import { RoleGuard } from "@/shared/guards/role.guard"
import { TenancyGuard } from "@/shared/guards/tenancy.guard"

import { SESSION_RECORDING_MAX_BYTES } from "./file-buckets"
import { FilesService } from "./files.service"

const uploadLimitsBytes = SESSION_RECORDING_MAX_BYTES

const multerOptions = {
	storage: diskStorage({
		destination: (_req, _file, cb) => {
			cb(null, os.tmpdir())
		},
		filename: (_req, file, cb) => {
			const ext = path.extname(file.originalname) || ".bin"
			cb(null, `${randomUUID()}${ext}`)
		},
	}),
	limits: { fileSize: uploadLimitsBytes },
}

@Controller({ path: "files", version: "1" })
@UseGuards(QlegalSessionGuard)
export class FilesController {
	constructor(
		private readonly filesService: FilesService,
		private readonly rateLimit: SlidingWindowRateLimitService
	) {}

	@Post()
	@UseInterceptors(SessionContextInterceptor, FileInterceptor("file", multerOptions))
	@TenantSubOrgFromInput("sub_org_id")
	@UseGuards(TenancyGuard, RoleGuard)
	@Roles("enp")
	async upload(
		@UploadedFile() file: Express.Multer.File | undefined,
		@Req() req: Request
	): Promise<{ fileObjectId: string }> {
		if (!file) {
			throw new BadRequestException("Multipart field `file` is required")
		}
		const q = req.qlegalSessionContext
		if (!q) {
			throw new BadRequestException("Missing session")
		}
		this.rateLimit.check(`file-upload:${q.userId}`, {
			limit: env.FILE_UPLOAD_RATE_LIMIT_MAX,
			windowMs: env.FILE_UPLOAD_RATE_LIMIT_WINDOW_MS,
			message: "File upload rate limit exceeded. Try again later.",
		})
		const subOrgId = String(req.query["sub_org_id"] ?? "")
		const body = req.body as Record<string, unknown>
		return this.filesService.uploadMultipart({
			subOrgId,
			userId: q.userId,
			file,
			rawBucket: body["bucket"],
			rawPurpose: body["purpose"],
			bodySubOrgId: body["sub_org_id"],
		})
	}

	/**
	 * Client-friendly upload path for document-review attachments. The caller
	 * supplies the picked notary's user id (`notary_id`) instead of a sub-org;
	 * the server resolves the sub-org from the notary's ENP profile. This is
	 * how clients can attach files without belonging to a sub-org themselves.
	 */
	@Post("for-notary")
	@UseInterceptors(SessionContextInterceptor, FileInterceptor("file", multerOptions))
	async uploadForNotary(
		@UploadedFile() file: Express.Multer.File | undefined,
		@Req() req: Request
	): Promise<{ fileObjectId: string }> {
		if (!file) {
			throw new BadRequestException("Multipart field `file` is required")
		}
		const q = req.qlegalSessionContext
		if (!q) {
			throw new BadRequestException("Missing session")
		}
		this.rateLimit.check(`file-upload:${q.userId}`, {
			limit: env.FILE_UPLOAD_RATE_LIMIT_MAX,
			windowMs: env.FILE_UPLOAD_RATE_LIMIT_WINDOW_MS,
			message: "File upload rate limit exceeded. Try again later.",
		})
		const body = req.body as Record<string, unknown>
		const rawNotaryId = body["notary_id"] ?? req.query["notary_id"]
		if (typeof rawNotaryId !== "string" || rawNotaryId.trim().length === 0) {
			throw new BadRequestException("Form field `notary_id` is required")
		}
		return this.filesService.uploadAppointmentAttachmentForNotary({
			notaryUserId: rawNotaryId.trim(),
			userId: q.userId,
			file,
		})
	}

	@Post("commission-opposition")
	@UseInterceptors(SessionContextInterceptor, FileInterceptor("file", multerOptions))
	async uploadCommissionOpposition(
		@UploadedFile() file: Express.Multer.File | undefined,
		@Req() req: Request
	): Promise<{ applicationId: string; fileObjectId: string }> {
		if (!file) {
			throw new BadRequestException("Multipart field `file` is required")
		}
		const q = req.qlegalSessionContext
		if (!q) {
			throw new BadRequestException("Missing session")
		}
		this.rateLimit.check(`file-upload:${q.userId}`, {
			limit: env.FILE_UPLOAD_RATE_LIMIT_MAX,
			windowMs: env.FILE_UPLOAD_RATE_LIMIT_WINDOW_MS,
			message: "File upload rate limit exceeded. Try again later.",
		})
		const body = req.body as Record<string, unknown>
		const rawHearingRoomId = body["hearing_room_id"] ?? req.query["hearing_room_id"]
		if (typeof rawHearingRoomId !== "string" || rawHearingRoomId.trim().length === 0) {
			throw new BadRequestException("Form field `hearing_room_id` is required")
		}
		return this.filesService.uploadCommissionOpposition({
			hearingRoomId: rawHearingRoomId.trim(),
			userId: q.userId,
			file,
		})
	}

	@Get(":id")
	@UseInterceptors(SessionContextInterceptor)
	@UseGuards(FileObjectTenancyGuard)
	async download(
		@Param("id") id: string,
		@Req() req: Request,
		@Res() res: Response
	): Promise<void> {
		const variant = typeof req.query["variant"] === "string" ? req.query["variant"] : undefined
		const q = req.qlegalSessionContext!
		if (variant === "signed") {
			const payload = await this.filesService.getSignedDownloadUrl(id, q, 3600)
			res.status(200).json(payload)
			return
		}
		const { stream, contentType, contentLength } = await this.filesService.openDownloadStream(id, q)
		res.setHeader("Content-Type", contentType)
		if (contentLength > 0) {
			res.setHeader("Content-Length", String(contentLength))
		}
		stream.pipe(res)
	}

	@Delete(":id")
	@HttpCode(204)
	@UseInterceptors(SessionContextInterceptor)
	@UseGuards(FileObjectTenancyGuard)
	@AuditEvent({ eventType: "files.soft_deleted", targetTable: "file_objects" })
	async remove(@Param("id") id: string, @Req() req: Request): Promise<void> {
		const q = req.qlegalSessionContext!
		await this.filesService.softDelete(id, q)
	}
}
