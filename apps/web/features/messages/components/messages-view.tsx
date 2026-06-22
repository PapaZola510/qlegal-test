"use client"

import { cn } from "@/core/lib/utils"
import { MessagesChatArea } from "@/features/messages/components/messages-chat-area"
import { MessagesDetailsPanel } from "@/features/messages/components/messages-details-panel"
import { MessagesSidebar } from "@/features/messages/components/messages-sidebar"
import { MessagesProvider, useMessagesContext } from "@/features/messages/context/messages-context"

function MessagesContent() {
	const { loadingConversations, selectedConversation } = useMessagesContext()

	if (loadingConversations) {
		return (
			<div className="bg-background h-[calc(100dvh-14rem)] min-h-112 overflow-hidden rounded-xl border">
				<div className="flex h-full">
					<div className="hidden w-72 flex-col border-r p-4 md:flex lg:w-80">
						<div className="bg-muted mb-4 h-10 w-full animate-pulse rounded-md" />
						<div className="bg-muted mb-2 h-16 w-full animate-pulse rounded-md" />
						<div className="bg-muted mb-2 h-16 w-full animate-pulse rounded-md" />
						<div className="bg-muted h-16 w-full animate-pulse rounded-md" />
					</div>
					<div className="flex flex-1 items-center justify-center">
						<p className="text-muted-foreground">Loading messages...</p>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="bg-background h-[calc(100dvh-14rem)] min-h-112 overflow-hidden rounded-xl border">
			<div className="flex h-full w-full overflow-hidden">
				<div
					className={cn(
						"h-full w-full border-r md:flex md:w-72 md:flex-col lg:w-80",
						selectedConversation ? "hidden md:flex" : "flex"
					)}
				>
					<MessagesSidebar />
				</div>
				<div
					className={cn(
						"h-full w-full flex-1 md:flex",
						selectedConversation ? "flex" : "hidden md:flex"
					)}
				>
					<MessagesChatArea />
				</div>
				<div className="hidden h-full w-80 shrink-0 border-l xl:flex xl:flex-col">
					<MessagesDetailsPanel />
				</div>
			</div>
		</div>
	)
}

export function MessagesView() {
	return (
		<MessagesProvider>
			<MessagesContent />
		</MessagesProvider>
	)
}
