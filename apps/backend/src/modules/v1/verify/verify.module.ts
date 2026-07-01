import { Module } from "@nestjs/common"

import { VerifyHttpController } from "./verify.http.controller"
import { VerifyService } from "./verify.service"

@Module({
	controllers: [VerifyHttpController],
	providers: [VerifyService],
})
export class VerifyModule {}
