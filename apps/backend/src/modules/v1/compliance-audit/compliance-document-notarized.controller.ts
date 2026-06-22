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

import { RegistryService } from "@/modules/v1/registry/registry.service"
import { ComplianceAccessGuard } from "@/shared/guards/compliance-access.guard"
import { QlegalSessionGuard } from "@/shared/guards/qlegal-session.guard"

import { ComplianceAccessLogService } from "./access-log.service"
import { ComplianceAuditService } from "./compliance-audit.service"

/** Stream notarized PDF for compliance auditors (read-only, access-logged). */
@Controller({ path: "compliance/documents", version: "1" })
@UseGuards(QlegalSessionGuard, ComplianceAccessGuard)
export class ComplianceDocumentNotarizedController {
	constructor(
		private readonly audit: ComplianceAuditService,
		private readonly registry: RegistryService,
		private readonly accessLog: ComplianceAccessLogService
	) {}

	@Get(":actId/notarized-pdf")
	async streamNotarizedPdf(
		@Param("actId") actId: string,
		@Session() session: UserSession,
		@Req() req: Request,
		@Res() res: Response
	): Promise<void> {
		const actorUserId = session.user?.id
		if (!actorUserId) {
			res.status(401).json({ message: "Authentication required" })
			return
		}

		const doc = await this.audit.getNotarizedDocument(actId)
		await this.accessLog.append({
			actorUserId,
			actorRole: req.qlegalSessionContext?.role ?? null,
			action: "view_document",
			targetType: "registry_act",
			targetId: actId,
			context: { stream: "notarized-pdf", enpUserId: doc.enpUserId },
		})

		const download =
			req.query["download"] === "1" ||
			req.query["download"] === "true" ||
			req.query["download"] === "attachment"

		try {
			await this.registry.streamActNotarizedPdf(doc.enpUserId, actId, res, { download })
		} catch (e) {
			if (res.headersSent) return
			if (e instanceof HttpException) throw e
			const msg = e instanceof Error ? e.message : String(e)
			throw new InternalServerErrorException(msg.slice(0, 500))
		}
	}
}
