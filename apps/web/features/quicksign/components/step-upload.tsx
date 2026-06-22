"use client"

import * as React from "react"

import type { QuicksignErrorCode } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Progress } from "@/core/components/ui/progress"
import { Spinner } from "@/core/components/ui/spinner"

import type { UploadPayload } from "../lib/fixtures"

const MAX_FILE_SIZE_MB = 20

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface StepUploadProps {
	upload: UploadPayload
	savedDocumentName: string | null
	hasCreatedProject: boolean
	isLoading: boolean
	error: string | null
	errorCode: QuicksignErrorCode | null
	canRetryWithoutReupload: boolean
	onUpdate: (u: Partial<UploadPayload>) => void
	onRetry: () => void
	onRecreate: () => void
}

export function StepUpload({
	upload,
	savedDocumentName,
	hasCreatedProject,
	isLoading,
	error,
	errorCode,
	canRetryWithoutReupload,
	onUpdate,
	onRetry,
	onRecreate,
}: StepUploadProps) {
	const inputRef = React.useRef<HTMLInputElement | null>(null)
	const [fileError, setFileError] = React.useState<string | null>(null)
	const [isDraggingOver, setIsDraggingOver] = React.useState(false)

	function applyFiles(fileList: FileList | null) {
		setFileError(null)
		if (!fileList || fileList.length === 0) return
		if (fileList.length > 1) {
			setFileError("QuickSign supports one PDF at a time.")
			if (inputRef.current) inputRef.current.value = ""
			return
		}
		if (upload.file || hasCreatedProject) {
			setFileError("Remove the current document before choosing another.")
			if (inputRef.current) inputRef.current.value = ""
			return
		}
		const file = fileList[0]
		if (!file) return
		if (file.type !== "application/pdf") {
			setFileError("Only PDF files are allowed.")
			if (inputRef.current) inputRef.current.value = ""
			return
		}
		if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
			setFileError(`File must be ${MAX_FILE_SIZE_MB}MB or smaller.`)
			if (inputRef.current) inputRef.current.value = ""
			return
		}
		onUpdate({
			file,
			fileName: file.name.replace(/\.pdf$/i, ""),
		})
		if (inputRef.current) inputRef.current.value = ""
	}

	function removeFile() {
		if (hasCreatedProject) return
		onUpdate({
			file: null,
			fileName: "",
		})
		setFileError(null)
		if (inputRef.current) inputRef.current.value = ""
	}

	const attachedFileName = upload.file?.name ?? savedDocumentName
	const attachedFileSize = upload.file ? formatBytes(upload.file.size) : "Saved to QuickSign"

	return (
		<Card className="mx-auto w-full max-w-lg">
			<CardHeader>
				<CardTitle>Upload Document</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div
					onDragOver={e => {
						e.preventDefault()
						setIsDraggingOver(true)
					}}
					onDragLeave={() => setIsDraggingOver(false)}
					onDrop={e => {
						e.preventDefault()
						setIsDraggingOver(false)
						applyFiles(e.dataTransfer.files)
					}}
					className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
						isDraggingOver ? "border-primary bg-primary/5" : "border-border"
					}`}
				>
					<p className="text-muted-foreground mb-1 text-sm">Drag and drop your document here, or</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => inputRef.current?.click()}
						disabled={isLoading || Boolean(upload.file) || hasCreatedProject}
					>
						Select file
					</Button>
					<p className="text-muted-foreground mt-2 text-xs">
						PDF only, up to {MAX_FILE_SIZE_MB} MB.
					</p>
					<input
						ref={inputRef}
						type="file"
						accept="application/pdf"
						className="hidden"
						onChange={e => applyFiles(e.target.files)}
					/>
				</div>

				{fileError ? (
					<p className="text-destructive text-sm" role="alert">
						{fileError}
					</p>
				) : null}

				{isLoading && upload.file ? (
					<Card className="space-y-2 p-3">
						<p className="truncate text-xs font-medium">Creating QuickSign project…</p>
						<Progress value={65} />
					</Card>
				) : null}

				{attachedFileName ? (
					<div className="space-y-2">
						<p className="text-muted-foreground text-xs">Attached document</p>
						<Card className="flex items-center justify-between gap-3 p-3 text-sm">
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium">{attachedFileName}</p>
								<p className="text-muted-foreground text-xs">{attachedFileSize}</p>
							</div>
							{hasCreatedProject ? (
								<p className="text-muted-foreground text-xs">Project created</p>
							) : (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={removeFile}
									disabled={isLoading}
								>
									Remove
								</Button>
							)}
						</Card>
					</div>
				) : null}

				{error && (
					<div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
						<p>{error}</p>
						<div className="mt-2 flex gap-2">
							{(errorCode === "DC_PROJECT_CREATE_FAILED" || canRetryWithoutReupload) && (
								<Button size="sm" variant="outline" onClick={onRetry} disabled={isLoading}>
									Retry (keep file)
								</Button>
							)}
							{errorCode === "DC_PROJECT_EXPIRED" && (
								<Button size="sm" variant="outline" onClick={onRecreate} disabled={isLoading}>
									Recreate Project
								</Button>
							)}
						</div>
					</div>
				)}

				{isLoading ? (
					<p className="text-muted-foreground flex items-center text-xs">
						<Spinner className="mr-2" />
						Creating project…
					</p>
				) : null}
			</CardContent>
		</Card>
	)
}
