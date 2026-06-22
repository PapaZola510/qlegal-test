import { Module } from "@nestjs/common"

import { AuthProfileController } from "./auth-profile.controller"
import { AuthProfileService } from "./auth-profile.service"
import { EnpScCommissionSyncCron } from "./enp-sc-commission-sync.cron"

@Module({
	controllers: [AuthProfileController],
	providers: [AuthProfileService, EnpScCommissionSyncCron],
})
export class AuthProfileModule {}
