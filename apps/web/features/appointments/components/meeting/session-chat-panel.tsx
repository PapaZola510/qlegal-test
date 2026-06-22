"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"

import type { SessionChatMessage } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"

import { useSendSessionChatMutation } from "../../api/meeting.hooks"

export function SessionChatPanel({
	sessionRoomId,
	selfDisplayHint,
	messages,
	isLoading,
}: {
	sessionRoomId: string
	selfDisplayHint: string | undefined
	messages: SessionChatMessage[]
	isLoading: boolean
}) {
	const send = useSendSessionChatMutation()
	const [draft, setDraft] = React.useState("")
	const bottomRef = React.useRef<HTMLDivElement>(null)

	React.useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [messages.length])

	function submit() {
		const body = draft.trim()
		if (!body || send.isPending) return
		setDraft("")
		send.mutate({ sessionRoomId, body })
	}

	return (
		<Card className="flex h-full min-h-0 w-full flex-1 flex-col">
			<CardHeader className="shrink-0 pb-2">
				<CardTitle className="text-sm font-semibold">Meeting log</CardTitle>
				<CardDescription className="text-xs">
					Messages are saved with the session for your audit trail. Signing uses the instruments
					panel.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex min-h-0 flex-1 flex-col gap-2">
				<div className="border-input bg-muted/30 flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border">
					<div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain p-2">
						{isLoading && <p className="text-muted-foreground text-xs">Loading chat…</p>}
						{!isLoading && messages.length === 0 && (
							<p className="text-muted-foreground text-xs">Say hello — this thread is persisted.</p>
						)}
						{messages.map(m => (
							<div key={m.id} className="text-xs">
								<div className="text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
									<span className="text-foreground font-medium">
										{selfDisplayHint && m.senderName === selfDisplayHint ? "You" : m.senderName}
									</span>
									<span title={m.createdAt} className="font-mono text-[10px]">
										{format(parseISO(m.createdAt), "h:mm a")}
									</span>
								</div>
								<p className="text-foreground/90 mt-1 whitespace-pre-wrap">{m.body}</p>
							</div>
						))}
						<div ref={bottomRef} />
					</div>
				</div>
				<form
					className="flex shrink-0 gap-2"
					onSubmit={e => {
						e.preventDefault()
						submit()
					}}
				>
					<Input
						value={draft}
						onChange={e => setDraft(e.target.value)}
						placeholder="Type a message…"
						maxLength={4000}
						disabled={send.isPending}
						title="Message is persisted on the server for this session"
						className="min-w-0 flex-1 text-sm"
					/>
					<Button
						type="submit"
						size="sm"
						disabled={send.isPending || !draft.trim()}
						title="Send to all participants"
					>
						Send
					</Button>
				</form>
			</CardContent>
		</Card>
	)
}
