import { oc } from "@orpc/contract"

import {
	AgenticSummarizeInputSchema,
	AgenticSummarizeResultSchema,
	AiAnalysisResultSchema,
	AiAnalyzeInputSchema,
	AiChatInputSchema,
	AiChatResponseSchema,
	AiGenerateInputSchema,
	AiGenerateResultSchema,
} from "./contract-ai.schema.js"

export const contractAiContract = {
	generate: oc
		.route({
			method: "POST",
			path: "/contract-ai/generate",
			summary: "Generate a contract document via AI",
			tags: ["Contract AI"],
		})
		.input(AiGenerateInputSchema)
		.output(AiGenerateResultSchema),

	analyze: oc
		.route({
			method: "POST",
			path: "/contract-ai/analyze",
			summary: "Analyze an uploaded document via AI",
			tags: ["Contract AI"],
		})
		.input(AiAnalyzeInputSchema)
		.output(AiAnalysisResultSchema),

	chat: oc
		.route({
			method: "POST",
			path: "/contract-ai/chat",
			summary: "Chat with AI about contracts",
			tags: ["Contract AI"],
		})
		.input(AiChatInputSchema)
		.output(AiChatResponseSchema),

	agenticSummarize: oc
		.route({
			method: "POST",
			path: "/contract-ai/agentic-summarize",
			summary: "Post-notarization agentic summary (ENP session data)",
			tags: ["Contract AI"],
		})
		.input(AgenticSummarizeInputSchema)
		.output(AgenticSummarizeResultSchema),
}
