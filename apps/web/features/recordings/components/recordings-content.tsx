"use client"

import { toast } from "sonner"

import type { MeetingRecording } from "@repo/contracts"

import { PageHeader } from "@/core/components/page-header"
import { Card, CardContent } from "@/core/components/ui/card"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import {
	useAllMeetingRecordingsQuery,
	useDeleteMeetingRecordingGlobalMutation,
} from "@/features/appointments/api/meeting.hooks"
import { SessionRecordingsPanel } from "@/features/appointments/components/meeting/session-recordings-panel"
import { env } from "@/env"

export function RecordingsContent() {
	const recordingsQ = useAllMeetingRecordingsQuery()
	const recordings = (recordingsQ.data as MeetingRecording[] | undefined) ?? []
	const deleteMutation = useDeleteMeetingRecordingGlobalMutation()

	function handleDeleteRecording(recording: MeetingRecording) {
		void deleteMutation
			.mutateAsync({ appointmentId: recording.appointmentId, fileObjectId: recording.fileObjectId })
			.then(
				() => toast.success("Recording deleted."),
				e => toast.error(getOrpcMutationErrorMessage(e, "Could not delete recording."))
			)
	}

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6">
			<PageHeader
				title="Recordings"
				description="Stored meeting recordings. You can play, download, or delete recordings here."
			/>

			{recordingsQ.isLoading ? (
				<p className="text-muted-foreground text-sm">Loading recordings…</p>
			) : recordingsQ.isError ? (
				<Card className="shadow-sm">
					<CardContent className="text-destructive px-4 py-6 text-sm leading-relaxed">
						Could not load recordings.{" "}
						{recordingsQ.error instanceof Error ? recordingsQ.error.message : "Please try again."}
					</CardContent>
				</Card>
			) : (
				<SessionRecordingsPanel
					variant="library"
					showHeader={false}
					recordings={recordings}
					getRecordingHref={fileObjectId =>
						`${env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")}/v1/files/${encodeURIComponent(
							fileObjectId
						)}`
					}
					onDeleteRecording={fileObjectId => {
						const target = recordings.find(r => r.fileObjectId === fileObjectId)
						if (!target) return
						handleDeleteRecording(target)
					}}
					isDeletingRecording={fileObjectId =>
						deleteMutation.isPending && deleteMutation.variables?.fileObjectId === fileObjectId
					}
				/>
			)}
		</div>
	)
}
