import {
	Controller,
	Get,
	HttpException,
	InternalServerErrorException,
	Param,
	Req,
	Res,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request, Response } from "express"

import { SessionContextInterceptor } from "@/common/session/session-context.interceptor"
import { QlegalSessionGuard } from "@/shared/guards/qlegal-session.guard"

import { RegistryService } from "./registry.service"

@Controller({ path: "registry/acts", version: "1" })
@UseGuards(QlegalSessionGuard)
export class RegistryActNotarizedController {
	constructor(private readonly registry: RegistryService) {}

	@Get(":actId/notarized-pdf")
	@UseInterceptors(SessionContextInterceptor)
	async streamNotarizedPdf(
		@Param("actId") actId: string,
		@Session() session: UserSession,
		@Req() req: Request,
		@Res() res: Response
	): Promise<void> {
		const userId = session.user?.id
		if (!userId) {
			res.status(401).json({ message: "Authentication required" })
			return
		}

		const hasEnp = await this.registry.userHasEnpProfile(userId)
		if (!hasEnp) {
			res.status(403).json({ message: "Notary (ENP) access required" })
			return
		}

		const download =
			req.query["download"] === "1" ||
			req.query["download"] === "true" ||
			req.query["download"] === "attachment"

		try {
			await this.registry.streamActNotarizedPdf(userId, actId, res, { download })
		} catch (e) {
			if (res.headersSent) return
			if (e instanceof HttpException) throw e
			const msg = e instanceof Error ? e.message : String(e)
			throw new InternalServerErrorException(msg.slice(0, 500))
		}
	}
}
