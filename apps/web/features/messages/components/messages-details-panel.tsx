"use client"

import * as React from "react"
import { format } from "date-fns"

import { Avatar, AvatarFallback, AvatarImage } from "@/core/components/ui/avatar"
import { Badge } from "@/core/components/ui/badge"
import { Separator } from "@/core/components/ui/separator"
import { getInitials } from "@/core/lib/utils"
import { useDmPeerProfileQuery, type DmPeerProfile } from "@/features/messages/api/messages.hooks"
import { useMessagesContext } from "@/features/messages/context/messages-context"

export function MessagesDetailsPanel() {
	const { selectedConversation, userId } = useMessagesContext()
	const peerId = React.useMemo(() => {
		if (!selectedConversation || !userId) return null
		return selectedConversation.participantIds.find(id => id !== userId) ?? null
	}, [selectedConversation, userId])

	const profileQuery = useDmPeerProfileQuery(peerId)
	const profile = profileQuery.data as DmPeerProfile | null | undefined

	if (!selectedConversation || !peerId) {
		return (
			<div className="text-muted-foreground flex h-full items-center justify-center px-6 text-center text-xs">
				Select a conversation to see participant details.
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col overflow-y-auto p-4">
			<div>
				<p className="text-sm font-semibold">Chat Details</p>
				<p className="text-muted-foreground text-xs">Participant information</p>
			</div>

			<div className="bg-muted/30 mt-4 flex flex-col items-center rounded-xl border p-5">
				<Avatar className="size-20">
					<AvatarImage src={profile?.image ?? undefined} />
					<AvatarFallback className="text-base">{getInitials(profile?.name ?? "")}</AvatarFallback>
				</Avatar>
				<p className="mt-3 text-sm font-semibold">{profile?.name ?? "…"}</p>
				<div className="mt-1 flex items-center gap-1">
					<Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
						{profile?.role ?? "User"}
					</Badge>
					{profile?.isVerified ? (
						<Badge variant="outline" className="px-1.5 py-0 text-[10px]">
							Verified
						</Badge>
					) : null}
				</div>
			</div>

			<Separator className="my-4" />

			<p className="text-sm font-semibold">Contact Information</p>
			<div className="mt-3 space-y-3">
				<DetailField label="Email" value={profile?.email ?? "—"} />
				<DetailField label="Role" value={profile?.role ?? "—"} />
				<DetailField
					label="Joined Date"
					value={profile?.joinedAt ? format(new Date(profile.joinedAt), "MMMM d, yyyy") : "—"}
				/>
				<DetailField label="Bio" value={profile?.bio ?? "No bio provided"} />
			</div>
		</div>
	)
}

function DetailField({ label, value }: { label: string; value: string }) {
	return (
		<div className="bg-muted/30 rounded-md border p-3">
			<p className="text-muted-foreground text-[10px] tracking-wide uppercase">{label}</p>
			<p className="text-foreground mt-0.5 text-xs wrap-break-word">{value}</p>
		</div>
	)
}
