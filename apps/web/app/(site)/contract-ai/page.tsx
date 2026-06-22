import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { ContractAiContent } from "@/features/contract-ai/components/contract-ai-content"

export const metadata: Metadata = {
	title: "Contract AI",
}

export default function ContractAiPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Contract AI"
				description="Upload, analyze, chat with, and generate legal documents using AI."
			/>
			<ContractAiContent />
		</div>
	)
}
