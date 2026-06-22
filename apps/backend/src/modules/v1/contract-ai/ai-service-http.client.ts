import { Injectable, InternalServerErrorException } from "@nestjs/common"

import { env } from "@/config/env.config"

@Injectable()
export class AiServiceHttpClient {
	async postJson<T>(path: string, body: unknown): Promise<T> {
		const base = env.AI_SERVICE_BASE_URL?.trim()
		const token = env.CONTRACT_AI_INTERNAL_TOKEN?.trim()
		if (!base || !token) {
			throw new InternalServerErrorException("AI service is not configured")
		}
		const url = `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`
		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Internal-Token": token,
			},
			body: JSON.stringify(body),
		})
		if (!res.ok) {
			const text = await res.text()
			throw new InternalServerErrorException(
				`AI service error ${res.status}: ${text.slice(0, 800)}`
			)
		}
		return res.json() as Promise<T>
	}
}
