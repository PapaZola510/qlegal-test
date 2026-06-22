import { Controller, Get, Param, Req, Res, UseGuards, UseInterceptors } from "@nestjs/common"
import type { Request, Response } from "express"

import { SessionContextInterceptor } from "@/common/session/session-context.interceptor"
import { QlegalSessionGuard } from "@/shared/guards/qlegal-session.guard"

import { MeetingSignersService } from "./meeting-signers.service"

@Controller({ path: "sessions/meetings", version: "1" })
@UseGuards(QlegalSessionGuard)
export class MeetingDocumentNotarizedController {
	constructor(private readonly meetingSigners: MeetingSignersService) {}

	@Get(":meetingId/documents/:documentId/notarized-pdf")
	@UseInterceptors(SessionContextInterceptor)
	async streamNotarizedPdf(
		@Param("meetingId") meetingId: string,
		@Param("documentId") documentId: string,
		@Req() req: Request,
		@Res() res: Response
	): Promise<void> {
		const download =
			req.query["download"] === "1" ||
			req.query["download"] === "true" ||
			req.query["download"] === "attachment"
		await this.meetingSigners.streamMeetingDocumentNotarizedPdf(
			req.qlegalSessionContext ?? null,
			meetingId,
			documentId,
			res,
			{ download }
		)
	}
}
