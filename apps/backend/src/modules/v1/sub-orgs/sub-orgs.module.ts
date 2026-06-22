import { Module } from "@nestjs/common"

import { SubOrgsController } from "./sub-orgs.controller"
import { SubOrgsService } from "./sub-orgs.service"

@Module({
	controllers: [SubOrgsController],
	providers: [SubOrgsService],
})
export class SubOrgsModule {}
