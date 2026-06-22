"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/core/components/ui/button"
import { Card } from "@/core/components/ui/card"
import { Progress } from "@/core/components/ui/progress"
import { uploadDocumentReviewFile } from "@/features/appointments/lib/upload-appointment-file"

import { formatBytes, MAX_DOCUMENT_FILES } from "../lib/constants"

export interface UploadedDocument {
	fileObjectId: string
	displayName: string
	sizeBytes: number
	mimeType: string
}

interface DocumentsUploadStepProps {
	notaryId: string | null
	uploaded: UploadedDocument[]
	onChange: (next: UploadedDocument[]) => void
}

export function DocumentsUploadStep({ notaryId, uploaded, onChange }: DocumentsUploadStepProps) {
	const inputRef = React.useRef<HTMLInputElement | null>(null)
	const [busy, setBusy] = React.useState<{ name: string; progress: number } | null>(null)
	const [isDraggingOver, setIsDraggingOver] = React.useState(false)

	async function handleFiles(fileList: FileList | null) {
		if (!fileList || fileList.length === 0) return
		if (!notaryId) {
			toast.error("Pick a notary in the previous step before uploading documents.")
			return
		}
		const remaining = MAX_DOCUMENT_FILES - uploaded.length
		if (remaining <= 0) {
			toast.error(`You can upload at most ${MAX_DOCUMENT_FILES} files per request.`)
			return
		}
		const files = Array.from(fileList).slice(0, remaining)

		for (const file of files) {
			setBusy({ name: file.name, progress: 10 })
			try {
				// Coarse progress bump while the request is in flight; the underlying fetch is a single roundtrip.
				const bump = setInterval(() => {
					setBusy(prev => (prev ? { ...prev, progress: Math.min(prev.progress + 7, 85) } : null))
				}, 200)
				const { fileObjectId } = await uploadDocumentReviewFile({ file, notaryId })
				clearInterval(bump)
				setBusy({ name: file.name, progress: 100 })
				const next: UploadedDocument = {
					fileObjectId,
					displayName: file.name,
					sizeBytes: file.size,
					mimeType: file.type || "application/octet-stream",
				}
				onChange([...uploaded, next])
				toast.success(`Uploaded ${file.name}`)
			} catch (e) {
				const msg = e instanceof Error ? e.message : "Upload failed"
				toast.error(msg)
				break
			} finally {
				setBusy(null)
			}
		}
		if (inputRef.current) inputRef.current.value = ""
	}

	function removeFile(fileObjectId: string) {
		onChange(uploaded.filter(f => f.fileObjectId !== fileObjectId))
	}

	return (
		<div className="space-y-4">
			<div
				onDragOver={e => {
					e.preventDefault()
					setIsDraggingOver(true)
				}}
				onDragLeave={() => setIsDraggingOver(false)}
				onDrop={async e => {
					e.preventDefault()
					setIsDraggingOver(false)
					await handleFiles(e.dataTransfer.files)
				}}
				className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
					isDraggingOver ? "border-primary bg-primary/5" : "border-border"
				}`}
			>
				<p className="text-muted-foreground mb-1 text-sm">
					Drag and drop your document(s) here, or
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => inputRef.current?.click()}
					disabled={Boolean(busy) || uploaded.length >= MAX_DOCUMENT_FILES}
				>
					Select files
				</Button>
				<p className="text-muted-foreground mt-2 text-xs">
					PDF only, up to 20 MB each — max {MAX_DOCUMENT_FILES} files.
				</p>
				<input
					ref={inputRef}
					type="file"
					accept="application/pdf"
					multiple
					className="hidden"
					onChange={e => void handleFiles(e.target.files)}
				/>
			</div>

			{busy && (
				<Card className="space-y-2 p-3">
					<p className="truncate text-xs font-medium">{busy.name}</p>
					<Progress value={busy.progress} />
				</Card>
			)}

			{uploaded.length > 0 && (
				<div className="space-y-2">
					<p className="text-muted-foreground text-xs">Attached documents</p>
					{uploaded.map(f => (
						<Card
							key={f.fileObjectId}
							className="flex items-center justify-between gap-3 p-3 text-sm"
						>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium">{f.displayName}</p>
								<p className="text-muted-foreground text-xs">{formatBytes(f.sizeBytes)}</p>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => removeFile(f.fileObjectId)}
							>
								Remove
							</Button>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}
