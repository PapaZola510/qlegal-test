import { Module } from "@nestjs/common"

import { HitpayService } from "./hitpay.service"

@Module({
	providers: [HitpayService],
	exports: [HitpayService],
})
export class HitpayModule {}
