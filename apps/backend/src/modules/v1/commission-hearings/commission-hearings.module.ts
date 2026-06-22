import { Module } from "@nestjs/common"

import { HitpayModule } from "@/services/hitpay/hitpay.module"
import { LiveKitEgressService } from "@/services/livekit/livekit-egress.service"
import { LiveKitTokenService } from "@/services/livekit/livekit-token.service"

import { EventsModule } from "../events/events.module"
import { CommissionHearingsController } from "./commission-hearings.controller"
import { CommissionHearingsService } from "./commission-hearings.service"

@Module({
	imports: [EventsModule, HitpayModule],
	controllers: [CommissionHearingsController],
	providers: [CommissionHearingsService, LiveKitTokenService, LiveKitEgressService],
	exports: [CommissionHearingsService],
})
export class CommissionHearingsModule {}
