import { Module } from "@nestjs/common"

import { EnpDocumentTypesController } from "./enp-document-types.controller"
import { EnpDocumentTypesService } from "./enp-document-types.service"

@Module({
	controllers: [EnpDocumentTypesController],
	providers: [EnpDocumentTypesService],
	exports: [EnpDocumentTypesService],
})
export class EnpDocumentTypesModule {}
