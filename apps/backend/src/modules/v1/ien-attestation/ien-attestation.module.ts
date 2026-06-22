import { Module } from "@nestjs/common"

import { DoconchainAdapterService } from "@/services/doconchain/doconchain-adapter.service"

import { IenAttestationService } from "./ien-attestation.service"

@Module({
	providers: [IenAttestationService, DoconchainAdapterService],
	exports: [IenAttestationService],
})
export class IenAttestationModule {}
