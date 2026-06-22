import { Module } from "@nestjs/common"

import { emailAdapterProvider } from "@/services/email/email-adapter.provider"

import { EmailVerificationController } from "./email-verification.controller"
import { EmailVerificationHttpController } from "./email-verification.http.controller"
import { EmailVerificationService } from "./email-verification.service"

@Module({
	controllers: [EmailVerificationController, EmailVerificationHttpController],
	providers: [EmailVerificationService, emailAdapterProvider],
})
export class EmailVerificationModule {}
