import { Injectable, Logger } from "@nestjs/common"

import { env } from "@/config/env.config"

import { HYPERVERGE_IDV_FALLBACK, hypervergeIdvApiBase } from "./hyperverge-idv-base"

export interface LivenessDecisionResult {
	isLive: boolean
	actionPassed: boolean
	isApproved: boolean
	message: string
	qualityIssues: string[]
	liveFaceValue: "yes" | "no" | "unknown"
	summaryAction: "pass" | "fail" | "unknown"
}

export interface HostedWorkflowConfig {
	workflowId: string
	transactionId: string
	redirectUrl: string
	inputs?: Record<string, unknown>
	validateWorkflowInputs?: "yes" | "no"
	allowEmptyWorkflowInputs?: "yes" | "no"
	forceLaunchSDK?: "yes" | "no"
}

interface HostedWorkflowResponse {
	status: string
	result?: { startKycUrl?: string; error?: string }
}

interface OutputAPIResponse {
	status: string
	result?: {
		status: string
		transactionId: string
		summary?: { action: "pass" | "fail" }
		details?: Array<{
			attempts?: Array<{
				liveFace?: { value: "yes" | "no" }
				qualityChecks?: {
					eyesClosed?: { value: "yes" | "no" }
					occlusion?: { value: "yes" | "no" }
					multipleFaces?: { value: "yes" | "no" }
				}
			}>
		}>
	}
	decision?: LivenessDecisionResult
}

function validateCredentials(): void {
	if (!env.HYPERVERGE_APP_ID?.trim() || !env.HYPERVERGE_APP_KEY?.trim()) {
		throw new Error(
			"HyperVerge credentials not configured. Set HYPERVERGE_APP_ID and HYPERVERGE_APP_KEY on the API."
		)
	}
}

export function makeLivenessDecision(
	liveFaceValue: string | undefined,
	summaryAction: string | undefined,
	qualityChecks?: {
		eyesClosed?: { value: "yes" | "no" }
		occlusion?: { value: "yes" | "no" }
		multipleFaces?: { value: "yes" | "no" }
	}
): LivenessDecisionResult {
	const isLive =
		liveFaceValue === "yes" || (liveFaceValue === "unknown" && summaryAction === "pass")
	const actionPassed = summaryAction === "pass"
	const isApproved = actionPassed

	const qualityIssues: string[] = []
	if (qualityChecks?.eyesClosed?.value === "yes") qualityIssues.push("Eyes closed detected")
	if (qualityChecks?.occlusion?.value === "yes") qualityIssues.push("Face occlusion detected")
	if (qualityChecks?.multipleFaces?.value === "yes") qualityIssues.push("Multiple faces detected")

	let message: string
	if (isApproved) {
		message = "Liveness verification successful."
	} else if (!isLive && !actionPassed) {
		message = "Liveness verification failed. No live face detected."
	} else if (!actionPassed) {
		message = `Liveness check failed${qualityIssues.length ? `: ${qualityIssues.join(", ")}` : "."}`
	} else {
		message = "Unable to determine liveness status."
	}

	return {
		isLive,
		actionPassed,
		isApproved,
		message,
		qualityIssues,
		liveFaceValue: liveFaceValue === "yes" || liveFaceValue === "no" ? liveFaceValue : "unknown",
		summaryAction: summaryAction === "pass" || summaryAction === "fail" ? summaryAction : "unknown",
	}
}

function mapStatusToAction(status: string | undefined): "pass" | "fail" | "unknown" {
	if (!status) return "unknown"
	const s = status.toLowerCase()
	if (s.includes("approved") || s === "pass") return "pass"
	if (s.includes("declined") || s.includes("rejected") || s === "fail") return "fail"
	return "fail"
}

function parseHyperVergeErrorMessage(responseText: string): string {
	try {
		const parsed = JSON.parse(responseText) as HostedWorkflowResponse
		const err = parsed?.result?.error
		if (typeof err === "string" && err.trim()) return err
	} catch {
		// ignore
	}
	return responseText
}

@Injectable()
export class HypervergeLivenessService {
	private readonly logger = new Logger(HypervergeLivenessService.name)

	livenessWorkflowId(): string {
		return env.HYPERVERGE_LIVENESS_WORKFLOW_ID?.trim() || "workflow_liveness"
	}

