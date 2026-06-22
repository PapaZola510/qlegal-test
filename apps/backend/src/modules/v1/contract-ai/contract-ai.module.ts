import { Module } from "@nestjs/common"

import { FilesModule } from "../files/files.module"
import { AiFileResolveTokenStore } from "./ai-file-resolve-token.store"
import { AiServiceHttpClient } from "./ai-service-http.client"
import { ContractAiRateLimitService } from "./contract-ai-rate-limit.service"
import { ContractAiController } from "./contract-ai.controller"
import { ContractAiService } from "./contract-ai.service"
import { InternalAiResolveController } from "./internal-ai-resolve.controller"
import { InternalAiTokenGuard } from "./internal-ai-token.guard"

@Module({
	imports: [FilesModule],
	controllers: [ContractAiController, InternalAiResolveController],
	providers: [
		ContractAiService,
		AiServiceHttpClient,
		AiFileResolveTokenStore,
		ContractAiRateLimitService,
		InternalAiTokenGuard,
	],
})
export class ContractAiModule {}
