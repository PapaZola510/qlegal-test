import { Module } from "@nestjs/common"

import { DoconchainModule } from "@/services/doconchain/doconchain.module"
import { NotarizedPdfArchiveModule } from "@/services/notarized-pdf/notarized-pdf-archive.module"
import { EnbBackupModule } from "@/common/enb-backup/enb-backup.module"
import { FilesModule } from "@/modules/v1/files/files.module"

import { RegistryActNotarizedController } from "./registry-act-notarized.controller"
import { RegistryController } from "./registry.controller"
import { RegistryService } from "./registry.service"

@Module({
	imports: [EnbBackupModule, DoconchainModule, FilesModule, NotarizedPdfArchiveModule],
	controllers: [RegistryController, RegistryActNotarizedController],
	providers: [RegistryService],
	exports: [RegistryService],
})
export class RegistryModule {}
