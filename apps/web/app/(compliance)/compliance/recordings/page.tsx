import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { AvRecordingsContent } from "@/features/compliance-audit/components/av-recordings-content"

export const metadata: Metadata = {
	title: "AV Recordings",
}

export default function AvRecordingsPage() {
	return (
		<div className="space-y-6">
			<PageHeader title="AV Recordings" description="Session recording integrity records." />
			<AvRecordingsContent />
		</div>
	)
}
