import { Module } from "@nestjs/common"

import { DoconchainModule } from "@/services/doconchain/doconchain.module"
import { FilesModule } from "@/modules/v1/files/files.module"

import { NotarizedPdfArchiveService } from "./notarized-pdf-archive.service"

@Module({
	imports: [FilesModule, DoconchainModule],
	providers: [NotarizedPdfArchiveService],
	exports: [NotarizedPdfArchiveService],
})
export class NotarizedPdfArchiveModule {}
