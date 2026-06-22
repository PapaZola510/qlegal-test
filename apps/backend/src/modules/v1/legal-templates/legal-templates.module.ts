import { Module } from "@nestjs/common"

import { LegalTemplatesController } from "./legal-templates.controller"
import { LegalTemplatesService } from "./legal-templates.service"

@Module({
	controllers: [LegalTemplatesController],
	providers: [LegalTemplatesService],
})
export class LegalTemplatesModule {}
