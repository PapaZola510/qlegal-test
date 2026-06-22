"use client"

import { useParticipants } from "@livekit/components-react"

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"

export function SessionParticipantsPanel({ selfDisplayName }: { selfDisplayName: string }) {
	const participants = useParticipants()

	return (
		<Card className="flex flex-col">
			<CardHeader className="shrink-0 pb-2">
				<CardTitle className="text-sm font-semibold">Participants</CardTitle>
				<CardDescription className="text-xs">
					Everyone currently in this LiveKit room.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{participants.length === 0 ? (
					<p className="text-muted-foreground text-xs">Waiting for others to join…</p>
				) : (
					<ul className="space-y-2">
						{participants.map((p, idx) => {
							const display = p.name?.trim() || p.identity
							const isYou = display === selfDisplayName || p.identity === selfDisplayName
							return (
								<li
									key={`${p.identity}-${idx}`}
									className="flex items-center justify-between gap-2 text-xs"
								>
									<span className="truncate">{display}</span>
									<span className="text-muted-foreground shrink-0">
										{isYou ? "You" : "Connected"}
									</span>
								</li>
							)
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	)
}
