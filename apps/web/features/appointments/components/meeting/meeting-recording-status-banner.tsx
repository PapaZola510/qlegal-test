"use client"

import * as React from "react"

import { subscribeQlegalEvent } from "@/services/ws/ws-client"

function pad2(n: number) {
	return n.toString().padStart(2, "0")
}

function formatElapsed(totalSeconds: number) {
	const h = Math.floor(totalSeconds / 3600)
	const m = Math.floor((totalSeconds % 3600) / 60)
	const s = Math.floor(totalSeconds % 60)
	return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`
}

/** Live elapsed timer for participants while someone else is recording the session. */
export function MeetingRecordingStatusBanner({
	sessionRoomId,
	selfUserId,
}: {
	sessionRoomId: string
	selfUserId?: string | null
}) {
	const [active, setActive] = React.useState(false)
	const [startedAtMs, setStartedAtMs] = React.useState<number | null>(null)
	const [elapsed, setElapsed] = React.useState(0)
	const [recorderUserId, setRecorderUserId] = React.useState<string | null>(null)

	React.useEffect(() => {
		const off = subscribeQlegalEvent("session:recording-notice", payload => {
			const notice = payload as typeof payload & { senderUserId?: string }
			if (notice.sessionRoomId !== sessionRoomId) return
			if (notice.status === "started") {
				setActive(true)
				setStartedAtMs(null)
				setElapsed(0)
				setRecorderUserId(notice.senderUserId ?? null)
			}
			if (notice.status === "acknowledged") {
				const parsed = notice.startedAt ? Date.parse(notice.startedAt) : Number.NaN
				setStartedAtMs(Number.isFinite(parsed) ? parsed : Date.now())
				setActive(true)
				setRecorderUserId(notice.senderUserId ?? null)
			}
			if (notice.status === "stopped") {
				setActive(false)
				setStartedAtMs(null)
				setElapsed(0)
				setRecorderUserId(null)
			}
		})
		return () => off()
	}, [sessionRoomId])

	React.useEffect(() => {
		if (!active || startedAtMs === null) return undefined
		const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)))
		tick()
		const id = window.setInterval(tick, 500)
		return () => window.clearInterval(id)
	}, [active, startedAtMs])

	if (!active) return null
	if (recorderUserId && selfUserId && recorderUserId === selfUserId) return null

	return (
		<span
			className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400"
			role="status"
			aria-live="polite"
		>
			<span className="size-2 animate-pulse rounded-full bg-red-500" aria-hidden />
			Recording{startedAtMs !== null ? ` · ${formatElapsed(elapsed)}` : "…"}
		</span>
	)
}
