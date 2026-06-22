"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"

export function CommissionHearingRecordingNoticeOverlay({
	isRecording,
	onLeave,
}: {
	isRecording: boolean
	onLeave: () => void
}) {
	const [open, setOpen] = React.useState(false)
	const shownRef = React.useRef(false)

	React.useEffect(() => {
		if (isRecording && !shownRef.current) {
			shownRef.current = true
			setOpen(true)
		}
		if (!isRecording) shownRef.current = false
	}, [isRecording])

	if (!open) return null

	return (
		<Dialog open disablePointerDismissal>
			<DialogContent className="z-[250] max-w-sm" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle className="text-center text-sm font-semibold">
						This hearing is being recorded
					</DialogTitle>
					<DialogDescription className="text-center text-xs leading-relaxed">
						Server-side recording is active for the commission hearing record. By staying in the
						meeting, you acknowledge that audio, video, and screen sharing may be captured. Look for
						the red &quot;Recording&quot; badge in the header while capture is active.
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
