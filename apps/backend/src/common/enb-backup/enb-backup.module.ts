import { Global, Module } from "@nestjs/common"

import { EnbBackupService } from "./enb-backup.service"

@Global()
@Module({
	providers: [EnbBackupService],
	exports: [EnbBackupService],
})
export class EnbBackupModule {}
