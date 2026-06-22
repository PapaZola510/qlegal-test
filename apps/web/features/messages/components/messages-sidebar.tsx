"use client"

import * as React from "react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { format, formatDistanceToNowStrict, isToday } from "date-fns"

import { Avatar, AvatarFallback } from "@/core/components/ui/avatar"
import { Badge } from "@/core/components/ui/badge"
import { Input } from "@/core/components/ui/input"
import { cn, getInitials } from "@/core/lib/utils"
import {
	getPeerName,
	getPeerVerified,
	type Conversation,
} from "@/features/messages/api/messages.hooks"
import { MessagesNewChatDialog } from "@/features/messages/components/messages-new-chat-dialog"
import { useMessagesContext } from "@/features/messages/context/messages-context"

function formatThreadTime(iso: string | Date | null): string {
	if (!iso) return ""
	try {
		const date = typeof iso === "string" ? new Date(iso) : iso
		const diffMs = Date.now() - date.getTime()
		if (diffMs < 60_000) return "Just now"
		if (isToday(date)) return formatDistanceToNowStrict(date, { addSuffix: false })
		return format(date, "MMM d")
	} catch {
		return ""
	}
}

export function MessagesSidebar() {
	const { conversations, loadingConversations, selectedId, setSelectedId, userId } =
		useMessagesContext()
	const [search, setSearch] = React.useState("")

	const filteredConversations = React.useMemo(() => {
		const normalized = search.trim().toLowerCase()
		if (!normalized) return conversations

		return conversations.filter(conversation => {
			const peer = userId ? getPeerName(conversation, userId) : ""
			const preview = conversation.lastMessagePreview ?? ""
			return peer.toLowerCase().includes(normalized) || preview.toLowerCase().includes(normalized)
		})
	}, [conversations, search, userId])

	return (
		<div className="flex h-full w-full flex-col">
			<div className="flex items-center justify-between border-b px-4 pt-3 pb-2">
				<p className="text-base font-semibold">Messages</p>
				<MessagesNewChatDialog />
			</div>

			<div className="border-b px-3 py-2">
				<div className="relative">
					<HugeiconsIcon
						icon={Search01Icon}
						className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
					/>
					<Input
						placeholder="Search messages…"
						className="bg-muted/40 h-8 pl-8 text-xs"
						value={search}
						onChange={event => setSearch(event.target.value)}
					/>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto">
				{loadingConversations ? (
					<p className="text-muted-foreground p-3 text-xs">Loading…</p>
				) : filteredConversations.length === 0 ? (
					<p className="text-muted-foreground p-3 text-xs">
						{search.trim() ? "No conversations matched your search." : "No conversations yet."}
					</p>
				) : (
					filteredConversations.map(conversation => (
						<ConversationRow
							key={conversation.id}
							conversation={conversation}
							currentUserId={userId}
							isActive={conversation.id === selectedId}
							onClick={() => setSelectedId(conversation.id)}
						/>
					))
				)}
			</div>
		</div>
	)
}

function ConversationRow({
	conversation,
	currentUserId,
	isActive,
	onClick,
}: {
	conversation: Conversation
	currentUserId: string
	isActive: boolean
	onClick: () => void
}) {
	const peer = currentUserId ? getPeerName(conversation, currentUserId) : "…"
	const peerVerified = currentUserId ? getPeerVerified(conversation, currentUserId) : false

	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex w-full items-start gap-3 px-3 py-3 text-left transition-colors",
				isActive ? "bg-accent" : "hover:bg-muted"
			)}
		>
			<Avatar size="sm">
				<AvatarFallback>{getInitials(peer)}</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1">
				<div className="flex items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-1">
						<span className="truncate text-sm font-medium">{peer}</span>
						{peerVerified ? (
							<Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
								Verified
							</Badge>
						) : null}
					</div>
					<span className="text-muted-foreground shrink-0 text-[10px]">
						{formatThreadTime(conversation.lastMessageAt)}
					</span>
				</div>
				<div className="flex items-center justify-between gap-2">
					<p className="text-muted-foreground truncate text-xs">
						{conversation.lastMessagePreview ?? "No messages yet"}
					</p>
					{conversation.unreadCount > 0 && (
						<Badge variant="default" className="shrink-0 text-[10px]">
							{conversation.unreadCount}
						</Badge>
					)}
				</div>
			</div>
		</button>
	)
}
