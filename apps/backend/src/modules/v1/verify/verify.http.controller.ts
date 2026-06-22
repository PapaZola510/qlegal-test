import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpException,
	InternalServerErrorException,
	Param,
	Post,
	Req,
	Res,
	UploadedFile,
	UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { randomUUID } from "node:crypto"
import { readFile, unlink } from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import type { Express, Request, Response } from "express"
import { diskStorage } from "multer"

import { getClientIp } from "@/common/http/client-ip"
import { SlidingWindowRateLimitService } from "@/common/rate-limit/sliding-window-rate-limit.service"
import { env } from "@/config/env.config"

import { VerifyService } from "./verify.service"

const VERIFY_PDF_MAX_BYTES = 20 * 1024 * 1024

const verifyUploadMulter = {
	storage: diskStorage({
		destination: (_req, _file, cb) => cb(null, os.tmpdir()),
		filename: (_req, file, cb) => {
			const ext = path.extname(file.originalname) || ".pdf"
			cb(null, `${randomUUID()}${ext}`)
		},
	}),
	limits: { fileSize: VERIFY_PDF_MAX_BYTES },
}

/**
 * Public HTTP endpoints for DocOnChain document verification (code JSON + multipart PDF).
 */
@Controller({ path: "verify/document", version: "1" })
export class VerifyHttpController {
	constructor(
		private readonly service: VerifyService,
		private readonly rateLimit: SlidingWindowRateLimitService
	) {}

	@Post()
	async verifyByCode(
		@Req() req: Request,
		@Body()
		body: {
			code?: string
			qrCode?: string
			qr_code?: string
			actNumber?: string
			act_number?: string
			projectUuid?: string
			project_uuid?: string
		}
	) {
		this.checkRateLimit(req)
		return this.service.verifyDocument({
			code: body.code ?? body.qrCode ?? body.qr_code,
			actNumber: body.actNumber ?? body.act_number,
			projectUuid: body.projectUuid ?? body.project_uuid,
		})
	}

	private checkRateLimit(req: Request) {
		this.rateLimit.check(`verify-document:${getClientIp(req)}`, {
			limit: env.VERIFY_DOCUMENT_RATE_LIMIT_PER_IP,
			windowMs: 60_000,
			message: "Too many verification requests from this address. Try again in a minute.",
		})
	}

	@Post("upload")
	@UseInterceptors(FileInterceptor("file", verifyUploadMulter))
	async verifyUpload(@Req() req: Request, @UploadedFile() file: Express.Multer.File | undefined) {
		this.checkRateLimit(req)
		const body = (req.body ?? {}) as Record<string, unknown>
		const code = String(body.code ?? body.qr_code ?? "").trim() || undefined
		const actNumber = String(body.act_number ?? "").trim() || undefined
		const projectUuid = String(body.project_uuid ?? "").trim() || undefined

		if (!file && !code) {
			throw new BadRequestException("Upload a PDF file and/or provide a document code.")
		}

		let pdf: Buffer | undefined
		if (file?.path) {
			try {
				pdf = await readFile(file.path)
			} finally {
				await unlink(file.path).catch(() => undefined)
			}
		}

		return this.service.verifyDocument({
			code,
			actNumber,
			projectUuid,
			pdf,
			filename: file?.originalname,
		})
	}

	@Get("certificate/:accessKey")
	async streamCertificate(
		@Req() req: Request,
		@Param("accessKey") accessKey: string,
		@Res() res: Response
	): Promise<void> {
		this.checkRateLimit(req)
		const download =
			req.query["download"] === "1" ||
			req.query["download"] === "true" ||
			req.query["download"] === "attachment"

		try {
			await this.service.streamCertificateOfCompletion(accessKey, res, { download })
		} catch (e) {
			if (res.headersSent) return
			if (e instanceof HttpException) throw e
			const msg = e instanceof Error ? e.message : String(e)
			throw new InternalServerErrorException(msg.slice(0, 500))
		}
	}
}
