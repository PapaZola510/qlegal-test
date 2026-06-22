"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { subscribeQlegalEvent } from "@/services/ws/ws-client"

function resolveRoleLabel(role?: string | null): string {
	if (role === "enp") return "The notary"
	if (role === "guest_signer") return "A session guest"
	if (role === "client") return "The principal"
	return "A participant"
}

function resolveDescription(role?: string | null): string {
	if (role === "enp") {
		return "The notary has started recording this session. You may stay or leave — your choice will not affect the notarial record."
	}
	if (role === "client") {
		return "The principal has started recording this session. You may stay or leave the meeting."
	}
	if (role === "guest_signer") {
		return "A session guest has started recording. You may stay or leave the meeting."
	}
	return "A participant has started recording this session. You may stay or leave the meeting."
}

export function MeetingRecordingNoticeOverlay({
	sessionRoomId,
	isEnp,
	selfUserId,
	onLeave,
}: {
	sessionRoomId: string
	isEnp: boolean
	selfUserId?: string | null
	onLeave: () => void
}) {
	const [open, setOpen] = React.useState(false)
	const [senderRole, setSenderRole] = React.useState<string | null>(null)
	const [senderDisplayName, setSenderDisplayName] = React.useState<string | null>(null)
	const toastShownRef = React.useRef(false)

	React.useEffect(() => {
		const off = subscribeQlegalEvent("session:recording-notice", payload => {
			const notice = payload as typeof payload & { senderUserId?: string }
			if (notice.sessionRoomId !== sessionRoomId) return

			if (notice.status === "stopped") {
				setOpen(false)
				toastShownRef.current = false
				return
			}

			if (notice.senderUserId && notice.senderUserId === selfUserId) return
			if (isEnp && (!notice.senderRole || notice.senderRole === "enp")) return

			if (notice.status === "started" || notice.status === "acknowledged") {
				setSenderRole(notice.senderRole ?? null)
				setSenderDisplayName(notice.senderDisplayName ?? null)
				setOpen(true)
				if (!toastShownRef.current) {
					toastShownRef.current = true
					const who = notice.senderDisplayName ?? resolveRoleLabel(notice.senderRole)
					toast.info(`${who} is recording this meeting session.`, { duration: 10_000 })
				}
			}
		})
		return () => off()
	}, [isEnp, selfUserId, sessionRoomId])

	if (!open) return null

	const recorderLabel = senderDisplayName ?? resolveRoleLabel(senderRole)

	return (
		<Dialog open disablePointerDismissal>
			<DialogContent className="z-[250] max-w-sm" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle className="text-center text-sm font-semibold">
						This meeting is being recorded
					</DialogTitle>
					<DialogDescription className="text-center text-xs leading-relaxed">
						{recorderLabel} has started or is preparing to record this session. By staying in the
						meeting, you acknowledge that the session may be recorded for the notarial record. Look
						for the red &quot;Recording&quot; timer in the header while capture is active.
					</DialogDescription>
				</DialogHeader>
				<div className="bg-muted/45 border-border/80 space-y-1 rounded-md border px-3 py-2.5">
					<p className="text-foreground text-xs font-medium">Privacy and data sharing notice</p>
					<p className="text-muted-foreground text-xs leading-relaxed">
						All parties&apos; personal information will be collected and processed in accordance
						with Republic Act No. 10173, the Data Privacy Act of 2012, and shared with the Supreme
						Court in accordance with the Electronic Notarization Data Sharing Guidelines.
					</p>
				</div>
				<DialogFooter className="flex-col gap-2 sm:flex-col">
					<Button type="button" size="sm" className="w-full text-xs" onClick={() => setOpen(false)}>
						Join anyway
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="w-full text-xs"
						onClick={() => {
							setOpen(false)
							onLeave()
						}}
					>
						Leave meeting
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
