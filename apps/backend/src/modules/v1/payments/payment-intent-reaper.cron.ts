import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"

import { env } from "@/config/env.config"

import { PaymentsService } from "./payments.service"

@Injectable()
export class PaymentIntentReaperCron {
	private readonly log = new Logger(PaymentIntentReaperCron.name)

	constructor(private readonly payments: PaymentsService) {}

	@Cron(CronExpression.EVERY_MINUTE)
	async reap(): Promise<void> {
		try {
			const n = await this.payments.expireStalePendingIntents(
				env.PAYMENT_INTENT_PENDING_MAX_AGE_MINUTES
			)
			if (n > 0) {
				this.log.log(JSON.stringify({ event: "payment_intent_reaper", cancelledPending: n }))
			}
		} catch (error) {
			this.log.error("payment_intent_reaper failed", error as Error)
		}
	}
}
