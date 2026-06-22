import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { MessagesView } from "@/features/messages/components/messages-view"

export const metadata: Metadata = {
	title: "Messages",
}

export default function MessagesPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Messages"
				description="Communicate with clients, attorneys, and notaries."
			/>
			<MessagesView />
		</div>
	)
}
