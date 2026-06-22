import { BadRequestException, Controller, HttpCode, Post, Req, Res } from "@nestjs/common"
import { AllowAnonymous } from "@thallesp/nestjs-better-auth"
import type { Request, Response } from "express"

import { PaymentHitpayWebhookService } from "./payment-hitpay-webhook.service"

@Controller({ path: "payments/hitpay", version: "1" })
@AllowAnonymous()
export class PaymentHitpayWebhookController {
	constructor(private readonly webhook: PaymentHitpayWebhookService) {}

	@Post("webhook")
	@HttpCode(204)
	async receive(@Req() req: Request, @Res() res: Response): Promise<void> {
		const raw = req.rawBody
		if (!raw) {
			throw new BadRequestException("Missing raw body for signature verification")
		}

		await this.webhook.handleRawWebhook(req.headers as Record<string, unknown>, raw)
		res.status(204).send()
	}
}
