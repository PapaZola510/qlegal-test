import { Global, Module } from "@nestjs/common"

import { FilesModule } from "@/modules/v1/files/files.module"

import { DoconchainAdapterService } from "./doconchain-adapter.service"
import { DoconchainProjectProvisionService } from "./doconchain-project-provision.service"

@Global()
@Module({
	imports: [FilesModule],
	providers: [DoconchainAdapterService, DoconchainProjectProvisionService],
	exports: [DoconchainAdapterService, DoconchainProjectProvisionService],
})
export class DoconchainModule {}
