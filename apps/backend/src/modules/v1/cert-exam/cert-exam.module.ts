import { Module } from "@nestjs/common"

import { emailAdapterProvider } from "@/services/email/email-adapter.provider"

import { CertExamExpiryCron } from "./cert-exam-expiry.cron"
import { CertExamController } from "./cert-exam.controller"
import { CertExamService } from "./cert-exam.service"

@Module({
	controllers: [CertExamController],
	providers: [CertExamService, CertExamExpiryCron, emailAdapterProvider],
})
export class CertExamModule {}
