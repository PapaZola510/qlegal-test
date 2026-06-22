"use client"

import * as React from "react"
import { toast } from "sonner"

import type { CommissionHearingOpposition } from "@repo/contracts"

import { Alert, AlertDescription, AlertTitle } from "@/core/components/ui/alert"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/core/components/ui/field"
import { Input } from "@/core/components/ui/input"
import { Textarea } from "@/core/components/ui/textarea"
import { useFileCommissionOppositionMutation } from "@/features/commission-hearing/api/commission-hearing.hooks"
import { env } from "@/env"

const MAX_BYTES = 50 * 1024 * 1024
const DOCUMENT_ACCEPT = "application/pdf,image/*,.docx"

function validateOppositionFile(file: File): string | null {
	const mime = file.type.toLowerCase()
	const allowed =
		mime === "application/pdf" ||
		mime.startsWith("image/") ||
		mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
		file.name.toLowerCase().endsWith(".docx")
	if (!allowed) {
		return "Upload a PDF, image, or Word document."
	}
	if (file.size > MAX_BYTES) {
		return "File must be 50MB or smaller."
	}
	if (file.size <= 0) {
		return "File is empty."
	}
	return null
}

async function readUploadErrorMessage(res: Response): Promise<string> {
	try {
		const body = (await res.json()) as {
			message?: string | string[]
			error?: { message?: string | string[] }
		}
		const nested = body.error?.message
		if (typeof nested === "string" && nested.trim()) return nested.trim()
		if (Array.isArray(nested) && nested.length > 0) return nested.join(", ")
		if (typeof body.message === "string" && body.message.trim()) return body.message.trim()
		if (Array.isArray(body.message) && body.message.length > 0) return body.message.join(", ")
	} catch {
		/* ignore */
	}
	return `Upload failed (${res.status})`
}

async function uploadCommissionOppositionFile(args: {
	file: File
	hearingRoomId: string
}): Promise<{ applicationId: string; fileObjectId: string }> {
	const err = validateOppositionFile(args.file)
	if (err) throw new Error(err)

	const form = new FormData()
	form.append("file", args.file)
	form.append("hearing_room_id", args.hearingRoomId)

	const base = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
	const res = await fetch(`${base}/v1/files/commission-opposition`, {
		method: "POST",
		body: form,
		credentials: "include",
	})

	if (!res.ok) {
		throw new Error(await readUploadErrorMessage(res))
	}

	const data = (await res.json()) as { applicationId?: string; fileObjectId?: string }
	if (!data.applicationId || !data.fileObjectId) {
		throw new Error("Upload succeeded but no filing target was returned")
	}
	return { applicationId: data.applicationId, fileObjectId: data.fileObjectId }
}

function FilePickerRow({
	id,
	label,
	description,
	file,
	required,
	disabled,
	onChange,
}: {
	id: string
	label: string
	description: string
	file: File | null
	required?: boolean
	disabled?: boolean
	onChange: (file: File | null) => void
}) {
	const inputRef = React.useRef<HTMLInputElement>(null)

	return (
		<div className="border-border/60 grid gap-3 border-b py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
			<div className="min-w-0">
				<p className="text-sm font-medium">
					{label}
					{required ? <span className="text-destructive"> *</span> : null}
				</p>
				<p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{description}</p>
			</div>
			<div className="flex min-w-0 items-center gap-2 sm:max-w-xs sm:justify-end">
				<input
					ref={inputRef}
					id={id}
					type="file"
					accept={DOCUMENT_ACCEPT}
					disabled={disabled}
					className="sr-only"
					onChange={event => onChange(event.target.files?.[0] ?? null)}
				/>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={disabled}
					className="shrink-0"
					onClick={() => inputRef.current?.click()}
				>
					Choose file
				</Button>
				<span className="text-muted-foreground min-w-0 truncate text-xs">
					{file?.name ?? "No file chosen"}
				</span>
			</div>
		</div>
	)
}

