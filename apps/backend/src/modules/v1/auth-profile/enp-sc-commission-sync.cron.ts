import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"

import { syncAllStaleEnpScCommissionStatuses } from "@/modules/v1/auth-profile/lib/sync-enp-sc-commission-status"

@Injectable()
export class EnpScCommissionSyncCron {
	private readonly log = new Logger(EnpScCommissionSyncCron.name)

	@Cron(CronExpression.EVERY_6_HOURS)
	async refreshStaleStatuses(): Promise<void> {
		try {
			const count = await syncAllStaleEnpScCommissionStatuses()
			if (count > 0) {
				this.log.log(`Refreshed SC commission status for ${count} ENP profile(s).`)
			}
		} catch (error) {
			this.log.error("ENP SC commission status sweep failed", error as Error)
		}
	}
}
