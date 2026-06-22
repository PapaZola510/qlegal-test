import type { Metadata } from "next"

import { ContentContainer, PageHeader } from "@/core/components/page-header"
import { BookNotaryContent } from "@/features/notary-directory/components/book-notary-content"

export const metadata: Metadata = {
	title: "Book Notary Appointment",
}

export default async function BookNotaryPage({
	params,
}: {
	params: Promise<{ notaryId: string }>
}) {
	const { notaryId } = await params

	return (
		<ContentContainer className="py-10">
			<PageHeader
				title="Book an Appointment"
				description="Complete the form below to request a notarization session with your selected notary."
			/>
			<div className="mt-8">
				<BookNotaryContent notaryId={notaryId} />
			</div>
		</ContentContainer>
	)
}
