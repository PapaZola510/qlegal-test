import { Module } from "@nestjs/common"

import { HypervergeKycLogsService } from "@/services/hyperverge/hyperverge-kyc-logs.service"
import { HypervergeClient } from "@/services/hyperverge/hyperverge.client"
import { IntegrationModule } from "@/modules/v1/integration/integration.module"

import { HypervergeWebhookController } from "./hyperverge-webhook.controller"
import { HypervergeWebhookService } from "./hyperverge-webhook.service"
import { OnboardingController } from "./onboarding.controller"
import { OnboardingService } from "./onboarding.service"

@Module({
	imports: [IntegrationModule],
	controllers: [OnboardingController, HypervergeWebhookController],
	providers: [
		OnboardingService,
		HypervergeClient,
		HypervergeKycLogsService,
		HypervergeWebhookService,
	],
	exports: [OnboardingService, HypervergeClient],
})
export class OnboardingModule {}
