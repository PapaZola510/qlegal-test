import {
	Controller,
	Get,
	HttpException,
	InternalServerErrorException,
	Param,
	Req,
	Res,
	Session,
	UseGuards,
} from "@nestjs/common"
import type { UserSession } from "@thallesp/nestjs-better-auth"
import type { Request, Response } from "express"

import { ComplianceAccessGuard } from "@/shared/guards/compliance-access.guard"
import { QlegalSessionGuard } from "@/shared/guards/qlegal-session.guard"

import { ComplianceAccessLogService } from "./access-log.service"
import { ComplianceAuditService } from "./compliance-audit.service"

/** Stream AV session recordings for compliance auditors (read-only, access-logged). */
@Controller({ path: "compliance/recordings", version: "1" })
@UseGuards(QlegalSessionGuard, ComplianceAccessGuard)
export class ComplianceAvRecordingController {
	constructor(
		private readonly audit: ComplianceAuditService,
		private readonly accessLog: ComplianceAccessLogService
	) {}

	@Get(":id/stream")
	async streamRecording(
		@Param("id") id: string,
		@Session() session: UserSession,
		@Req() req: Request,
		@Res() res: Response
	): Promise<void> {
		const actorUserId = session.user?.id
		if (!actorUserId) {
			res.status(401).json({ message: "Authentication required" })
			return
		}

		const download =
			req.query["download"] === "1" ||
			req.query["download"] === "true" ||
			req.query["download"] === "attachment"
		const hasRange = Boolean(req.headers.range)

		if (download) {
			await this.accessLog.append({
				actorUserId,
				actorRole: req.qlegalSessionContext?.role ?? null,
				action: "download_recording",
				targetType: "file_object",
				targetId: id,
			})
		} else if (!hasRange) {
			await this.accessLog.append({
				actorUserId,
				actorRole: req.qlegalSessionContext?.role ?? null,
				action: "view_recording",
				targetType: "file_object",
				targetId: id,
			})
		}

		try {
			await this.audit.streamAvRecording(id, res, { download })
		} catch (e) {
			if (res.headersSent) return
			if (e instanceof HttpException) throw e
			const msg = e instanceof Error ? e.message : String(e)
			throw new InternalServerErrorException(msg.slice(0, 500))
		}
	}
}
