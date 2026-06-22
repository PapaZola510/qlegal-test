"use client"

import * as React from "react"
import { Add01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/core/components/ui/avatar"
import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/core/components/ui/dialog"
import { Input } from "@/core/components/ui/input"
import { getInitials } from "@/core/lib/utils"
import { useSearchDmPeersQuery, type DmPeer } from "@/features/messages/api/messages.hooks"
import { useMessagesContext } from "@/features/messages/context/messages-context"

export function MessagesNewChatDialog() {
	const { startConversationWithPeer, isOpeningConversation } = useMessagesContext()
	const [open, setOpen] = React.useState(false)
	const [query, setQuery] = React.useState("")
	const trimmed = query.trim()
	const peerSearch = useSearchDmPeersQuery(trimmed)
	const peers = (peerSearch.data as DmPeer[] | undefined) ?? []

	React.useEffect(() => {
		if (!open) setQuery("")
	}, [open])

	async function handlePick(peer: DmPeer) {
		const result = await startConversationWithPeer(peer.id, peer.existingConversationId)
		if (!result.ok) {
			toast.error(result.message ?? "Could not start conversation.")
			return
		}
		setOpen(false)
		toast.success("Conversation opened")
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-7"
						aria-label="New conversation"
					>
						<HugeiconsIcon icon={Add01Icon} className="size-4" />
					</Button>
				}
			/>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Start a new conversation</DialogTitle>
					<DialogDescription>
						Search for someone by name or email to start chatting.
					</DialogDescription>
				</DialogHeader>
				<div className="relative">
					<HugeiconsIcon
						icon={Search01Icon}
						className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
					/>
					<Input
						autoFocus
						placeholder="Type a name or email…"
						className="pl-8"
						value={query}
						onChange={event => setQuery(event.target.value)}
					/>
				</div>
				<div className="max-h-72 overflow-y-auto">
					{trimmed.length < 2 ? (
						<p className="text-muted-foreground px-1 py-2 text-xs">Enter at least 2 characters.</p>
					) : peerSearch.isLoading ? (
						<p className="text-muted-foreground px-1 py-2 text-xs">Searching…</p>
					) : peerSearch.isError ? (
						<p className="text-destructive px-1 py-2 text-xs">Search failed. Please try again.</p>
					) : peers.length === 0 ? (
						<p className="text-muted-foreground px-1 py-2 text-xs">No people found.</p>
					) : (
						<ul className="space-y-1">
							{peers.map(peer => (
								<li key={peer.id}>
									<button
										type="button"
										onClick={() => void handlePick(peer)}
										disabled={isOpeningConversation}
										className="hover:bg-muted flex w-full items-center gap-3 rounded-md px-2 py-2 text-left disabled:opacity-60"
									>
										<Avatar size="sm">
											<AvatarFallback>{getInitials(peer.name)}</AvatarFallback>
										</Avatar>
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-1">
												<p className="truncate text-sm font-medium">{peer.name}</p>
												{peer.isVerified ? (
													<Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
														Verified
													</Badge>
												) : null}
											</div>
											<p className="text-muted-foreground truncate text-xs">{peer.email}</p>
										</div>
										{peer.existingConversationId ? (
											<span className="text-muted-foreground text-[10px]">Open</span>
										) : (
											<span className="text-muted-foreground text-[10px]">Start</span>
										)}
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}
