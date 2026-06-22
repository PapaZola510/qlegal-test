import { PageHeader } from "@/core/components/page-header"
import { LoadingState } from "@/core/components/shared-states"

export default function FindNotaryLoading() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Find a Notary"
				description="Search for electronic notary publics near you or available for remote sessions."
			/>
			<LoadingState message="Loading notary directory…" />
		</div>
	)
}
