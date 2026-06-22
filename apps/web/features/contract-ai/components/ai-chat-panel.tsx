"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { Separator } from "@/core/components/ui/separator"
import { Skeleton } from "@/core/components/ui/skeleton"
import { cn } from "@/core/lib/utils"
import { FIXTURE_AI_CHAT, type AiChatMessage } from "@/features/contract-ai/lib/fixtures"

export function AiChatPanel() {
	const [messages, setMessages] = React.useState<AiChatMessage[]>(FIXTURE_AI_CHAT)
	const [draft, setDraft] = React.useState("")
	const [isTyping, setIsTyping] = React.useState(false)
	const scrollRef = React.useRef<HTMLDivElement>(null)

	React.useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
	}, [messages.length, isTyping])

	function handleSend() {
		const text = draft.trim()
		if (!text) return

		const userMsg: AiChatMessage = {
			id: `ai-${Date.now()}`,
			role: "user",
			text,
			timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
		}
		setMessages(prev => [...prev, userMsg])
		setDraft("")
		setIsTyping(true)

		setTimeout(() => {
			const aiMsg: AiChatMessage = {
				id: `ai-${Date.now() + 1}`,
				role: "assistant",
				text: "Thank you for your question. Based on the document analysis, I can provide further insight once I review the relevant sections. Please note that this is a fixture response for demonstration purposes.",
				timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
			}
			setMessages(prev => [...prev, aiMsg])
			setIsTyping(false)
		}, 1500)
	}

	return (
		<Card className="flex h-[calc(100vh-16rem)] flex-col">
			<CardHeader className="pb-3">
				<CardTitle>Contract AI Assistant</CardTitle>
				<p className="text-muted-foreground text-sm">
					Ask questions about your uploaded document. The AI has context from the analysis.
				</p>
			</CardHeader>
			<Separator />
			<CardContent className="flex flex-1 flex-col overflow-hidden p-0">
				<div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
					<div className="space-y-4">
						{messages.map(msg => (
							<div
								key={msg.id}
								className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
							>
								<div
									className={cn(
										"max-w-[80%] rounded-2xl px-4 py-2",
										msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
									)}
								>
									<p className="text-sm whitespace-pre-wrap">{msg.text}</p>
									<p
										className={cn(
											"mt-1 text-[10px]",
											msg.role === "user"
												? "text-primary-foreground/70 text-right"
												: "text-muted-foreground"
										)}
									>
										{msg.timestamp}
									</p>
								</div>
							</div>
						))}
						{isTyping && (
							<div className="flex justify-start">
								<div className="bg-muted space-y-2 rounded-2xl px-4 py-3">
									<Skeleton className="h-3 w-48" />
									<Skeleton className="h-3 w-32" />
								</div>
							</div>
						)}
					</div>
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
						placeholder="Ask about the contract…"
						value={draft}
						onChange={e => setDraft(e.target.value)}
						className="flex-1"
						disabled={isTyping}
					/>
					<Button type="submit" size="sm" disabled={!draft.trim() || isTyping}>
						Send
					</Button>
				</form>
			</CardContent>
		</Card>
	)
}
