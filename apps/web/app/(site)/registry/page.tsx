import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { RegistryContent } from "@/features/registry/components/registry-content"

export const metadata: Metadata = {
	title: "Notarial Book",
}

export default function RegistryPage() {
	return (
		<div className="w-full min-w-0 space-y-6">
			<PageHeader
				title="Notarial Book"
				description="Browse and manage your electronic notarial book entries."
			/>
			<RegistryContent />
		</div>
	)
}
