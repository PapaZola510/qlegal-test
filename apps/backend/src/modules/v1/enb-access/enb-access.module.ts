import { Module } from "@nestjs/common"

import { RegistryModule } from "@/modules/v1/registry/registry.module"

import { EnbAccessController } from "./enb-access.controller"
import { EnbAccessService } from "./enb-access.service"

@Module({
	imports: [RegistryModule],
	controllers: [EnbAccessController],
	providers: [EnbAccessService],
})
export class EnbAccessModule {}