export function CommissionOppositionFileForm({ hearingRoomId }: { hearingRoomId: string }) {
	const fileOpposition = useFileCommissionOppositionMutation()
	const [oppositorName, setOppositorName] = React.useState("")
	const [oppositorEmail, setOppositorEmail] = React.useState("")
	const [grounds, setGrounds] = React.useState("")
	const [verifiedDocument, setVerifiedDocument] = React.useState<File | null>(null)
	const [representativeDocument, setRepresentativeDocument] = React.useState<File | null>(null)
	const [filedOpposition, setFiledOpposition] = React.useState<CommissionHearingOpposition | null>(
		null
	)
	const [uploading, setUploading] = React.useState(false)

	const submitting = uploading || fileOpposition.isPending
	const canSubmit =
		!submitting &&
		oppositorName.trim().length > 0 &&
		oppositorEmail.trim().length > 0 &&
		grounds.trim().length > 0 &&
		Boolean(verifiedDocument)

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (!verifiedDocument) {
			toast.error("Upload the verified written opposition before filing.")
			return
		}

		const requiredFileError = validateOppositionFile(verifiedDocument)
		if (requiredFileError) {
			toast.error(requiredFileError)
			return
		}
		if (representativeDocument) {
			const representativeFileError = validateOppositionFile(representativeDocument)
			if (representativeFileError) {
				toast.error(representativeFileError)
				return
			}
		}

		try {
			setUploading(true)
			const verifiedUpload = await uploadCommissionOppositionFile({
				file: verifiedDocument,
				hearingRoomId,
			})
			const representativeUpload = representativeDocument
				? await uploadCommissionOppositionFile({
						file: representativeDocument,
						hearingRoomId,
					})
				: null

			const filed = await fileOpposition.mutateAsync({
				applicationId: verifiedUpload.applicationId,
				oppositorName: oppositorName.trim(),
				oppositorEmail: oppositorEmail.trim(),
				grounds: grounds.trim(),
				verifiedDocumentFileObjectId: verifiedUpload.fileObjectId,
				representativeDocumentFileObjectId: representativeUpload?.fileObjectId,
			})

			setFiledOpposition(filed)
			setVerifiedDocument(null)
			setRepresentativeDocument(null)
			toast.success("Opposition filed for ENA review.")
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not file opposition")
		} finally {
			setUploading(false)
		}
	}

	if (filedOpposition) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Opposition filed</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<Alert>
						<AlertTitle>Submitted for ENA review</AlertTitle>
						<AlertDescription>
							Your verified written opposition was filed on{" "}
							{new Date(filedOpposition.createdAt).toLocaleString()}. You will be notified if the
							ENA grants access to appear at the hearing.
						</AlertDescription>
					</Alert>
					<Button type="button" variant="outline" onClick={() => setFiledOpposition(null)}>
						File another opposition
					</Button>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Verified written opposition</CardTitle>
			</CardHeader>
			<CardContent>
				<form className="space-y-6" onSubmit={event => void onSubmit(event)}>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field>
							<FieldLabel htmlFor="oppositor-name">Oppositor name</FieldLabel>
							<Input
								id="oppositor-name"
								value={oppositorName}
								disabled={submitting}
								onChange={event => setOppositorName(event.target.value)}
								required
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="oppositor-email">Oppositor email</FieldLabel>
							<Input
								id="oppositor-email"
								type="email"
								value={oppositorEmail}
								disabled={submitting}
								onChange={event => setOppositorEmail(event.target.value)}
								required
							/>
						</Field>
					</div>

					<Field>
						<FieldLabel htmlFor="opposition-grounds">Grounds for opposition</FieldLabel>
						<FieldDescription>
							State the facts and legal grounds supporting the written opposition.
						</FieldDescription>
						<Textarea
							id="opposition-grounds"
							value={grounds}
							disabled={submitting}
							className="min-h-36"
							maxLength={20_000}
							onChange={event => setGrounds(event.target.value)}
							required
						/>
					</Field>

					<div className="rounded-lg border px-4">
						<FilePickerRow
							id="verified-opposition-document"
							label="Verified written opposition"
							description="Required. Upload the verified opposition document as a PDF, image, or Word document."
							file={verifiedDocument}
							required
							disabled={submitting}
							onChange={setVerifiedDocument}
						/>
						<FilePickerRow
							id="representative-authority-document"
							label="SPA or representative authority"
							description="Optional. Upload a special power of attorney, board resolution, or similar authority document."
							file={representativeDocument}
							disabled={submitting}
							onChange={setRepresentativeDocument}
						/>
					</div>

					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
						<p className="text-muted-foreground text-xs sm:me-auto">
							Maximum file size: 50MB per document.
						</p>
						<Button type="submit" disabled={!canSubmit}>
							{submitting ? "Filing..." : "File opposition"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	)
}
