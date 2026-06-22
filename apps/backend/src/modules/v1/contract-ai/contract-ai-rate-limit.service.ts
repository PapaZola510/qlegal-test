import { Injectable } from "@nestjs/common"

import { SlidingWindowRateLimitService } from "@/common/rate-limit/sliding-window-rate-limit.service"
import { env } from "@/config/env.config"

@Injectable()
export class ContractAiRateLimitService {
	constructor(private readonly sliding: SlidingWindowRateLimitService) {}

	check(userId: string): void {
		this.sliding.check(`contract-ai:${userId}`, {
			limit: env.CONTRACT_AI_RATE_LIMIT_MAX,
			windowMs: env.CONTRACT_AI_RATE_LIMIT_WINDOW_MS,
			message: "Contract AI rate limit exceeded. Try again later.",
		})
	}
}
