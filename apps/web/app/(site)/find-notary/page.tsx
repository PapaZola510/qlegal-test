import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { NotaryDirectoryContent } from "@/features/notary-directory/components/notary-directory-content"

export const metadata: Metadata = {
	title: "Find a Notary",
}

export default function FindNotaryPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Find a Notary"
				description="Search for electronic notary publics near you or available for remote sessions."
			/>
			<NotaryDirectoryContent />
		</div>
	)
}
