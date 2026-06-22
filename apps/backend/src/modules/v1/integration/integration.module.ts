import { Module } from "@nestjs/common"

import { IntegrationController } from "./integration.controller"
import { IntegrationService } from "./integration.service"
import { LmsCertificateDownloadController } from "./lms-certificate-download.controller"

@Module({
	controllers: [IntegrationController, LmsCertificateDownloadController],
	providers: [IntegrationService],
	exports: [IntegrationService],
})
export class IntegrationModule {}
