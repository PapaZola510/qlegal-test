import type { Metadata } from "next"

import { CommissionHearingNoticeContent } from "@/features/commission-hearing/components/commission-hearing-notice-content"

export const metadata: Metadata = {
	title: "Notice of Hearing",
}

export default async function CommissionHearingNoticePage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	return <CommissionHearingNoticeContent id={id} />
}
