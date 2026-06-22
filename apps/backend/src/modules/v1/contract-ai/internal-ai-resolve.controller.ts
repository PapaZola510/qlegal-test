import {
	BadRequestException,
	Body,
	Controller,
	NotFoundException,
	Post,
	UseGuards,
} from "@nestjs/common"
import { basename } from "node:path"

import { env } from "@/config/env.config"

import { FilesService } from "../files/files.service"
import { AiFileResolveTokenStore } from "./ai-file-resolve-token.store"
import { InternalAiTokenGuard } from "./internal-ai-token.guard"

@Controller({ path: "internal/ai", version: "1" })
@UseGuards(InternalAiTokenGuard)
export class InternalAiResolveController {
	constructor(
		private readonly tokenStore: AiFileResolveTokenStore,
		private readonly filesService: FilesService
	) {}

	/**
	 * Private callback for the Python AI service: exchange one-time token for a short-lived GET URL.
	 * Not for browser use; blocked from public ingress at the edge.
	 */
	@Post("resolve-download")
	async resolveDownload(
		@Body() body: { resolveToken?: string }
	): Promise<{ downloadUrl: string; filename: string }> {
		const token = typeof body?.resolveToken === "string" ? body.resolveToken : ""
		if (!token) {
			throw new BadRequestException("resolveToken is required")
		}
		const payload = this.tokenStore.consume(token)
		if (!payload) {
			throw new NotFoundException()
		}
		const row = await this.filesService.getActiveRecordForTenant(
			payload.fileObjectId,
			payload.subOrgIds
		)
		if (!row) {
			throw new NotFoundException()
		}
		const { url } = await this.filesService.getSignedDownloadUrlForTenant(
			payload.fileObjectId,
			payload.subOrgIds,
			env.CONTRACT_AI_SIGNED_URL_TTL_SECONDS ?? 120
		)
		return { downloadUrl: url, filename: basename(row.s3Key) }
	}
}
