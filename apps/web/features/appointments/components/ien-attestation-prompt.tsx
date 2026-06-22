"use client"

import type { IenAttestationRole } from "@repo/contracts"

import { Checkbox } from "@/core/components/ui/checkbox"
import { Label } from "@/core/components/ui/label"
import {
	IEN_ATTESTATION_CHECKBOX_LABEL,
	IEN_ATTESTATION_ROLE_LABELS,
	IEN_ATTESTATION_TEXTS,
} from "@/features/appointments/lib/ien-attestation-texts"

export function IenAttestationPrompt({
	role,
	attestationText,
	documentTitle,
	acknowledged,
	onAcknowledgedChange,
	disabled = false,
}: {
	role: IenAttestationRole
	/** When omitted, falls back to generic IEN acknowledgment text for the role. */
	attestationText?: string
	documentTitle?: string
	acknowledged: boolean
	onAcknowledgedChange: (checked: boolean) => void
	disabled?: boolean
}) {
	const roleLabel = IEN_ATTESTATION_ROLE_LABELS[role]
	const bodyText = attestationText?.trim() || IEN_ATTESTATION_TEXTS[role]

	return (
		<div className="bg-muted/30 space-y-3 rounded-lg border p-4">
			<div className="space-y-1">
				<p className="text-sm font-medium">Notarial acknowledgment ({roleLabel})</p>
				{documentTitle ? (
					<p className="text-muted-foreground text-xs">
						Document: <span className="text-foreground font-medium">{documentTitle}</span>
					</p>
				) : null}
				<p className="text-muted-foreground text-xs leading-relaxed">
					Before proceeding, read the statement below and confirm your acknowledgment.
				</p>
			</div>

			<div className="bg-background max-h-48 overflow-y-auto rounded-md border px-3 py-2">
				<p className="text-xs leading-relaxed whitespace-pre-wrap">{bodyText}</p>
			</div>

			<div className="flex items-start gap-2">
				<Checkbox
					id={`ien-attest-${role}`}
					checked={acknowledged}
					disabled={disabled}
					onCheckedChange={value => onAcknowledgedChange(value === true)}
				/>
				<Label
					htmlFor={`ien-attest-${role}`}
					className="text-xs leading-relaxed font-normal peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
				>
					{IEN_ATTESTATION_CHECKBOX_LABEL}
				</Label>
			</div>
		</div>
	)
}
