import type { Metadata } from "next"

import { VerifyCertificateContent } from "@/features/certificate-verification/components/verify-certificate-content"

export const metadata: Metadata = {
	title: "Verify Certificate",
}

export default async function VerifyCertificatePage({
	params,
}: {
	params: Promise<{ certificateId: string }>
}) {
	const { certificateId } = await params

	return (
		<div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
			<VerifyCertificateContent initialId={certificateId} />
		</div>
	)
}
