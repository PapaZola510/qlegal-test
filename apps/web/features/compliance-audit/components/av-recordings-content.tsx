"use client"

import * as React from "react"
import { toast } from "sonner"

import type { AvRecording } from "@repo/contracts"

import { Button, buttonVariants } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { Input } from "@/core/components/ui/input"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/core/components/ui/table"
import { cn } from "@/core/lib/utils"
import { useAvRecordingsQuery } from "@/features/compliance-audit/api/compliance-audit.hooks"
import {
	avRecordingDownloadFilename,
	avRecordingStreamHref,
} from "@/features/compliance-audit/lib/av-recording-stream"

function shortHash(hash: string): string {
	return hash.length > 18 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash
}

function formatBytes(bytes: number): string {
	if (!bytes || bytes <= 0) return "0 B"
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function AvRecordingsContent() {
	const [enpUserId, setEnpUserId] = React.useState("")
	const [offset, setOffset] = React.useState(0)
	const [preview, setPreview] = React.useState<AvRecording | null>(null)
	const limit = 50
	const filter = React.useMemo(
		() => ({ enpUserId: enpUserId.trim() || undefined, limit, offset }),
		[enpUserId, offset]
	)
	const recordings = useAvRecordingsQuery(filter)
	const rows = recordings.data ?? []

	return (
		<Card>
			<CardHeader>
				<CardTitle>AV Recordings</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-muted-foreground text-sm">
					Viewing or downloading a recording is logged.
				</p>
				<Input
					placeholder="ENP user ID"
					aria-label="Filter by ENP user ID"
					value={enpUserId}
					onChange={e => setEnpUserId(e.target.value)}
					className="max-w-xs"
				/>
				<div className="overflow-x-auto rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>ID</TableHead>
								<TableHead>ENP</TableHead>
								<TableHead>Session / Appointment</TableHead>
								<TableHead>Size</TableHead>
								<TableHead>MIME</TableHead>
								<TableHead>SHA-256</TableHead>
								<TableHead>Created</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{recordings.isPending && (
								<TableRow>
									<TableCell colSpan={8} className="text-muted-foreground text-center">
										Loading recordings…
									</TableCell>
								</TableRow>
							)}
							{!recordings.isPending &&
								rows.map(row => (
									<TableRow key={row.id}>
										<TableCell className="font-mono text-xs">{row.id.slice(0, 8)}</TableCell>
										<TableCell className="text-sm">{row.enpName ?? row.enpUserId ?? "-"}</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{row.sessionId ?? "-"} / {row.appointmentId ?? "-"}
										</TableCell>
										<TableCell className="text-sm">{row.sizeBytes.toLocaleString()}</TableCell>
										<TableCell className="text-sm">{row.mime}</TableCell>
										<TableCell className="font-mono text-xs">{shortHash(row.sha256)}</TableCell>
										<TableCell className="text-sm">
											{new Date(row.createdAt).toISOString().slice(0, 10)}
										</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-2">
												<Button
													variant="default"
													size="sm"
													type="button"
													onClick={() => setPreview(row)}
												>
													View
												</Button>
												<a
													href={avRecordingStreamHref(row.id, true)}
													download={avRecordingDownloadFilename(row.id, row.mime)}
													className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
													onClick={() =>
														toast.message("Download started", {
															description: "This access is recorded in the audit log.",
														})
													}
												>
													Download
												</a>
											</div>
										</TableCell>
									</TableRow>
								))}
							{!recordings.isPending && !recordings.isError && rows.length === 0 && (
								<TableRow>
									<TableCell colSpan={8} className="text-muted-foreground text-center">
										No recordings match the current filters.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
				<div className="flex justify-end gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={offset === 0 || recordings.isPending}
						onClick={() => setOffset(Math.max(0, offset - limit))}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={rows.length < limit || recordings.isPending}
						onClick={() => setOffset(offset + limit)}
					>
						Next
					</Button>
				</div>
			</CardContent>

			<Dialog open={preview !== null} onOpenChange={open => !open && setPreview(null)}>
				<DialogContent className="flex w-[min(96vw,56rem)] max-w-[min(96vw,56rem)] flex-col gap-4 p-5 sm:max-w-[56rem] sm:p-6">
					<DialogHeader>
						<DialogTitle className="text-lg">
							{preview?.enpName ?? preview?.enpUserId ?? "AV recording"}
						</DialogTitle>
						{preview ? (
							<DialogDescription className="text-sm">
								{new Date(preview.createdAt).toLocaleString()}
								{preview.sizeBytes ? ` · ${formatBytes(preview.sizeBytes)}` : ""}
								{preview.mime ? ` · ${preview.mime}` : ""}
							</DialogDescription>
						) : null}
					</DialogHeader>
					{preview ? (
						<video
							key={preview.id}
							className="bg-muted max-h-[min(80vh,720px)] w-full rounded-lg"
							src={avRecordingStreamHref(preview.id)}
							controls
							autoPlay
							playsInline
							preload="metadata"
							onError={() =>
								toast.error(
									"Could not play this recording. Try Download, or confirm you are signed in with compliance access."
								)
							}
						/>
					) : null}
					{preview ? (
						<div className="flex flex-wrap gap-2">
							<a
								href={avRecordingStreamHref(preview.id, true)}
								download={avRecordingDownloadFilename(preview.id, preview.mime)}
								className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
							>
								Download
							</a>
						</div>
					) : null}
				</DialogContent>
			</Dialog>
		</Card>
	)
}
