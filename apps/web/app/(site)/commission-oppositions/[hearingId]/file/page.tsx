import type { Metadata, Route } from "next"
import Link from "next/link"

import { PageHeader } from "@/core/components/page-header"
import { buttonVariants } from "@/core/components/ui/button"
import { CommissionOppositionFileForm } from "@/features/commission-hearing/components/commission-opposition-file-form"

export const metadata: Metadata = {
	title: "File Commission Hearing Opposition",
	description: "File a verified written opposition for an electronic notarial commission hearing.",
}

export default async function CommissionOppositionFilePage({
	params,
}: {
	params: Promise<{ hearingId: string }>
}) {
	const { hearingId } = await params

	return (
		<div className="w-full space-y-6">
			<PageHeader
				title="File Opposition"
				description="Submit a verified written opposition and supporting authority documents for the commission hearing."
				actions={
					<Link
						href={"/dashboard" as Route}
						className={buttonVariants({ variant: "outline", size: "sm" })}
					>
						Back to dashboard
					</Link>
				}
			/>
			<CommissionOppositionFileForm hearingRoomId={hearingId} />
		</div>
	)
}
