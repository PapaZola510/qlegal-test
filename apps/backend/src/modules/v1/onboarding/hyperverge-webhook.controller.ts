import { BadRequestException, Controller, HttpCode, Post, Req, Res } from "@nestjs/common"
import { AllowAnonymous } from "@thallesp/nestjs-better-auth"
import type { Request, Response } from "express"

import { HypervergeWebhookService } from "./hyperverge-webhook.service"

@Controller({ path: "onboarding/hyperverge", version: "1" })
@AllowAnonymous()
export class HypervergeWebhookController {
	constructor(private readonly webhook: HypervergeWebhookService) {}

	@Post("webhook")
	@HttpCode(204)
	async receive(@Req() req: Request, @Res() res: Response): Promise<void> {
		const raw = req.rawBody
		if (!raw) {
			throw new BadRequestException("Missing raw body for signature verification")
		}

		this.webhook.assertValidSignature(req.headers as Record<string, unknown>, raw)

		let json: unknown
		try {
			json = JSON.parse(raw.toString("utf8")) as unknown
		} catch {
			throw new BadRequestException("Invalid JSON")
		}

		await this.webhook.handleVerifiedJsonPayload(json)
		res.status(204).send()
	}
}
