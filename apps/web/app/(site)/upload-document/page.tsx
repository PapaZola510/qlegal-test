import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { UploadDocumentWizard } from "@/features/document-review/components/upload-document-wizard"

export const metadata: Metadata = {
	title: "Upload Document for Review",
}

export default function UploadDocumentPage() {
	return (
		<div className="mx-auto w-full max-w-3xl space-y-6">
			<PageHeader
				title="Upload Document for Review"
				description="Pick a notary, upload your document, and they'll review it and create an appointment when it's ready."
			/>
			<UploadDocumentWizard />
		</div>
	)
}
