import { Controller, Get, Req, Res, UseGuards, UseInterceptors } from "@nestjs/common"
import type { Request, Response } from "express"

import { SessionContextInterceptor } from "@/common/session/session-context.interceptor"
import { QlegalSessionGuard } from "@/shared/guards/qlegal-session.guard"

import { IntegrationService } from "./integration.service"

@Controller({ path: "integration/lms/training/certificate", version: "1" })
@UseGuards(QlegalSessionGuard)
export class LmsCertificateDownloadController {
	constructor(private readonly integration: IntegrationService) {}

	@Get("download")
	@UseInterceptors(SessionContextInterceptor)
	async downloadCertificate(@Req() req: Request, @Res() res: Response): Promise<void> {
		const download =
			req.query["download"] === "1" ||
			req.query["download"] === "true" ||
			req.query["download"] === "attachment"
		const userId = req.qlegalSessionContext?.userId
		if (!userId) {
			res.status(401).json({ message: "Authentication required" })
			return
		}
		await this.integration.streamCertificateDownload(userId, res, { download })
	}
}
