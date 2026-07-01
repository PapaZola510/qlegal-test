"use client"

import { Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"

export function SignConfirmDialog({
	open,
	onOpenChange,
	documentName,
	isConfirming,
	onConfirm,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	documentName: string | null
	isConfirming: boolean
	onConfirm: () => void
}) {
	const label = documentName?.trim() || "this document"

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="z-[200] max-w-md">
				<DialogHeader>
					<DialogTitle className="text-sm">Confirm document signing</DialogTitle>
					<DialogDescription className="text-xs leading-relaxed">
						Did you finish signing <strong>{label}</strong> ?
						<br />
						<br />
						Choose <strong>Yes</strong> only if you completed your signature on the document.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="gap-2 sm:justify-end">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="text-xs"
						disabled={isConfirming}
						onClick={() => onOpenChange(false)}
					>
						No
					</Button>
					<Button
						type="button"
						size="sm"
						className="text-xs"
						disabled={isConfirming}
						onClick={onConfirm}
					>
						{isConfirming ? (
							<>
								<HugeiconsIcon
									icon={Loading03Icon}
									className="mr-1.5 size-4 animate-spin"
									strokeWidth={2}
								/>
								Marking…
							</>
						) : (
							"Yes, I signed"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
