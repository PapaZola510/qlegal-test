"use client"

import * as React from "react"
import { ArrowLeft01Icon, Sent02Icon, TickDouble01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { format, isSameDay } from "date-fns"

import { Chat } from "@/core/components/chat"
import { Avatar, AvatarFallback, AvatarImage } from "@/core/components/ui/avatar"
import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Separator } from "@/core/components/ui/separator"
import { getInitials } from "@/core/lib/utils"
import {
	DM_MESSAGE_MAX_LENGTH,
	getPeerName,
	getPeerVerified,
	useDmPeerProfileQuery,
	type DmPeerProfile,
	type Message,
} from "@/features/messages/api/messages.hooks"
import { useMessagesContext } from "@/features/messages/context/messages-context"

function formatAbsoluteTime(iso: string | Date | null): string {
	if (!iso) return ""
	try {
		const date = typeof iso === "string" ? new Date(iso) : iso
		return format(date, "PPp")
	} catch {
		return ""
	}
}

function formatShortTime(iso: string | Date | null): string {
	if (!iso) return ""
	try {
		const date = typeof iso === "string" ? new Date(iso) : iso
		return format(date, "p")
	} catch {
		return ""
	}
}

const GROUP_GAP_MS = 10 * 60 * 1000

function formatGroupSeparator(previous: Message | undefined, current: Message): string {
	try {
		const date = new Date(current.createdAt)
		if (!previous || !isSameDay(new Date(previous.createdAt), date)) {
			return format(date, "EEE p")
		}
		return format(date, "p")
	} catch {
		return ""
	}
}

function hasGroupBreak(previous: Message | undefined, current: Message): boolean {
	if (!previous) return true
	try {
		const prev = new Date(previous.createdAt).getTime()
		const curr = new Date(current.createdAt).getTime()
		if (!isSameDay(new Date(prev), new Date(curr))) return true
		return curr - prev > GROUP_GAP_MS
	} catch {
		return true
	}
}

