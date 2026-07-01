"use client"

import * as React from "react"

import type { Appointment, AppointmentBookedDocumentType } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
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
import { Spinner } from "@/core/components/ui/spinner"
import { cn } from "@/core/lib/utils"
import { NOTARIZATION_TYPE_LABELS } from "@/features/appointments/lib/labels"
import { validateMeetingDocumentFile } from "@/features/appointments/lib/upload-appointment-file"

function parseFeePhpInput(raw: string): number | null {
	const trimmed = raw.trim().replace(/,/g, "")
	if (!trimmed) return null
	const n = Number.parseFloat(trimmed)
	if (!Number.isFinite(n) || n <= 0) return null
	return Math.round(n)
}

interface UploadDocumentModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	isSubmitting: boolean
	/** When true, ENP must enter an editable notarization fee (PHP). */
	isEnp?: boolean
	/** Suggested default fee when the ENP opens the modal (e.g. directory base fee). */
	defaultFeePhp?: number
	/** Booked ENP service type section this upload belongs to. */
	bookedDocumentType?: AppointmentBookedDocumentType
	/** Set on the appointment before the session (booking). */
	notarizationType: Appointment["notarizationType"]
	onSubmit: (payload: {
		file: File
		documentName: string
		documentType: string
		enpDocumentTypeId?: string
		feePhp?: number
	}) => void | Promise<void>
}

