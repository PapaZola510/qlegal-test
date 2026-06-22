import { Module } from "@nestjs/common"

import { DoconchainModule } from "@/services/doconchain/doconchain.module"
import { NotarizedPdfArchiveModule } from "@/services/notarized-pdf/notarized-pdf-archive.module"

import { emailAdapterProvider } from "./email-adapter.provider"
import { NotarizedPdfDeliveryService } from "./notarized-pdf-delivery.service"

@Module({
	imports: [DoconchainModule, NotarizedPdfArchiveModule],
	providers: [NotarizedPdfDeliveryService, emailAdapterProvider],
	exports: [NotarizedPdfDeliveryService],
})
export class NotarizedPdfDeliveryModule {}