export function MessagesChatArea() {
	const {
		selectedConversation,
		thread,
		loadingMessages,
		loadingOlderMessages,
		hasOlderMessages,
		userId,
		draft,
		setDraft,
		sendMessage,
		isSending,
		clearSelectedConversation,
		isPeerTyping,
		typingParticipantName,
		setTyping,
		loadOlderMessages,
	} = useMessagesContext()
	const scrollRef = React.useRef<HTMLDivElement>(null)
	const pendingScrollRestoreRef = React.useRef<number | null>(null)

	const peerId = React.useMemo(() => {
		if (!selectedConversation || !userId) return null
		return selectedConversation.participantIds.find(id => id !== userId) ?? null
	}, [selectedConversation, userId])

	const peerProfileQuery = useDmPeerProfileQuery(peerId)
	const peerProfile = peerProfileQuery.data as DmPeerProfile | null | undefined

	React.useEffect(() => {
		const container = scrollRef.current
		if (!container) return

		if (pendingScrollRestoreRef.current !== null) {
			const delta = container.scrollHeight - pendingScrollRestoreRef.current
			container.scrollTop = delta
			pendingScrollRestoreRef.current = null
			return
		}

		container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
	}, [thread.length, isPeerTyping, loadingOlderMessages])

	function handleLoadOlderMessages() {
		const container = scrollRef.current
		if (container) {
			pendingScrollRestoreRef.current = container.scrollHeight
		}
		loadOlderMessages()
	}

	React.useEffect(() => {
		if (!selectedConversation) return

		if (!draft.trim()) {
			setTyping(false)
			return
		}

		setTyping(true)
		const timeout = setTimeout(() => {
			setTyping(false)
		}, 1200)

		return () => {
			clearTimeout(timeout)
		}
	}, [draft, selectedConversation, setTyping])

	if (!selectedConversation || !userId) {
		return (
			<div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm">
				{!userId ? (
					<p>Sign in to view your direct messages.</p>
				) : (
					<p>Select a conversation to start messaging.</p>
				)}
			</div>
		)
	}

	const peerName = peerProfile?.name ?? getPeerName(selectedConversation, userId)
	const peerVerified = peerProfile?.isVerified ?? getPeerVerified(selectedConversation, userId)
	const peerImage = peerProfile?.image ?? null

	return (
		<div className="flex h-full flex-1 flex-col">
			<div className="flex items-center gap-3 border-b px-4 py-3">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-8 md:hidden"
					onClick={clearSelectedConversation}
					aria-label="Back to conversations"
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
				</Button>
				<Avatar size="sm">
					<AvatarImage src={peerImage ?? undefined} />
					<AvatarFallback>{getInitials(peerName)}</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-1">
						<p className="truncate text-sm font-medium">{peerName}</p>
						{peerVerified ? (
							<Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
								Verified
							</Badge>
						) : null}
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
				{loadingMessages ? (
					<p className="text-muted-foreground text-xs">Loading messages…</p>
				) : (
					<Chat.List className="space-y-0">
						{hasOlderMessages ? (
							<div className="mb-3 flex justify-center">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="text-muted-foreground h-7 text-xs"
									onClick={handleLoadOlderMessages}
									disabled={loadingOlderMessages}
								>
									{loadingOlderMessages ? "Loading older messages…" : "Load older messages"}
								</Button>
							</div>
						) : null}
						{thread.map((message, index) => {
							const previous = thread[index - 1]
							const next = thread[index + 1]
							const gapBefore = hasGroupBreak(previous, message)
							const gapAfter = !next || hasGroupBreak(message, next)
							const isFirst = gapBefore || previous?.senderId !== message.senderId
							const isLast = gapAfter || next?.senderId !== message.senderId

							return (
								<React.Fragment key={message.id}>
									{gapBefore ? (
										<Chat.TimeSeparator>
											{formatGroupSeparator(previous, message)}
										</Chat.TimeSeparator>
									) : null}
									<MessageBubble
										message={message}
										currentUserId={userId}
										isFirst={isFirst}
										isLast={isLast}
										peerImage={peerImage}
									/>
								</React.Fragment>
							)
						})}
						{isPeerTyping ? (
							<Chat.Bubble variant="received" isFirst isLast>
								<Chat.BubbleAvatar
									src={peerImage ?? undefined}
									fallback={getInitials(peerName)}
									showAvatar
								/>
								<div>
									<Chat.BubbleMessage typing />
									<Chat.BubbleTimestamp>
										{typingParticipantName ?? peerName} is typing...
									</Chat.BubbleTimestamp>
								</div>
							</Chat.Bubble>
						) : null}
					</Chat.List>
				)}
			</div>

			<Separator />
			<form
				className="flex items-center gap-2 p-2 md:p-3"
				onSubmit={event => {
					event.preventDefault()
					setTyping(false)
					sendMessage()
				}}
			>
				<Input
					placeholder="Type a message…"
					value={draft}
					maxLength={DM_MESSAGE_MAX_LENGTH}
					onChange={event => setDraft(event.target.value)}
					className="flex-1"
				/>
				<Button
					type="submit"
					size="icon"
					className="size-9 shrink-0"
					disabled={!draft.trim() || isSending || draft.length > DM_MESSAGE_MAX_LENGTH}
					aria-label="Send message"
				>
					<HugeiconsIcon icon={Sent02Icon} className="size-4" />
				</Button>
			</form>
		</div>
	)
}

function MessageBubble({
	message,
	currentUserId,
	isFirst,
	isLast,
	peerImage,
}: {
	message: Message
	currentUserId: string
	isFirst: boolean
	isLast: boolean
	peerImage: string | null
}) {
	const isMe = message.senderId === currentUserId
	const variant = isMe ? "sent" : "received"
	const avatarFallback = getInitials(message.senderName ?? "")

	return (
		<Chat.Bubble
			variant={variant}
			isFirst={isFirst}
			isLast={isLast}
			timestamp={formatAbsoluteTime(message.createdAt)}
			className={isFirst ? "mt-2" : "mt-0.5"}
		>
			<Chat.BubbleAvatar
				showAvatar={!isMe && isLast}
				src={!isMe ? (peerImage ?? undefined) : undefined}
				fallback={avatarFallback}
			/>
			<div className="space-y-0.5">
				<Chat.BubbleMessage>
					<p className="text-sm">{message.content}</p>
				</Chat.BubbleMessage>
				{isLast ? (
					<Chat.BubbleTimestamp>
						<span>{formatShortTime(message.createdAt)}</span>
						{isMe ? (
							<HugeiconsIcon
								icon={TickDouble01Icon}
								className={`ml-1 inline size-3 ${message.isRead ? "text-primary" : "text-muted-foreground"}`}
							/>
						) : null}
					</Chat.BubbleTimestamp>
				) : null}
			</div>
		</Chat.Bubble>
	)
}
