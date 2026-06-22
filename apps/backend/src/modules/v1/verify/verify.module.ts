import { Module } from "@nestjs/common"

import { DoconchainModule } from "@/services/doconchain/doconchain.module"

import { VerifyHttpController } from "./verify.http.controller"
import { VerifyService } from "./verify.service"

@Module({
	imports: [DoconchainModule],
	controllers: [VerifyHttpController],
	providers: [VerifyService],
})
export class VerifyModule {}
