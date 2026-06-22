import { Global, Module } from "@nestjs/common"

import { SlidingWindowRateLimitService } from "./sliding-window-rate-limit.service"

@Global()
@Module({
	providers: [SlidingWindowRateLimitService],
	exports: [SlidingWindowRateLimitService],
})
export class RateLimitModule {}
