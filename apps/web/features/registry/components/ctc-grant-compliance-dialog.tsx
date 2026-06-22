"use client"

import * as React from "react"

import type { CtcComplianceForm, EnbAccessRequest } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import { Checkbox } from "@/core/components/ui/checkbox"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/core/components/ui/select"
import { Textarea } from "@/core/components/ui/textarea"
import {
	EnbSignaturePad,
	type EnbSignaturePadHandle,
} from "@/features/appointments/components/meeting/enb-signature-pad"

import { buildCtcCompliancePrefill } from "../lib/ctc-compliance-prefill"
import type { RegistryAct } from "../lib/fixtures"

interface CtcGrantComplianceDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	request: EnbAccessRequest | null
	registryAct: RegistryAct | undefined
	isSubmitting: boolean
	onGrant: (input: { ctcCompliance: CtcComplianceForm; enpSignatureImageData: string }) => void
	onRefuse: (refusalReason: string) => void
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="grid gap-2 border-b py-4 last:border-b-0 sm:grid-cols-[minmax(11rem,34%)_1fr] sm:items-start sm:gap-x-6">
			<p className="text-muted-foreground text-sm leading-snug font-medium">{label}</p>
			<div className="min-w-0 text-sm">{children}</div>
		</div>
	)
}

export function CtcGrantComplianceDialog({
	open,
	onOpenChange,
	request,
	registryAct,
	isSubmitting,
	onGrant,
	onRefuse,
}: CtcGrantComplianceDialogProps) {
	const padRef = React.useRef<EnbSignaturePadHandle | null>(null)
	const [form, setForm] = React.useState<CtcComplianceForm | null>(null)
	const [refusalReason, setRefusalReason] = React.useState("")
	const [error, setError] = React.useState<string | null>(null)
	const [mode, setMode] = React.useState<"grant" | "refuse">("grant")

	React.useEffect(() => {
		if (!open || !request) return
		setForm(buildCtcCompliancePrefill(request, registryAct))
		setRefusalReason("")
		setError(null)
		setMode("grant")
		padRef.current?.clear()
	}, [open, request, registryAct])

	if (!request || !form) return null

	function patch<K extends keyof CtcComplianceForm>(key: K, value: CtcComplianceForm[K]) {
		setForm(prev => (prev ? { ...prev, [key]: value } : prev))
	}

	function submitGrant() {
		setError(null)
		const current = form
		if (!current) {
			setError("Compliance form is not ready yet.")
			return
		}
		if (!current.notarialActDate.trim()) {
			setError("Date of the notarial act is required.")
			return
		}
		if (!current.documentType.trim()) {
			setError("Type of notarial document is required.")
			return
		}
		if (!current.principalNames.trim()) {
			setError("Name of principals is required.")
			return
		}
		if (!current.purposeOfRequest.trim()) {
			setError("Purpose of the request is required.")
			return
		}
		if (!current.entryRequested.trim()) {
			setError("Entry requested is required.")
			return
		}
		if (current.lawEnforcementCourtOrderAttached && !current.lawEnforcementNotes?.trim()) {
			setError("Describe the court order when the requesting party is law enforcement.")
			return
		}
		const enpSignatureImageData = padRef.current?.getSignatureDataUrl()
		if (!enpSignatureImageData) {
			setError("Draw your electronic signature as the Electronic Notary Public.")
			return
		}
		onGrant({
			ctcCompliance: {
				...current,
				witnessNames: current.witnessNames?.trim() || undefined,
				lawEnforcementNotes: current.lawEnforcementNotes?.trim() || undefined,
			},
			enpSignatureImageData,
		})
	}

	function submitRefuse() {
		setError(null)
		if (!refusalReason.trim()) {
			setError("Refusal reason is required.")
			return
		}
		onRefuse(refusalReason.trim())
	}

	return (
		<Dialog open={open} disablePointerDismissal onOpenChange={next => !isSubmitting && onOpenChange(next)}>
			<DialogContent
				className="flex max-h-[92vh] max-w-[min(100vw-1.5rem,56rem)] flex-col gap-5 overflow-y-auto p-6 sm:max-w-[min(100vw-2rem,56rem)] sm:p-8"
				showCloseButton={!isSubmitting}
			>
				<DialogHeader className="text-left">
					<DialogTitle>Certified true copy — compliance form</DialogTitle>
					<DialogDescription className="text-sm leading-relaxed">
						Complete this form and sign as the Electronic Notary Public before granting the certified
						true copy request from {request.requesterName}. The client&apos;s identity was verified
						through eKYC at request time; your signature attests this ENB access log entry.
					</DialogDescription>
				</DialogHeader>

				<div className="flex gap-2">
					<Button
						type="button"
						size="sm"
						variant={mode === "grant" ? "default" : "outline"}
						onClick={() => setMode("grant")}
						disabled={isSubmitting}
					>
						Grant (complete form)
					</Button>
					<Button
						type="button"
						size="sm"
						variant={mode === "refuse" ? "destructive" : "outline"}
						onClick={() => setMode("refuse")}
						disabled={isSubmitting}
					>
						Refuse
					</Button>
				</div>

				{mode === "grant" ? (
					<div className="space-y-5">
						<div className="divide-border divide-y rounded-lg border px-4 sm:px-6">
							<FormRow label="Requesting Party Identity Check">
								<Input
									value={form.requestingPartyIdentityCheck}
									onChange={e => patch("requestingPartyIdentityCheck", e.target.value)}
									disabled={isSubmitting}
									className="h-10 w-full text-sm"
								/>
							</FormRow>
							<FormRow label="Date of the Notarial Act Performed">
								<Input
									type="date"
									value={form.notarialActDate}
									onChange={e => patch("notarialActDate", e.target.value)}
									disabled={isSubmitting}
									className="h-10 w-full max-w-xs text-sm"
								/>
							</FormRow>
							<FormRow label="Type of Notarial Document">
								<Input
									value={form.documentType}
									onChange={e => patch("documentType", e.target.value)}
									disabled={isSubmitting}
									className="h-10 w-full text-sm"
								/>
							</FormRow>
							<FormRow label="Name of Principals">
								<Textarea
									value={form.principalNames}
									onChange={e => patch("principalNames", e.target.value)}
									disabled={isSubmitting}
									rows={3}
									className="min-h-20 w-full resize-y text-sm"
								/>
							</FormRow>
							<FormRow label="Name of Witnesses if Any">
								<Textarea
									value={form.witnessNames ?? ""}
									onChange={e => patch("witnessNames", e.target.value)}
									disabled={isSubmitting}
									rows={3}
									className="min-h-20 w-full resize-y text-sm"
								/>
							</FormRow>
							<FormRow label="Purpose of the Request">
								<Textarea
									value={form.purposeOfRequest}
									onChange={e => patch("purposeOfRequest", e.target.value)}
									disabled={isSubmitting}
									rows={3}
									className="min-h-20 w-full resize-y text-sm"
								/>
							</FormRow>
							<FormRow label="Entry requested by the Requesting Party">
								<Input
									value={form.entryRequested}
									onChange={e => patch("entryRequested", e.target.value)}
									disabled={isSubmitting}
									className="h-10 w-full max-w-md font-mono text-sm"
								/>
							</FormRow>
							<FormRow label="If requesting party is law enforcement, court order must be attached">
								<div className="space-y-3">
									<label className="flex items-center gap-2.5 text-sm">
										<Checkbox
											checked={form.lawEnforcementCourtOrderAttached}
											onCheckedChange={checked =>
												patch("lawEnforcementCourtOrderAttached", checked === true)
											}
											disabled={isSubmitting}
										/>
										<span>Court order attached</span>
									</label>
									{form.lawEnforcementCourtOrderAttached ? (
										<Textarea
											value={form.lawEnforcementNotes ?? ""}
											onChange={e => patch("lawEnforcementNotes", e.target.value)}
											placeholder="Court order reference / notes"
											disabled={isSubmitting}
											rows={3}
											className="min-h-20 w-full resize-y text-sm"
										/>
									) : null}
								</div>
							</FormRow>
							<FormRow label="Payment (cash or online)">
								<Select
									value={form.paymentMethod}
									onValueChange={v => patch("paymentMethod", v as CtcComplianceForm["paymentMethod"])}
									disabled={isSubmitting}
								>
									<SelectTrigger className="h-10 w-full max-w-xs text-sm">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="cash">Cash</SelectItem>
										<SelectItem value="online">Online</SelectItem>
									</SelectContent>
								</Select>
							</FormRow>
						</div>

						<div className="space-y-3 rounded-lg border px-4 py-4 sm:px-6">
							<div>
								<p className="text-sm font-medium">
									Electronic Notary Public — Electronic Signature
								</p>
								<p className="text-muted-foreground mt-1 text-sm">
									Sign below to attest this certified true copy access log entry.
								</p>
							</div>
							<EnbSignaturePad ref={padRef} disabled={isSubmitting} padHeight={160} />
						</div>

						{request.requesterAddress ? (
							<p className="text-muted-foreground text-sm">
								<span className="font-medium">Requester address:</span> {request.requesterAddress}
							</p>
						) : null}
					</div>
				) : (
					<div className="space-y-2">
						<Label htmlFor="ctc-refusal-reason">Refusal reason</Label>
						<Textarea
							id="ctc-refusal-reason"
							value={refusalReason}
							onChange={e => setRefusalReason(e.target.value)}
							rows={4}
							disabled={isSubmitting}
						/>
					</div>
				)}

				{error ? (
					<p className="text-destructive text-xs" role="alert">
						{error}
					</p>
				) : null}

				<DialogFooter className="gap-2 sm:justify-end">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={isSubmitting}
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					{mode === "grant" ? (
						<Button
							type="button"
							size="sm"
							disabled={isSubmitting}
							onClick={() => submitGrant()}
						>
							{isSubmitting ? "Granting…" : "Grant certified true copy"}
						</Button>
					) : (
						<Button
							type="button"
							size="sm"
							variant="destructive"
							disabled={isSubmitting}
							onClick={() => submitRefuse()}
						>
							{isSubmitting ? "Refusing…" : "Refuse request"}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
