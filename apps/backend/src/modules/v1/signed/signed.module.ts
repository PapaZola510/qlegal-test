import { Module } from "@nestjs/common"

import { TlpeModule } from "@/services/tlpe/tlpe.module"

import { EventsModule } from "../events/events.module"
import { RegistryModule } from "../registry/registry.module"
import { CtcPaymentService } from "./ctc-payment.service"
import { SignedController } from "./signed.controller"
import { SignedService } from "./signed.service"

@Module({
	imports: [RegistryModule, TlpeModule, EventsModule],
	controllers: [SignedController],
	providers: [SignedService, CtcPaymentService],
	exports: [CtcPaymentService],
})
export class SignedModule {}
