"use client"

import * as React from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/components/ui/tabs"
import { AiChatPanel } from "@/features/contract-ai/components/ai-chat-panel"
import { GeneratePanel } from "@/features/contract-ai/components/generate-panel"
import { PostNotarizationPanel } from "@/features/contract-ai/components/post-notarization-panel"
import { UploadAnalyzePanel } from "@/features/contract-ai/components/upload-analyze-panel"
import type { ContractAiTab } from "@/features/contract-ai/lib/fixtures"

export function ContractAiContent() {
	const [activeTab, setActiveTab] = React.useState<ContractAiTab>("upload")

	return (
		<Tabs value={activeTab} onValueChange={v => setActiveTab(v as ContractAiTab)}>
			<TabsList>
				<TabsTrigger value="upload">Upload &amp; Analyze</TabsTrigger>
				<TabsTrigger value="chat">AI Chat</TabsTrigger>
				<TabsTrigger value="generate">Generate</TabsTrigger>
				<TabsTrigger value="summary">Post-Notarization</TabsTrigger>
			</TabsList>

			<TabsContent value="upload" className="mt-4">
				<UploadAnalyzePanel />
			</TabsContent>

			<TabsContent value="chat" className="mt-4">
				<AiChatPanel />
			</TabsContent>

			<TabsContent value="generate" className="mt-4">
				<GeneratePanel />
			</TabsContent>

			<TabsContent value="summary" className="mt-4">
				<PostNotarizationPanel />
			</TabsContent>
		</Tabs>
	)
}
