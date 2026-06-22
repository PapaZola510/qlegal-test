import { Suspense } from "react"
import type { Metadata } from "next"

import { CommissionHearingMeetingContent } from "@/features/commission-hearing/components/commission-hearing-meeting-content"

export const metadata: Metadata = {
	title: "Commission hearing",
}

export default async function CommissionHearingMeetingPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params

	return (
		<div className="flex min-h-dvh flex-col">
			<Suspense fallback={<p className="text-muted-foreground px-4 py-8 text-sm">Loading…</p>}>
				<CommissionHearingMeetingContent hearingRoomId={id} />
			</Suspense>
		</div>
	)
}
