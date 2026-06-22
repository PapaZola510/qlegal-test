import { Module } from "@nestjs/common"

import { HitpayModule } from "@/services/hitpay/hitpay.module"
import { TlpeModule } from "@/services/tlpe/tlpe.module"

import { EventsModule } from "../events/events.module"
import { PaymentHitpayWebhookController } from "./payment-hitpay-webhook.controller"
import { PaymentHitpayWebhookService } from "./payment-hitpay-webhook.service"
import { PaymentIntentReaperCron } from "./payment-intent-reaper.cron"
import { PaymentTlpeWebhookController } from "./payment-tlpe-webhook.controller"
import { PaymentTlpeWebhookService } from "./payment-tlpe-webhook.service"
import { PaymentWebhookController } from "./payment-webhook.controller"
import { PaymentWebhookService } from "./payment-webhook.service"
import { PaymentsController } from "./payments.controller"
import { PaymentsService } from "./payments.service"

@Module({
	imports: [HitpayModule, TlpeModule, EventsModule],
	controllers: [
		PaymentsController,
		PaymentWebhookController,
		PaymentHitpayWebhookController,
		PaymentTlpeWebhookController,
	],
	providers: [
		PaymentsService,
		PaymentWebhookService,
		PaymentHitpayWebhookService,
		PaymentTlpeWebhookService,
		PaymentIntentReaperCron,
	],
	exports: [PaymentsService],
})
export class PaymentsModule {}
