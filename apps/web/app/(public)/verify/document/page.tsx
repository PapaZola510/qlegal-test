import { Suspense } from "react"
import type { Metadata } from "next"

import { VerifyDocumentContent } from "@/features/document-verification/components/verify-document-content"

export const metadata: Metadata = {
	title: "Verify Notarized Document",
	description:
		"Verify the authenticity of a notarized document issued through Quanby Legal.",
}

export default function VerifyDocumentPage() {
	return (
		<div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
			<Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
				<VerifyDocumentContent />
			</Suspense>
		</div>
	)
}
