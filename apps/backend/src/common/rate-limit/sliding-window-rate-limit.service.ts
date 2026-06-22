import { Injectable } from "@nestjs/common"
import { ORPCError } from "@orpc/server"

export type SlidingWindowRateLimitParams = {
	limit: number
	windowMs: number
	message: string
}

/**
 * In-process sliding-window rate limiter (per-instance). Not suitable for multi-node
 * fan-out without a shared store; see G1 runbook.
 */
@Injectable()
export class SlidingWindowRateLimitService {
	private readonly hits = new Map<string, number[]>()

	check(key: string, params: SlidingWindowRateLimitParams): void {
		const { limit, windowMs, message } = params
		const now = Date.now()
		const arr = (this.hits.get(key) ?? []).filter(t => now - t < windowMs)
		if (arr.length >= limit) {
			throw new ORPCError("TOO_MANY_REQUESTS", { message })
		}
		arr.push(now)
		this.hits.set(key, arr)
	}
}
