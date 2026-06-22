"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"

import { Avatar, AvatarFallback } from "@/core/components/ui/avatar"
import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card } from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { Separator } from "@/core/components/ui/separator"
import { cn, getInitials } from "@/core/lib/utils"
import { authClient } from "@/services/better-auth/auth-client"
import { emitQlegalClientEvent, subscribeQlegalEvent } from "@/services/ws/ws-client"
import {
	getPeerName,
	useConversationMessagesQuery,
	useConversationsQuery,
	useMarkConversationReadMutation,
	useSendMessageMutation,
	type Conversation,
	type Message,
} from "@/features/messages/api/messages.hooks"

function formatThreadTime(iso: string | Date | null): string {
	if (!iso) return ""
	try {
		const d = typeof iso === "string" ? new Date(iso) : iso
		return format(d, "p")
	} catch {
		return ""
	}
}

export function MessagesContent() {
	const queryClient = useQueryClient()
	const { data: session } = authClient.useSession()
	const userId = session?.user?.id ?? ""

	const listQuery = useConversationsQuery()
	const conversations: Conversation[] = (listQuery.data as Conversation[] | undefined) ?? []
	const [selectedId, setSelectedId] = React.useState<string>("")
	const [draft, setDraft] = React.useState("")
	const scrollRef = React.useRef<HTMLDivElement>(null)

	const messagesQuery = useConversationMessagesQuery(selectedId || null)
	const thread: Message[] = (messagesQuery.data as Message[] | undefined) ?? []
	const send = useSendMessageMutation()
	const markRead = useMarkConversationReadMutation()

	React.useEffect(() => {
		if (!selectedId && conversations[0]) setSelectedId(conversations[0].id)
	}, [conversations, selectedId])

	React.useEffect(() => {
		const off1 = subscribeQlegalEvent("dm:message", () => {
			void queryClient.invalidateQueries()
		})
		const off2 = subscribeQlegalEvent("dm:conversation-updated", () => {
			void queryClient.invalidateQueries()
		})
		const off3 = subscribeQlegalEvent("dm:read", () => {
			void queryClient.invalidateQueries()
		})
		return () => {
			off1()
			off2()
			off3()
		}
	}, [queryClient])

	React.useEffect(() => {
		if (!selectedId || !userId) return
		emitQlegalClientEvent("join-dm", { conversationId: selectedId })
		markRead.mutate(selectedId)
		return () => {
			emitQlegalClientEvent("leave-dm", { conversationId: selectedId })
		}
	}, [selectedId, userId])

	React.useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
	}, [thread.length])

	const selected = conversations.find(c => c.id === selectedId)

	function handleSend() {
		const text = draft.trim()
		if (!text || !selectedId) return
		send.mutate(
			{ conversationId: selectedId, content: text, type: "text" },
			{
				onSettled: () => setDraft(""),
			}
		)
	}

	return (
		<Card className="flex h-[calc(100vh-12rem)] overflow-hidden">
			<div className="flex w-72 flex-col border-r lg:w-80">
				<div className="border-b p-3">
					<Input placeholder="Search conversations…" className="h-8 text-sm" />
				</div>
				<div className="flex-1 overflow-y-auto">
					{listQuery.isLoading ? (
						<p className="text-muted-foreground p-3 text-xs">Loading…</p>
					) : (
						conversations.map(conv => (
							<ConversationRow
								key={conv.id}
								conversation={conv}
								currentUserId={userId}
								isActive={conv.id === selectedId}
								onClick={() => setSelectedId(conv.id)}
							/>
						))
					)}
				</div>
			</div>

			{selected && userId ? (
				<div className="flex flex-1 flex-col">
					<div className="flex items-center gap-3 border-b px-4 py-3">
						<Avatar size="sm">
							<AvatarFallback>{getInitials(getPeerName(selected, userId))}</AvatarFallback>
						</Avatar>
						<div className="flex-1">
							<p className="text-sm font-medium">{getPeerName(selected, userId)}</p>
							<p className="text-muted-foreground text-xs">Direct message</p>
						</div>
					</div>

					<div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
						{messagesQuery.isLoading ? (
							<p className="text-muted-foreground text-xs">Loading messages…</p>
						) : (
							<div className="space-y-4">
								{thread.map(msg => (
									<MessageBubble key={msg.id} message={msg} currentUserId={userId} />
								))}
							</div>
						)}
					</div>

					<Separator />
					<form
						className="flex items-center gap-2 p-3"
						onSubmit={e => {
							e.preventDefault()
							handleSend()
						}}
					>
						<Input
							placeholder="Type a message…"
							value={draft}
							onChange={e => setDraft(e.target.value)}
							className="flex-1"
						/>
						<Button type="submit" size="sm" disabled={!draft.trim() || send.isPending}>
							Send
						</Button>
					</form>
				</div>
			) : (
				<div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm">
					{!userId ? (
						<p>Sign in to view your direct messages.</p>
					) : (
						<p>Select a conversation to start messaging.</p>
					)}
				</div>
			)}
		</Card>
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
				<div className="flex items-center justify-between">
					<span className="truncate text-sm font-medium">{peer}</span>
					<span className="text-muted-foreground ml-2 shrink-0 text-xs">
						{formatThreadTime(conversation.lastMessageAt)}
					</span>
				</div>
				<div className="flex items-center justify-between">
					<p className="text-muted-foreground truncate text-xs">
						{conversation.lastMessagePreview}
					</p>
					{conversation.unreadCount > 0 && (
						<Badge variant="default" className="ml-2 shrink-0 text-[10px]">
							{conversation.unreadCount}
						</Badge>
					)}
				</div>
			</div>
		</button>
	)
}

function MessageBubble({ message, currentUserId }: { message: Message; currentUserId: string }) {
	const isMe = message.senderId === currentUserId

	return (
		<div className={cn("flex", isMe ? "justify-end" : "justify-start")}>
			<div
				className={cn(
					"max-w-[70%] rounded-2xl px-4 py-2",
					isMe ? "bg-primary text-primary-foreground" : "bg-muted"
				)}
			>
				{!isMe && <p className="mb-0.5 text-xs font-medium">{message.senderName}</p>}
				<p className="text-sm">{message.content}</p>
				<div
					className={cn(
						"mt-1 flex items-center gap-1 text-[10px]",
						isMe ? "text-primary-foreground/70 justify-end" : "text-muted-foreground"
					)}
				>
					<span>{formatThreadTime(message.createdAt)}</span>
					{isMe && <span>{message.isRead ? "✓✓" : "✓"}</span>}
				</div>
			</div>
		</div>
	)
}
