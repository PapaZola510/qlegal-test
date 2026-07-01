import { Module } from "@nestjs/common"

import { LocalStorageService } from "@/services/storage/local-storage.service"
import { FilesModule } from "@/modules/v1/files/files.module"

import { NotarizedPdfArchiveService } from "./notarized-pdf-archive.service"

@Module({
	imports: [FilesModule],
	providers: [NotarizedPdfArchiveService, LocalStorageService],
	exports: [NotarizedPdfArchiveService],
})
export class NotarizedPdfArchiveModule {}
