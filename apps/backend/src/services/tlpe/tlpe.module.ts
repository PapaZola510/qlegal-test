import { Module } from "@nestjs/common"

import { TlpeService } from "./tlpe.service"

@Module({
	providers: [TlpeService],
	exports: [TlpeService],
})
export class TlpeModule {}
