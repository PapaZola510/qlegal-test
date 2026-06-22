"use client"

import * as React from "react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
	IEN_ATTESTATION_CHECKBOX_LABEL,
	notarialAttestationTextFor,
	type MeetingEnbSignatureRequest,
	type NotarialAttestationActType,
	type NotarialAttestationSessionMode,
} from "@repo/contracts"

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

import { EnbSignaturePad, type EnbSignaturePadHandle } from "../enb-signature-pad"

const ENB_ACK_TEXT =
	"I acknowledge that the foregoing entry in the Electronic Notarial Book is true and correct."

export function EnbSigningModal({
	open,
	onOpenChange,
	pending,
	signingRequestId,
	attestationRequired,
	notarizationType,
	sessionMode,
	onSign,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	pending: MeetingEnbSignatureRequest[]
	signingRequestId: string | null
	attestationRequired: boolean
	notarizationType: NotarialAttestationActType
	sessionMode: NotarialAttestationSessionMode
	onSign: (requestId: string, acknowledgment: string, signatureImageData: string) => void
}) {
	const active = pending[0]
	const padRef = React.useRef<EnbSignaturePadHandle | null>(null)
	const [signatureError, setSignatureError] = React.useState<string | null>(null)
	const [acknowledged, setAcknowledged] = React.useState(false)

	const attestationRole = active?.signerRole === "witness" ? "witness" : "principal"

	const attestationText = React.useMemo(() => {
		if (!attestationRequired) return ENB_ACK_TEXT
		return (
			notarialAttestationTextFor({
				notarizationType,
				sessionMode,
				role: attestationRole,
			}) ?? ENB_ACK_TEXT
		)
	}, [attestationRequired, attestationRole, notarizationType, sessionMode])

	const acknowledgmentText = attestationRequired ? IEN_ATTESTATION_CHECKBOX_LABEL : ENB_ACK_TEXT

	React.useEffect(() => {
		if (!open) return
		setSignatureError(null)
		setAcknowledged(false)
		padRef.current?.clear()
	}, [open, active?.id])

	if (!active) return null

	const roleLabel = active.signerRole === "witness" ? "Witness" : "Principal"
	const canSign = !attestationRequired || acknowledged
	const signing = signingRequestId === active.id

	return (
		<Dialog
			open={open}
			disablePointerDismissal
			onOpenChange={next => {
				if (next) onOpenChange(true)
			}}
		>
			<DialogContent
				className="z-[200] flex max-h-[92vh] max-w-[min(100vw-1.5rem,56rem)] flex-col gap-5 overflow-y-auto p-6 sm:max-w-[min(100vw-2rem,56rem)] sm:p-8"
				showCloseButton={false}
			>
				<DialogHeader className="text-left">
					<DialogTitle>Sign notarial book entry</DialogTitle>
					<DialogDescription className="text-sm leading-relaxed">
						Rule §4 requires each {roleLabel.toLowerCase()} to electronically sign the ENB entry
						before the session ends. Read the acknowledgment, then draw your signature.
					</DialogDescription>
				</DialogHeader>

				<div className="bg-muted/50 grid gap-3 rounded-md border px-4 py-3 text-sm sm:grid-cols-3">
					<p>
						<span className="text-muted-foreground block text-xs">Entry no.</span>
						<span className="font-mono font-medium">{active.entryNumber}</span>
					</p>
					<p>
						<span className="text-muted-foreground block text-xs">Document</span>
						<span className="font-medium">{active.documentTitle}</span>
					</p>
					<p>
						<span className="text-muted-foreground block text-xs">Signer ({roleLabel})</span>
						<span className="font-medium">{active.signerName}</span>
					</p>
				</div>

				{pending.length > 1 ? (
					<p className="text-muted-foreground text-sm">
						{pending.length} entries remaining — you will be prompted for each.
					</p>
				) : null}

				<div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
					<div className="space-y-4">
						{attestationRequired ? (
							<IenAttestationPrompt
								role={attestationRole}
								attestationText={attestationText}
								documentTitle={active.documentTitle}
								acknowledged={acknowledged}
								onAcknowledgedChange={setAcknowledged}
								disabled={Boolean(signingRequestId)}
							/>
						) : (
							<div className="space-y-2 rounded-lg border bg-muted/30 p-4">
								<p className="text-sm font-medium">Acknowledgment</p>
								<div className="bg-background max-h-56 overflow-y-auto rounded-md border px-3 py-2">
									<p className="text-sm leading-relaxed">{ENB_ACK_TEXT}</p>
								</div>
							</div>
						)}
					</div>

					<div className="space-y-2 lg:sticky lg:top-0">
						<EnbSignaturePad
							ref={padRef}
							layoutKey={open ? active.id : null}
							padHeight={180}
							disabled={Boolean(signingRequestId) || !canSign}
						/>
						{signatureError ? (
							<p className="text-destructive text-sm" role="alert">
								{signatureError}
							</p>
						) : null}
						{!canSign ? (
							<p className="text-muted-foreground text-xs">
								Check the acknowledgment box to enable the signature pad.
							</p>
						) : null}
					</div>
				</div>

				<DialogFooter className="gap-2 sm:justify-end">
					<Button
						type="button"
						variant="outline"
						disabled={Boolean(signingRequestId)}
						onClick={() => onOpenChange(false)}
					>
						Later
					</Button>
					<Button
						type="button"
						disabled={Boolean(signingRequestId) || !canSign}
						onClick={() => {
							setSignatureError(null)
							const signatureImageData = padRef.current?.getSignatureDataUrl()
							if (!signatureImageData) {
								setSignatureError("Please draw your signature in the pad.")
								return
							}
							onSign(active.id, acknowledgmentText, signatureImageData)
						}}
					>
						{signing ? (
							<>
								<HugeiconsIcon
									icon={Loading03Icon}
									className="mr-1.5 size-4 animate-spin"
									strokeWidth={2}
								/>
								Signing…
							</>
						) : (
							"Sign entry"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
