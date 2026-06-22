"use client"

import * as React from "react"

import type { MeetingRecording } from "@repo/contracts"

import { Button, buttonVariants } from "@/core/components/ui/button"
import { Card, CardContent } from "@/core/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"

function formatBytes(bytes: number): string {
	if (!bytes || bytes <= 0) return "0 B"
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatRecordedAt(iso: string): string {
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return iso
	return d.toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	})
}

function RecordingCard({
	recording,
	variant,
	getRecordingHref,
	onDeleteRecording,
	isDeleting,
	onView,
}: {
	recording: MeetingRecording
	variant: "session" | "library"
	getRecordingHref: (fileObjectId: string) => string
	onDeleteRecording?: (fileObjectId: string) => void
	isDeleting?: boolean
	onView: () => void
}) {
	const href = getRecordingHref(recording.fileObjectId)
	const title =
		variant === "library" && recording.appointmentTitle
			? recording.appointmentTitle
			: recording.fileName

	return (
		<Card className="shadow-sm">
			<CardContent className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0 flex-1 space-y-0.5">
					<p className="truncate text-sm font-medium">{title}</p>
					<p className="text-muted-foreground text-xs">
						{formatRecordedAt(recording.linkedAt)}
						{recording.sizeBytes ? ` · ${formatBytes(recording.sizeBytes)}` : null}
					</p>
					{variant === "library" ? (
						<p className="text-muted-foreground truncate text-[11px]" title={recording.fileName}>
							{recording.fileName}
						</p>
					) : null}
				</div>
				<div className="flex shrink-0 flex-wrap gap-2">
					<Button type="button" size="sm" variant="default" onClick={onView}>
						View
					</Button>
					<a
						href={href}
						download={recording.fileName}
						className={buttonVariants({ variant: "outline", size: "sm" })}
					>
						Download
					</a>
					{onDeleteRecording ? (
						<Button
							type="button"
							size="sm"
							variant="destructive"
							disabled={isDeleting}
							onClick={() => onDeleteRecording(recording.fileObjectId)}
						>
							{isDeleting ? "Deleting…" : "Delete"}
						</Button>
					) : null}
				</div>
			</CardContent>
		</Card>
	)
}

export function SessionRecordingsPanel({
	recordings,
	getRecordingHref,
	onDeleteRecording,
	isDeletingRecording,
	variant = "session",
	showHeader = true,
}: {
	recordings: MeetingRecording[]
	getRecordingHref: (fileObjectId: string) => string
	onDeleteRecording?: (fileObjectId: string) => void
	isDeletingRecording?: (fileObjectId: string) => boolean
	variant?: "session" | "library"
	showHeader?: boolean
}) {
	const [preview, setPreview] = React.useState<MeetingRecording | null>(null)

	const emptyMessage =
		variant === "library"
			? "No recordings yet. When you record a live session, it will appear here for playback and download."
			: "No recordings yet. Click Record meeting above, then stop to add one here."

	return (
		<>
			<div className="space-y-3 pb-1">
				{showHeader ? (
					<div className="space-y-1">
						<h3 className="text-sm font-semibold tracking-tight">Recordings</h3>
						<p className="text-muted-foreground text-xs leading-relaxed">
							{variant === "library"
								? "Stored meeting recordings from your live sessions."
								: "Meeting recordings saved to storage. A copy is also downloaded to your device when recording stops."}
						</p>
					</div>
				) : null}

				{recordings.length === 0 ? (
					<Card className="shadow-sm">
						<CardContent className="text-muted-foreground px-4 py-10 text-center text-sm leading-relaxed">
							{emptyMessage}
						</CardContent>
					</Card>
				) : (
					<div className="space-y-2">
						{recordings.map(recording => (
							<RecordingCard
								key={recording.id}
								recording={recording}
								variant={variant}
								getRecordingHref={getRecordingHref}
								onDeleteRecording={onDeleteRecording}
								isDeleting={Boolean(isDeletingRecording?.(recording.fileObjectId))}
								onView={() => setPreview(recording)}
							/>
						))}
					</div>
				)}
			</div>

			<Dialog open={preview !== null} onOpenChange={open => !open && setPreview(null)}>
				<DialogContent className="flex w-[min(96vw,56rem)] max-w-[min(96vw,56rem)] flex-col gap-4 p-5 sm:max-w-[56rem] sm:p-6">
					<DialogHeader>
						<DialogTitle className="text-lg">
							{preview?.appointmentTitle ?? preview?.fileName ?? "Recording"}
						</DialogTitle>
						{preview ? (
							<DialogDescription className="text-sm">
								{formatRecordedAt(preview.linkedAt)}
								{preview.sizeBytes ? ` · ${formatBytes(preview.sizeBytes)}` : ""}
							</DialogDescription>
						) : null}
					</DialogHeader>
					{preview ? (
						<video
							key={preview.fileObjectId}
							className="bg-muted max-h-[min(80vh,720px)] w-full rounded-lg"
							src={getRecordingHref(preview.fileObjectId)}
							controls
							autoPlay
							playsInline
							preload="metadata"
						/>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	)
}
