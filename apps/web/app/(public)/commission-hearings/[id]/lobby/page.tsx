import type { Metadata } from "next"

import { CommissionHearingLobbyContent } from "@/features/commission-hearing/components/commission-hearing-lobby-content"

export const metadata: Metadata = {
	title: "Commission hearing lobby",
}

export default async function CommissionHearingLobbyPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>
	searchParams: Promise<{ invite?: string | string[]; oppositionToken?: string | string[] }>
}) {
	const [{ id }, query] = await Promise.all([params, searchParams])
	const invite = Array.isArray(query.invite) ? query.invite[0] : query.invite
	const oppositionToken = Array.isArray(query.oppositionToken)
		? query.oppositionToken[0]
		: query.oppositionToken

	return (
		<CommissionHearingLobbyContent
			hearingRoomId={id}
			inviteToken={invite ?? null}
			oppositionToken={oppositionToken ?? null}
		/>
	)
}
