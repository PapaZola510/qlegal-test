import { Injectable } from "@nestjs/common"
import { basename } from "node:path"
import { ORPCError } from "@orpc/server"

import { env } from "@/config/env.config"

import { FilesService } from "../files/files.service"
import {
	mockAiAnalysisResult,
	mockAiChatHistory,
	mockAiGenerateResult,
} from "../mock-data/contract-ai.fixtures"
import { AiFileResolveTokenStore } from "./ai-file-resolve-token.store"
import { AiServiceHttpClient } from "./ai-service-http.client"
import { ContractAiRateLimitService } from "./contract-ai-rate-limit.service"

type ChatMsg = { role: "user" | "assistant"; content: string; timestamp: string }

type RiskSeverity = "info" | "warning" | "critical"

function mapRiskFlagSeverity(s: string | undefined): RiskSeverity {
	const v = (s ?? "").toLowerCase()
	if (v === "high") return "critical"
	if (v === "medium") return "warning"
	return "info"
}

function nestResolveBaseUrl(): string {
	const explicit = env.INTERNAL_API_BASE_URL?.trim()
	if (explicit) return explicit.replace(/\/$/, "")
	return `http://127.0.0.1:${env.PORT}`
}

@Injectable()
export class ContractAiService {
	private readonly chatSessions = new Map<string, ChatMsg[]>()

	constructor(
		private readonly filesService: FilesService,
		private readonly aiClient: AiServiceHttpClient,
		private readonly resolveTokens: AiFileResolveTokenStore,
		private readonly rateLimit: ContractAiRateLimitService
	) {}

	private isAiConfigured(): boolean {
		return Boolean(env.AI_SERVICE_BASE_URL?.trim() && env.CONTRACT_AI_INTERNAL_TOKEN?.trim())
	}

	private mintResolve(
		subOrgIds: string[],
		fileObjectId: string
	): { token: string; nestResolveUrl: string } {
		const token = this.resolveTokens.mint({ fileObjectId, subOrgIds })
		const nestResolveUrl = `${nestResolveBaseUrl()}/api/v1/internal/ai/resolve-download`
		return { token, nestResolveUrl }
	}

