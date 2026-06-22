import { z } from "zod"

import { TimestampFields } from "../shared/schemas.js"

export const AiGenerateInputSchema = z.object({
	templateType: z.string(),
	parameters: z.record(z.string(), z.unknown()),
	language: z.enum(["en", "fil"]).default("en"),
})

export const AiGenerateResultSchema = z.object({
	id: z.string(),
	content: z.string(),
	templateType: z.string(),
	tokensUsed: z.number().int(),
	...TimestampFields,
})

export const AiAnalyzeInputSchema = z.object({
	/** Stored file row id; Nest resolves to bytes via private signed URL (no public document URL). */
	fileObjectId: z.string().min(1),
	analysisType: z.enum(["compliance", "summary", "risk", "full"]),
})

export const AiAnalysisResultSchema = z.object({
	id: z.string(),
	fileObjectId: z.string(),
	analysisType: z.string(),
	summary: z.string(),
	findings: z.array(
		z.object({
			category: z.string(),
			severity: z.enum(["info", "warning", "critical"]),
			description: z.string(),
			suggestion: z.string().nullable(),
		})
	),
	overallScore: z.number().min(0).max(100).nullable(),
	...TimestampFields,
})

export const AiChatMessageSchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.string(),
	timestamp: z.string(),
})

export const AiChatInputSchema = z.object({
	message: z.string().min(1),
	conversationId: z.string().optional(),
	/** Inline excerpt when no uploaded file is bound to the thread. */
	context: z.string().optional(),
	/** When set, Nest + AI service pull contract text from storage (same flow as analyze). */
	fileObjectId: z.string().min(1).optional(),
})

export const AiChatResponseSchema = z.object({
	conversationId: z.string(),
	reply: z.string(),
	messages: z.array(AiChatMessageSchema),
})

export const AgenticSummarizeInputSchema = z.object({
	appointment: z.record(z.string(), z.unknown()),
	enpUser: z.record(z.string(), z.unknown()),
})

export const AgenticSummarizeResultSchema = z.object({
	success: z.boolean(),
	summary: z.record(z.string(), z.unknown()).optional(),
	error: z.string().optional(),
})

export type AiGenerateResult = z.infer<typeof AiGenerateResultSchema>
export type AiAnalysisResult = z.infer<typeof AiAnalysisResultSchema>
export type AiChatResponse = z.infer<typeof AiChatResponseSchema>
export type AgenticSummarizeResult = z.infer<typeof AgenticSummarizeResultSchema>
