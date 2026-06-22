import { Global, Module } from "@nestjs/common"

import { LmsSyncService } from "./lms-sync.service"
import { LmsClient } from "./lms.client"

@Global()
@Module({
	providers: [LmsClient, LmsSyncService],
	exports: [LmsClient, LmsSyncService],
})
export class LmsModule {}
