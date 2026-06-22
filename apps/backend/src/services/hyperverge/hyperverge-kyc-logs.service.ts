import { Injectable, Logger } from "@nestjs/common"

import { env } from "@/config/env.config"

import { HYPERVERGE_IDV_FALLBACK, hypervergeIdvApiBase } from "./hyperverge-idv-base"

export interface HyperVergeLogsApiResponse {
	status: string
	result?: Record<string, unknown>
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v)

const looksLikeUrl = (v: unknown): v is string =>
	typeof v === "string" && /^https?:\/\/\S+$/i.test(v)

export function pickBestFaceImageUrlFromLogs(logs: HyperVergeLogsApiResponse): string | null {
	const root = logs.result ?? {}
	const scoreKey = (k: string): number => {
		const key = k.toLowerCase()
		if (key.includes("cropped")) return 120
		if (key.includes("face")) return 100
		if (key.includes("selfie")) return 90
		if (key.includes("startkyc") || key.includes("link")) return -50
		return 10
	}

	const candidates: Array<{ url: string; score: number }> = []
	let visited = 0

	const walk = (node: unknown, depth: number, parentKey: string | null) => {
		if (visited++ > 700 || depth > 7) return
		if (looksLikeUrl(node) && parentKey) {
			const score = scoreKey(parentKey)
			if (score > 0) candidates.push({ url: node, score })
			return
		}
		if (Array.isArray(node)) {
			for (const item of node) walk(item, depth + 1, parentKey)
			return
		}
		if (isRecord(node)) {
			for (const [k, v] of Object.entries(node)) walk(v, depth + 1, k)
		}
	}

	walk(root, 0, null)
	candidates.sort((a, b) => b.score - a.score)
	return candidates[0]?.url ?? null
}

@Injectable()
export class HypervergeKycLogsService {
	private readonly logger = new Logger(HypervergeKycLogsService.name)

	async getKycLogs(transactionId: string): Promise<HyperVergeLogsApiResponse> {
		const appId = env.HYPERVERGE_APP_ID?.trim()
		const appKey = env.HYPERVERGE_APP_KEY?.trim()
		if (!appId || !appKey) {
			throw new Error("HyperVerge credentials not configured")
		}

		const body = {
			transactionId,
			sendUserDetails: "yes",
			generateNewLinks: "yes",
			bucketPathFlag: "yes",
			sendFlag: "no",
			includePreviousAttempts: "yes",
		}

		const idvBase = hypervergeIdvApiBase()
		const primary = `${idvBase}/v1/link-kyc/results`
		const fallback = `${HYPERVERGE_IDV_FALLBACK}/v1/link-kyc/results`

		const post = async (url: string) =>
			fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json", appId, appKey },
				body: JSON.stringify(body),
			})

		let response: Response
		try {
			response = await post(primary)
		} catch (e) {
			this.logger.warn(`Logs API primary failed: ${String(e)}`)
			response = await post(fallback)
		}

		const text = await response.text()
		if (!response.ok) {
			if (response.status === 404) {
				return { status: "failure", result: {} }
			}
			throw new Error(`HyperVerge Logs API error: ${response.status} - ${text.slice(0, 400)}`)
		}

		return JSON.parse(text) as HyperVergeLogsApiResponse
	}

	async fetchImageUrlAsDataUrl(url: string): Promise<string | null> {
		try {
			const imgRes = await fetch(url)
			if (!imgRes.ok) return null
			const contentType = imgRes.headers.get("content-type") ?? "image/jpeg"
			const arrayBuffer = await imgRes.arrayBuffer()
			const base64 = Buffer.from(arrayBuffer).toString("base64")
			return `data:${contentType};base64,${base64}`
		} catch {
			return null
		}
	}
}
