import { Module } from "@nestjs/common"

import { IenAttestationService } from "./ien-attestation.service"

@Module({
	providers: [IenAttestationService],
	exports: [IenAttestationService],
})
export class IenAttestationModule {}
