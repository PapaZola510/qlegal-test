import { Module } from "@nestjs/common"

import { CommissionHearingsModule } from "../commission-hearings/commission-hearings.module"
import { EventsModule } from "../events/events.module"
import { EnpCommissionApplicationsController } from "./enp-commission-applications.controller"
import { EnpCommissionApplicationsService } from "./enp-commission-applications.service"

@Module({
	imports: [CommissionHearingsModule, EventsModule],
	controllers: [EnpCommissionApplicationsController],
	providers: [EnpCommissionApplicationsService],
	exports: [EnpCommissionApplicationsService],
})
export class EnpCommissionApplicationsModule {}