export function UploadDocumentModal({
	open,
	onOpenChange,
	isSubmitting,
	isEnp = false,
	defaultFeePhp,
	bookedDocumentType,
	notarizationType,
	onSubmit,
}: UploadDocumentModalProps) {
	const [file, setFile] = React.useState<File | null>(null)
	const [documentName, setDocumentName] = React.useState("")
	const [fees, setFees] = React.useState("")
	const [feesError, setFeesError] = React.useState<string | null>(null)
	const [fileError, setFileError] = React.useState<string | null>(null)
	const [formError, setFormError] = React.useState<string | null>(null)
	const inputRef = React.useRef<HTMLInputElement>(null)

	function resetForm() {
		setFile(null)
		setDocumentName("")
		setFees("")
		setFeesError(null)
		setFileError(null)
		setFormError(null)
	}

	React.useEffect(() => {
		if (!open) resetForm()
	}, [open])

	const suggestedFeePhp = bookedDocumentType?.pricePhpSnapshot ?? defaultFeePhp ?? undefined

	React.useEffect(() => {
		if (!open || !isEnp) return
		if (suggestedFeePhp !== null && suggestedFeePhp !== undefined && suggestedFeePhp > 0) {
			setFees(String(suggestedFeePhp))
		}
	}, [open, isEnp, suggestedFeePhp])

	function applyFile(next: File | null) {
		setFileError(null)
		if (!next) {
			setFile(null)
			return
		}
		const err = validateMeetingDocumentFile(next)
		if (err) {
			setFileError(err)
			setFile(null)
			return
		}
		setFile(next)
		if (!documentName.trim()) {
			const base = next.name.replace(/\.(pdf|docx)$/i, "")
			setDocumentName(base)
		}
	}

	function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
		applyFile(e.target.files?.[0] ?? null)
	}

	function handleDrop(e: React.DragEvent) {
		e.preventDefault()
		applyFile(e.dataTransfer.files?.[0] ?? null)
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setFormError(null)
		setFeesError(null)
		if (!file) {
			setFileError("Select a document file to upload.")
			return
		}
		const name = documentName.trim()
		if (!name) {
			setFormError("Enter a document name.")
			return
		}
		let feePhp: number | undefined
		if (isEnp) {
			const parsed = parseFeePhpInput(fees)
			if (parsed === null) {
				setFeesError(
					"Enter the notarization fee in PHP (greater than zero). This is required for the notarial book."
				)
				return
			}
			feePhp = parsed
		}

		await onSubmit({
			file,
			documentName: name,
			documentType: notarizationType,
			enpDocumentTypeId: bookedDocumentType?.id,
			feePhp,
		})
	}

	const feePhpValid = !isEnp || parseFeePhpInput(fees) !== null
	const canSubmit =
		Boolean(file) && documentName.trim().length > 0 && feePhpValid && !fileError && !isSubmitting

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{bookedDocumentType ? `Upload — ${bookedDocumentType.name}` : "Upload document"}
					</DialogTitle>
					<DialogDescription>
						{bookedDocumentType
							? `Add a PDF for ${bookedDocumentType.name} (booked at ₱${bookedDocumentType.pricePhpSnapshot.toLocaleString()}).`
							: "Add an instrument for this session. Participants will see it in the Docs panel."}{" "}
						Notarization for this session: {NOTARIZATION_TYPE_LABELS[notarizationType]}.
					</DialogDescription>
				</DialogHeader>

				<form className="space-y-4" onSubmit={e => void handleSubmit(e)}>
					<div className="space-y-1.5">
						<Label>Document file</Label>
						<div
							role="button"
							tabIndex={0}
							onKeyDown={e => {
								if (e.key === "Enter" || e.key === " ") inputRef.current?.click()
							}}
							onClick={() => inputRef.current?.click()}
							onDragOver={e => e.preventDefault()}
							onDrop={handleDrop}
							className={cn(
								"border-border hover:bg-muted/40 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
								file && "border-primary/40 bg-muted/30"
							)}
						>
							<p className="text-sm font-medium">
								{file ? file.name : "Click or drag a file here"}
							</p>
							<p className="text-muted-foreground mt-1 text-xs">PDF only — max 20MB</p>
							{file ? (
								<p className="text-muted-foreground mt-2 text-xs">
									{(file.size / (1024 * 1024)).toFixed(2)} MB
								</p>
							) : null}
						</div>
						<input
							ref={inputRef}
							type="file"
							accept=".pdf,application/pdf"
							className="sr-only"
							onChange={handleFileInputChange}
						/>
						{fileError ? (
							<p className="text-destructive text-xs" role="alert">
								{fileError}
							</p>
						) : null}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="meeting-doc-name">Document name</Label>
						<Input
							id="meeting-doc-name"
							placeholder="e.g. Deed of Sale"
							value={documentName}
							onChange={e => setDocumentName(e.target.value)}
							autoComplete="off"
						/>
					</div>

					{!isEnp && bookedDocumentType ? (
						<div className="space-y-1.5">
							<Label>Notarization fee (PHP)</Label>
							<p className="text-sm font-medium">
								₱{bookedDocumentType.pricePhpSnapshot.toLocaleString()}
							</p>
							<p className="text-muted-foreground text-xs">
								Based on the notary&apos;s price for this document type at booking.
							</p>
						</div>
					) : null}

					{isEnp ? (
						<div className="space-y-1.5">
							<Label htmlFor="meeting-doc-fees">
								Notarization fee (PHP) <span className="text-destructive">*</span>
							</Label>
							<Input
								id="meeting-doc-fees"
								type="number"
								step="1"
								min={1}
								inputMode="numeric"
								placeholder="e.g. 500"
								value={fees}
								onChange={e => {
									setFees(e.target.value)
									setFeesError(null)
								}}
								aria-invalid={feesError ? true : undefined}
								aria-describedby={feesError ? "meeting-doc-fees-error" : undefined}
							/>
							{feesError ? (
								<p id="meeting-doc-fees-error" className="text-destructive text-xs" role="alert">
									{feesError}
								</p>
							) : (
								<p className="text-muted-foreground text-xs">
									{bookedDocumentType
										? "Pre-filled from the booked type price — you can change it for this document."
										: suggestedFeePhp !== null &&
											 suggestedFeePhp !== undefined &&
											 suggestedFeePhp > 0
											? "Pre-filled from your directory base fee — you can change it for this document."
											: "Enter the fee for this instrument. It is recorded for the notarial book."}
								</p>
							)}
						</div>
					) : null}

					{formError ? (
						<p className="text-destructive text-xs" role="alert">
							{formError}
						</p>
					) : null}

					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={!canSubmit}>
							{isSubmitting ? <Spinner className="mr-2" /> : null}
							Upload
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
