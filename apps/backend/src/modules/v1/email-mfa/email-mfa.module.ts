import { Module } from "@nestjs/common"

import { emailAdapterProvider } from "@/services/email/email-adapter.provider"

import { EmailMfaController } from "./email-mfa.controller"
import { EmailMfaService } from "./email-mfa.service"

@Module({
	controllers: [EmailMfaController],
	providers: [EmailMfaService, emailAdapterProvider],
})
export class EmailMfaModule {}