	async startHostedWorkflow(config: HostedWorkflowConfig): Promise<HostedWorkflowResponse> {
		validateCredentials()
		const appId = env.HYPERVERGE_APP_ID!.trim()
		const appKey = env.HYPERVERGE_APP_KEY!.trim()

		const requestBody = {
			workflowId: config.workflowId,
			transactionId: config.transactionId,
			redirectUrl: config.redirectUrl,
			...(config.inputs ? { inputs: config.inputs } : {}),
			...(config.validateWorkflowInputs
				? { validateWorkflowInputs: config.validateWorkflowInputs }
				: {}),
			...(config.allowEmptyWorkflowInputs
				? { allowEmptyWorkflowInputs: config.allowEmptyWorkflowInputs }
				: {}),
			...(config.forceLaunchSDK ? { forceLaunchSDK: config.forceLaunchSDK } : {}),
		}

		const post = async (url: string) =>
			fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					appId,
					appKey,
				},
				body: JSON.stringify(requestBody),
			})

		const idvBase = hypervergeIdvApiBase()
		const primary = `${idvBase}/v1/link-kyc/start`
		const fallback = `${HYPERVERGE_IDV_FALLBACK}/v1/link-kyc/start`

		let response: Response
		try {
			response = await post(primary)
		} catch (e) {
			this.logger.warn(`Primary link-kyc failed: ${String(e)}`)
			response = await post(fallback)
		}

		if (!response.ok && (response.status === 404 || response.status === 502)) {
			response = await post(fallback)
		}

		const responseText = await response.text()
		if (!response.ok) {
			throw new Error(
				`HyperVerge link-kyc API error: ${response.status} - ${parseHyperVergeErrorMessage(responseText)}`
			)
		}

		const result = JSON.parse(responseText) as HostedWorkflowResponse
		const startUrl = result.result?.startKycUrl
		if (result.status !== "success" || !startUrl) {
			const err =
				typeof result.result?.error === "string" && result.result.error.length > 0
					? result.result.error
					: `Unexpected response: ${responseText.slice(0, 400)}`
			throw new Error(`HyperVerge link-kyc error: ${err}`)
		}

		return result
	}

	async getWorkflowOutput(transactionId: string): Promise<OutputAPIResponse> {
		validateCredentials()
		const appId = env.HYPERVERGE_APP_ID!.trim()
		const appKey = env.HYPERVERGE_APP_KEY!.trim()

		const requestBody = { transactionId, sendDebugInfo: "yes" }
		const post = async (url: string) =>
			fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json", appId, appKey },
				body: JSON.stringify(requestBody),
			})

		const idvBase = hypervergeIdvApiBase()
		const primary = `${idvBase}/v1/output`
		const fallback = `${HYPERVERGE_IDV_FALLBACK}/v1/output`

		let response: Response
		try {
			response = await post(primary)
		} catch (e) {
			this.logger.warn(`Primary output API failed: ${String(e)}`)
			response = await post(fallback)
		}

		const responseText = await response.text()
		if (!response.ok) {
			throw new Error(
				`HyperVerge output API error: ${response.status} - ${responseText.slice(0, 400)}`
			)
		}

		const result = JSON.parse(responseText) as OutputAPIResponse
		if (result.status !== "success") {
			throw new Error(`HyperVerge output error: ${responseText.slice(0, 400)}`)
		}

		let liveFaceValue: "yes" | "no" | "unknown" = "unknown"
		let qualityChecks:
			| {
					eyesClosed?: { value: "yes" | "no" }
					occlusion?: { value: "yes" | "no" }
					multipleFaces?: { value: "yes" | "no" }
			  }
			| undefined

		if (result.result?.details && Array.isArray(result.result.details)) {
			for (const detail of result.result.details) {
				for (const attempt of detail.attempts ?? []) {
					if (attempt.liveFace) {
						liveFaceValue = attempt.liveFace.value
						qualityChecks = attempt.qualityChecks
						break
					}
				}
				if (liveFaceValue !== "unknown") break
			}
		}

		const finalAction = result.result?.summary?.action ?? mapStatusToAction(result.result?.status)
		const decision = makeLivenessDecision(liveFaceValue, finalAction, qualityChecks)

		return { ...result, decision }
	}
}
