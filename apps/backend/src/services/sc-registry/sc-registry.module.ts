import { Global, Module } from "@nestjs/common"

import { ScRegistryAdapterService } from "./sc-registry-adapter.service"

@Global()
@Module({
	providers: [ScRegistryAdapterService],
	exports: [ScRegistryAdapterService],
})
export class ScRegistryModule {}
