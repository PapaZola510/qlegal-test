"use client"

import * as React from "react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { CtcPaymentMethod, UserProfile } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { Label } from "@/core/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/core/components/ui/radio-group"
import { Textarea } from "@/core/components/ui/textarea"

const ACK_TEXT =
	"I request a certified true copy of the notarized document described below and affirm that the information provided is true."

export function RequestCtcModal({
	open,
	onOpenChange,
	documentTitle,
	enpName,
	entryHint,
	defaultAddress,
	kycVerified,
	isSubmitting,
	onSubmit,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	documentTitle: string
	enpName: string
	entryHint?: string | null
	defaultAddress: string
	kycVerified: boolean
	isSubmitting: boolean
	onSubmit: (input: {
		requesterAddress: string
		lawfulPurpose: string
		paymentMethod: CtcPaymentMethod
	}) => Promise<void>
}) {
	const [address, setAddress] = React.useState(defaultAddress)
	const [purpose, setPurpose] = React.useState("")
	const [paymentMethod, setPaymentMethod] = React.useState<CtcPaymentMethod>("cash")
	const [formError, setFormError] = React.useState<string | null>(null)

	React.useEffect(() => {
		if (!open) return
		setAddress(defaultAddress)
		setPurpose("")
		setPaymentMethod("cash")
		setFormError(null)
	}, [open, defaultAddress, documentTitle])

	return (
		<Dialog
			open={open}
			disablePointerDismissal
			onOpenChange={next => !isSubmitting && onOpenChange(next)}
		>
			<DialogContent className="max-w-lg gap-4" showCloseButton={!isSubmitting}>
				<DialogHeader className="text-left">
					<DialogTitle className="text-sm">Request certified true copy</DialogTitle>
					<DialogDescription className="text-xs leading-relaxed">
						Your request is sent to {enpName} for review. Verified identity on your profile is
						required. Your notary will complete the ENB compliance form and sign before granting the
						copy. If you choose online payment, you can pay from the Signed page after approval.
					</DialogDescription>
				</DialogHeader>

				{!kycVerified ? (
					<p className="text-destructive text-xs" role="alert">
						Complete identity verification on your Profile before submitting this request.
					</p>
				) : null}

				<div className="space-y-4 text-xs">
					<div className="bg-muted/50 rounded-md border px-3 py-2">
						<p>
							<span className="text-muted-foreground">Document:</span>{" "}
							<span className="font-medium">{documentTitle}</span>
						</p>
						{entryHint ? (
							<p className="mt-1">
								<span className="text-muted-foreground">Registry entry:</span>{" "}
								<span className="font-mono font-medium">{entryHint}</span>
							</p>
						) : null}
					</div>

					<div className="space-y-1.5">
						<p className="text-muted-foreground">Acknowledgment</p>
						<div className="bg-muted/40 rounded-md border px-3 py-2">
							<p className="text-xs leading-relaxed">{ACK_TEXT}</p>
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="ctc-address">Your address</Label>
							<Textarea
								id="ctc-address"
								value={address}
								onChange={e => setAddress(e.target.value)}
								rows={4}
								disabled={isSubmitting}
								className="min-h-24 resize-none"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="ctc-purpose">Lawful purpose</Label>
							<Textarea
								id="ctc-purpose"
								value={purpose}
								onChange={e => setPurpose(e.target.value)}
								placeholder="e.g. Submission to BIR, bank loan application, court filing"
								rows={4}
								disabled={isSubmitting}
								className="min-h-24 resize-none"
							/>
						</div>
					</div>

					<div className="space-y-2">
						<p className="text-muted-foreground">Payment</p>
						<RadioGroup
							value={paymentMethod}
							onValueChange={(value: unknown) =>
								setPaymentMethod((String(value ?? "cash") as CtcPaymentMethod) || "cash")
							}
							className="flex flex-wrap gap-4"
						>
							<div className="flex items-center gap-2">
								<RadioGroupItem value="cash" id="ctc-pay-cash" disabled={isSubmitting} />
								<Label htmlFor="ctc-pay-cash" className="font-normal">
									Cash (pay your notary directly)
								</Label>
							</div>
							<div className="flex items-center gap-2">
								<RadioGroupItem value="online" id="ctc-pay-online" disabled={isSubmitting} />
								<Label htmlFor="ctc-pay-online" className="font-normal">
									Online (AltPayNet)
								</Label>
							</div>
						</RadioGroup>
					</div>
				</div>

				{formError ? (
					<p className="text-destructive text-xs" role="alert">
						{formError}
					</p>
				) : null}

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
						disabled={isSubmitting || !kycVerified}
						onClick={async () => {
							setFormError(null)
							if (!address.trim()) {
								setFormError("Please enter your address.")
								return
							}
							if (!purpose.trim()) {
								setFormError("Please state your lawful purpose for this request.")
								return
							}
							await onSubmit({
								requesterAddress: address.trim(),
								lawfulPurpose: purpose.trim(),
								paymentMethod,
							})
						}}
					>
						{isSubmitting ? (
							<>
								<HugeiconsIcon
									icon={Loading03Icon}
									className="mr-1.5 size-4 animate-spin"
									strokeWidth={2}
								/>
								Submitting…
							</>
						) : (
							"Submit request"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export function defaultRequesterAddress(profile: UserProfile | undefined): string {
	if (!profile) return ""
	return (
		profile.residentialAddress?.trim() ||
		profile.officeAddress?.trim() ||
		profile.regionProvinceCity?.trim() ||
		""
	)
}
