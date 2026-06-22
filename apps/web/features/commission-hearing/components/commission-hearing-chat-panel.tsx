"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"

import type { CommissionHearingChatMessage } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { useSendHearingChatMutation } from "@/features/commission-hearing/api/commission-hearing.hooks"

export function CommissionHearingChatPanel({
	hearingRoomId,
	selfDisplayHint,
	messages,
	isLoading,
}: {
	hearingRoomId: string
	selfDisplayHint: string | undefined
	messages: CommissionHearingChatMessage[]
	isLoading: boolean
}) {
	const send = useSendHearingChatMutation()
	const [draft, setDraft] = React.useState("")
	const bottomRef = React.useRef<HTMLDivElement>(null)

	React.useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [messages.length])

	function submit() {
		const body = draft.trim()
		if (!body || send.isPending) return
		setDraft("")
		send.mutate({ id: hearingRoomId, body })
	}

	return (
		<Card className="flex h-full min-h-0 w-full flex-1 flex-col">
			<CardHeader className="shrink-0 pb-2">
				<CardTitle className="text-sm font-semibold">Hearing chat</CardTitle>
				<CardDescription className="text-xs">
					Messages are saved with this commission hearing.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex min-h-0 flex-1 flex-col gap-2">
				<div className="border-input bg-muted/30 flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border">
					<div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain p-2">
						{isLoading && <p className="text-muted-foreground text-xs">Loading chat…</p>}
						{!isLoading && messages.length === 0 && (
							<p className="text-muted-foreground text-xs">No messages yet.</p>
						)}
						{messages.map(message => (
							<div key={message.id} className="text-xs">
								<div className="text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
									<span className="text-foreground font-medium">
										{selfDisplayHint && message.senderName === selfDisplayHint
											? "You"
											: message.senderName}
									</span>
									<span title={message.createdAt} className="font-mono text-[10px]">
										{format(parseISO(message.createdAt), "h:mm a")}
									</span>
								</div>
								<p className="text-foreground/90 mt-1 whitespace-pre-wrap">{message.body}</p>
							</div>
						))}
						<div ref={bottomRef} />
					</div>
				</div>
				<form
					className="flex shrink-0 gap-2"
					onSubmit={event => {
						event.preventDefault()
						submit()
					}}
				>
					<Input
						value={draft}
						onChange={event => setDraft(event.target.value)}
						placeholder="Type a message…"
						maxLength={4000}
						disabled={send.isPending}
						className="min-w-0 flex-1 text-sm"
					/>
					<Button type="submit" size="sm" disabled={send.isPending || !draft.trim()}>
						Send
					</Button>
				</form>
			</CardContent>
		</Card>
	)
}
