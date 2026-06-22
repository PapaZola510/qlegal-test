"use client"

import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"

export function RecordingConsentDialog({
	open,
	onOpenChange,
	isStarting,
	onContinue,
	onCancel,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	isStarting: boolean
	onContinue: () => void
	onCancel: () => void
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="z-[250] max-w-md">
				<DialogHeader>
					<DialogTitle className="text-sm">Record this meeting?</DialogTitle>
					<DialogDescription className="text-xs leading-relaxed">
						All participants will be notified that this session is being recorded. The video file
						will be saved to your device for your notarial record when you stop recording.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="gap-2 sm:justify-end">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="text-xs"
						disabled={isStarting}
						onClick={onCancel}
					>
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						className="text-xs"
						disabled={isStarting}
						onClick={onContinue}
					>
						{isStarting ? "Starting…" : "Continue recording"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
