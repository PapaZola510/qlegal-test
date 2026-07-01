"use client"

import { Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { IenAttestationRole } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { IenAttestationPrompt } from "@/features/appointments/components/ien-attestation-prompt"

export function NotarialAttestationDialog({
	open,
	onOpenChange,
	role,
	attestationText,
	documentName,
	acknowledged,
	onAcknowledgedChange,
	isSubmitting,
	onConfirm,
	confirmLabel = "Continue to sign",
	description,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	role: IenAttestationRole
	attestationText: string
	documentName: string | null
	acknowledged: boolean
	onAcknowledgedChange: (checked: boolean) => void
	isSubmitting: boolean
	onConfirm: () => void
	confirmLabel?: string
	description?: string
}) {
	const label = documentName?.trim() || "this document"
	const dialogDescription =
		description ??
		`Before signing ${label} , read and confirm the legal statement below.`

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="z-[200] max-w-lg">
				<DialogHeader>
					<DialogTitle className="text-sm">Notarial acknowledgment required</DialogTitle>
					<DialogDescription className="text-xs leading-relaxed">
						{dialogDescription}
					</DialogDescription>
				</DialogHeader>

				<IenAttestationPrompt
					role={role}
					attestationText={attestationText}
					documentTitle={documentName ?? undefined}
					acknowledged={acknowledged}
					onAcknowledgedChange={onAcknowledgedChange}
					disabled={isSubmitting}
				/>

				<DialogFooter className="gap-2 sm:justify-end">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="text-xs"
						disabled={isSubmitting}
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						className="text-xs"
						disabled={!acknowledged || isSubmitting}
						onClick={onConfirm}
					>
						{isSubmitting ? (
							<>
								<HugeiconsIcon
									icon={Loading03Icon}
									className="mr-1.5 size-4 animate-spin"
									strokeWidth={2}
								/>
								Confirming…
							</>
						) : (
							confirmLabel
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
