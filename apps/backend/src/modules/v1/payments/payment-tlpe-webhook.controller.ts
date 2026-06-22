import { BadRequestException, Controller, HttpCode, Post, Req, Res } from "@nestjs/common"
import { AllowAnonymous } from "@thallesp/nestjs-better-auth"
import type { Request, Response } from "express"

import { PaymentTlpeWebhookService } from "./payment-tlpe-webhook.service"

@Controller({ path: "payments/tlpe", version: "1" })
@AllowAnonymous()
export class PaymentTlpeWebhookController {
	constructor(private readonly webhook: PaymentTlpeWebhookService) {}

	/** TLPE Notify Payment Result — https://developers.tlpe.io/post-notify-payment-result/ */
	@Post("webhook")
	@HttpCode(204)
	async receive(@Req() req: Request, @Res() res: Response): Promise<void> {
		const raw = req.rawBody
		if (!raw) {
			throw new BadRequestException("Missing raw body for TLPE notify")
		}

		await this.webhook.handleRawWebhook(req.headers as Record<string, unknown>, raw)
		res.status(204).send()
	}
}
