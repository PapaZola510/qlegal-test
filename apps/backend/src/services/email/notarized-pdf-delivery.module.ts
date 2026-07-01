import { Module } from "@nestjs/common"

import { FilesModule } from "@/modules/v1/files/files.module"

import { LocalStorageService } from "@/services/storage/local-storage.service"
import { NotarizedPdfArchiveModule } from "@/services/notarized-pdf/notarized-pdf-archive.module"

import { emailAdapterProvider } from "./email-adapter.provider"
import { NotarizedPdfDeliveryService } from "./notarized-pdf-delivery.service"

@Module({
	imports: [FilesModule, NotarizedPdfArchiveModule],
	providers: [NotarizedPdfDeliveryService, emailAdapterProvider, LocalStorageService],
	exports: [NotarizedPdfDeliveryService],
})
export class NotarizedPdfDeliveryModule {}
