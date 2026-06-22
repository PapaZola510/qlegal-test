import { Injectable, Logger } from "@nestjs/common"
import { randomUUID } from "node:crypto"

import { env } from "@/config/env.config"

import {
	HYPERVERGE_IDV_DEFAULT,
	HYPERVERGE_IDV_FALLBACK,
	hypervergeIdvApiBase,
} from "./hyperverge-idv-base"
import type { HypervergeWorkflowKind } from "./hyperverge-workflow"

const DEFAULT_ONBOARDING_WORKFLOW = "workflow_onboarding"
const DEFAULT_LIVENESS_WORKFLOW = "workflow_liveness"

export interface HypervergeStartAttemptResult {
	transactionId: string
	sdkToken: string | null
	appId: string | null
	workflowId: string
	sdkVersion: string
}

interface AuthTokenApiResponse {
	status: string
	statusCode?: number
	result?: {
		authToken: string
	}
}

function idvPrimaryBase(): string {
	return hypervergeIdvApiBase()
}

/**
 * HyperVerge Web SDK auth: POST {idv}/v2/auth/token (transaction-scoped).
 * @see https://documentation.hyperverge.co/other-resources/authentication
 */
@Injectable()
export class HypervergeClient {
	private readonly logger = new Logger(HypervergeClient.name)

	resolveWorkflowId(workflowKind: HypervergeWorkflowKind = "onboarding"): string {
		if (workflowKind === "liveness") {
			return env.HYPERVERGE_LIVENESS_WORKFLOW_ID?.trim() || DEFAULT_LIVENESS_WORKFLOW
		}
		return env.HYPERVERGE_WORKFLOW_ID?.trim() || DEFAULT_ONBOARDING_WORKFLOW
	}

	workflowMetadata(
		workflowKind: HypervergeWorkflowKind = "onboarding"
	): Pick<HypervergeStartAttemptResult, "appId" | "workflowId" | "sdkVersion"> {
		return {
			appId: env.HYPERVERGE_APP_ID?.trim() || null,
			workflowId: this.resolveWorkflowId(workflowKind),
			sdkVersion: env.HYPERVERGE_WEB_SDK_VERSION?.trim() || "10.3.0",
		}
	}

	/**
	 * Mint JWT for HyperKYC Web SDK. Returns null if app credentials are missing or token API fails (local dev).
	 */
	async getAuthTokenForTransaction(
		transactionId: string,
		workflowKind: HypervergeWorkflowKind = "onboarding"
	): Promise<string | null> {
		const appId = env.HYPERVERGE_APP_ID?.trim()
		const appKey = env.HYPERVERGE_APP_KEY?.trim()
		const workflowId = this.resolveWorkflowId(workflowKind)
		if (!appId || !appKey) {
			return null
		}

		const primary = `${idvPrimaryBase()}/v2/auth/token`
		const fallback = `${HYPERVERGE_IDV_FALLBACK}/v2/auth/token`

		const body = JSON.stringify({
			appId,
			appKey,
			expiry: 3600,
			transactionId,
			workflowId,
			authenticateOnResume: "no",
		})

		const post = async (url: string) =>
			fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body,
			})

		let response: Response
		try {
			response = await post(primary)
		} catch (networkErr) {
			this.logger.warn(
				`Hyperverge auth token primary fetch failed (network): ${String(networkErr)}`
			)
			try {
				response = await post(fallback)
			} catch (fallbackErr) {
				this.logger.warn(`Hyperverge auth token fallback fetch failed: ${String(fallbackErr)}`)
				return null
			}
		}

		if (!response.ok && (response.status === 404 || response.status === 502)) {
			try {
				response = await post(fallback)
			} catch {
				return null
			}
		}

		const text = await response.text()
		if (!response.ok) {
			this.logger.warn(`Hyperverge auth token error: HTTP ${response.status} ${text.slice(0, 400)}`)
			return null
		}

		let parsed: AuthTokenApiResponse
		try {
			parsed = JSON.parse(text) as AuthTokenApiResponse
		} catch {
			this.logger.warn("Hyperverge auth token returned non-JSON")
			return null
		}

		const token = parsed.result?.authToken
		if (parsed.status !== "success" || typeof token !== "string" || token.length === 0) {
			this.logger.warn(`Hyperverge auth token unexpected body: ${text.slice(0, 400)}`)
			return null
		}

		return token
	}

	/**
	 * Begins a new SDK attempt: generates a correlation `transactionId` and mints a transaction-scoped SDK token when configured.
	 */
	async startAttempt(
		userId: string,
		workflowKind: HypervergeWorkflowKind = "onboarding"
	): Promise<HypervergeStartAttemptResult> {
		void userId
		const meta = this.workflowMetadata(workflowKind)
		const transactionId = randomUUID()
		let sdkToken: string | null = null
		try {
			sdkToken = await this.getAuthTokenForTransaction(transactionId, workflowKind)
		} catch (e) {
			this.logger.warn(
				`Hyperverge getAuthTokenForTransaction threw: ${e instanceof Error ? e.message : String(e)}`
			)
			sdkToken = null
		}
		return {
			transactionId,
			sdkToken,
			appId: meta.appId,
			workflowId: meta.workflowId,
			sdkVersion: meta.sdkVersion,
		}
	}
}