	async assertFileInTenant(fileObjectId: string, subOrgIds: string[]) {
		const row = await this.filesService.getActiveRecordForTenant(fileObjectId, subOrgIds)
		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "File not found" })
		}
		return row
	}

	async generate(
		userId: string,
		data: { templateType: string; parameters: Record<string, unknown>; language?: string }
	) {
		this.rateLimit.check(userId)
		const now = new Date().toISOString()
		if (!this.isAiConfigured()) {
			return {
				...mockAiGenerateResult,
				id: `ai_gen_${Date.now()}`,
				templateType: data.templateType,
				createdAt: now,
				updatedAt: now,
			}
		}
		return this.generateRemote(data, now)
	}

	private async generateRemote(
		data: { templateType: string; parameters: Record<string, unknown>; language?: string },
		now: string
	) {
		const py = await this.aiClient.postJson<{
			success: boolean
			contract_text?: string
			tokens_used?: number | null
			error?: string
		}>("/generate", {
			templateType: data.templateType,
			parameters: data.parameters,
			language: data.language ?? "en",
		})
		if (!py.success) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: py.error ?? "AI generation failed" })
		}
		return {
			id: `ai_gen_${Date.now()}`,
			content: py.contract_text ?? "",
			templateType: data.templateType,
			tokensUsed: py.tokens_used ?? 0,
			createdAt: now,
			updatedAt: now,
		}
	}

	async analyze(
		userId: string,
		subOrgIds: string[],
		data: { fileObjectId: string; analysisType: "compliance" | "summary" | "risk" | "full" }
	) {
		this.rateLimit.check(userId)
		const now = new Date().toISOString()
		const row = await this.assertFileInTenant(data.fileObjectId, subOrgIds)
		const filename = basename(row.s3Key)

		if (!this.isAiConfigured()) {
			return {
				...mockAiAnalysisResult,
				id: `ai_analysis_${Date.now()}`,
				fileObjectId: data.fileObjectId,
				analysisType: data.analysisType,
				createdAt: now,
				updatedAt: now,
			}
		}

		const { token, nestResolveUrl } = this.mintResolve(subOrgIds, data.fileObjectId)
		const py = await this.aiClient.postJson<{
			success: boolean
			analysis?: Record<string, unknown>
			error?: string
			filename?: string
		}>("/analyze", {
			fileObjectId: data.fileObjectId,
			filename,
			analysisType: data.analysisType,
			resolveToken: token,
			nestResolveUrl,
		})

		return this.mapAnalysisResult(py, data.fileObjectId, data.analysisType, now)
	}

	private mapAnalysisResult(
		py: { success: boolean; analysis?: Record<string, unknown>; error?: string },
		fileObjectId: string,
		analysisType: string,
		now: string
	) {
		const id = `ai_analysis_${Date.now()}`
		if (!py.success) {
			return {
				id,
				fileObjectId,
				analysisType,
				summary: py.error ?? "Analysis failed",
				findings: [
					{
						category: "Error",
						severity: "critical" as const,
						description: String(py.error ?? "Unknown error"),
						suggestion: null as string | null,
					},
				],
				overallScore: null as number | null,
				createdAt: now,
				updatedAt: now,
			}
		}

		const a = py.analysis ?? {}
		if (a.parse_error || a.raw_analysis) {
			const raw = typeof a.raw_analysis === "string" ? a.raw_analysis : JSON.stringify(a)
			return {
				id,
				fileObjectId,
				analysisType,
				summary: "The model returned unstructured output; raw text is included in findings.",
				findings: [
					{
						category: "Model output",
						severity: "warning" as const,
						description: raw.slice(0, 8000),
						suggestion: null as string | null,
					},
				],
				overallScore: null as number | null,
				createdAt: now,
				updatedAt: now,
			}
		}

		const findings: {
			category: string
			severity: RiskSeverity
			description: string
			suggestion: string | null
		}[] = []

		const riskFlags = a.risk_flags
		if (Array.isArray(riskFlags)) {
			for (const rf of riskFlags) {
				const row = rf as Record<string, unknown>
				findings.push({
					category: String(row.title ?? "Risk"),
					severity: mapRiskFlagSeverity(String(row.severity)),
					description: String(row.description ?? ""),
					suggestion:
						row.recommendation !== undefined && row.recommendation !== null
							? String(row.recommendation)
							: null,
				})
			}
		}

		const missing = a.missing_clauses
		if (Array.isArray(missing)) {
			for (const mc of missing) {
				const row = mc as Record<string, unknown>
				const imp = String(row.importance ?? "low").toLowerCase()
				findings.push({
					category: `Missing clause: ${String(row.clause ?? "unknown")}`,
					severity: imp === "high" ? "warning" : "info",
					description: String(row.why_needed ?? row.description ?? ""),
					suggestion:
						row.recommendation !== undefined && row.recommendation !== null
							? String(row.recommendation)
							: null,
				})
			}
		}

		const summary = String(a.summary ?? a.recommendation ?? "Analysis complete.")
		let overallScore: number | null = null
		if (typeof a.overall_score === "number" && !Number.isNaN(a.overall_score)) {
			overallScore = Math.min(100, Math.max(0, a.overall_score))
		}

		return {
			id,
			fileObjectId,
			analysisType,
			summary,
			findings:
				findings.length > 0
					? findings
					: [
							{
								category: "Summary",
								severity: "info" as const,
								description: summary,
								suggestion: null as string | null,
							},
						],
			overallScore,
			createdAt: now,
			updatedAt: now,
		}
	}

	async chat(
		userId: string,
		subOrgIds: string[],
		data: { message: string; conversationId?: string; context?: string; fileObjectId?: string }
	) {
		this.rateLimit.check(userId)
		const conversationId = data.conversationId ?? `chat_${Date.now()}`
		const now = new Date().toISOString()

		if (!this.chatSessions.has(conversationId)) {
			this.chatSessions.set(conversationId, [...mockAiChatHistory])
		}
		const messages = this.chatSessions.get(conversationId)!

		const historyForPy = messages.map(m => ({ role: m.role, content: m.content }))

		if (!this.isAiConfigured()) {
			messages.push({ role: "user", content: data.message, timestamp: now })
			const reply = `Based on Philippine notarial law, here's what I found regarding "${data.message.substring(0, 50)}": This is a mock AI response. Configure AI_SERVICE_BASE_URL and CONTRACT_AI_INTERNAL_TOKEN to use the Python service.`
			messages.push({ role: "assistant", content: reply, timestamp: now })
			return { conversationId, reply, messages }
		}

		let resolvePart: { resolveToken: string; nestResolveUrl: string; filename: string } | null =
			null
		if (data.fileObjectId) {
			const row = await this.assertFileInTenant(data.fileObjectId, subOrgIds)
			const { token, nestResolveUrl } = this.mintResolve(subOrgIds, data.fileObjectId)
			resolvePart = { resolveToken: token, nestResolveUrl, filename: basename(row.s3Key) }
		}

		const py = await this.aiClient.postJson<{
			success: boolean
			response?: string
			error?: string
		}>("/chat", {
			message: data.message,
			conversationHistory: historyForPy,
			context: data.context,
			fileObjectId: data.fileObjectId,
			filename: resolvePart?.filename ?? "contract",
			resolveToken: resolvePart?.resolveToken,
			nestResolveUrl: resolvePart?.nestResolveUrl,
		})

		const reply =
			py.success && py.response
				? py.response
				: `The AI service reported an error: ${py.error ?? "unknown"}`

		messages.push({ role: "user", content: data.message, timestamp: now })
		messages.push({ role: "assistant", content: reply, timestamp: now })
		return { conversationId, reply, messages }
	}

	async agenticSummarize(
		userId: string,
		data: { appointment: Record<string, unknown>; enpUser: Record<string, unknown> }
	) {
		this.rateLimit.check(userId)
		if (!this.isAiConfigured()) {
			return {
				success: true as const,
				summary: {
					summary_type: "Agentic Notarization Summary (mock)",
					ai_observations:
						"Mock post-notarization summary. Configure AI_SERVICE_BASE_URL and CONTRACT_AI_INTERNAL_TOKEN for live output.",
					generated_by: "qlegal-new ContractAiService (fixture)",
				},
			}
		}
		return this.aiClient.postJson<{
			success: boolean
			summary?: Record<string, unknown>
			error?: string
		}>("/agentic-summarize", {
			appointment: data.appointment,
			enpUser: data.enpUser,
		})
	}
}
