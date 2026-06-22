"use client"

import {
	ControlBar,
	GridLayout,
	LayoutContextProvider,
	ParticipantTile,
	useTracks,
} from "@livekit/components-react"
import { RoomEvent, Track } from "livekit-client"

export function MeetingVideoStage() {
	const tracks = useTracks(
		[
			{ source: Track.Source.Camera, withPlaceholder: true },
			{ source: Track.Source.ScreenShare, withPlaceholder: false },
		],
		{
			updateOnlyOn: [RoomEvent.ActiveSpeakersChanged],
			onlySubscribed: false,
		}
	)

	return (
		<LayoutContextProvider>
			<div className="lk-video-conference flex h-full min-h-0 max-w-full min-w-0 flex-1 flex-col overflow-hidden">
				<div className="lk-video-conference-inner flex h-full min-h-0 max-w-full min-w-0 flex-1 flex-col overflow-hidden">
					<div className="relative flex min-h-0 max-w-full min-w-0 flex-1 flex-col overflow-hidden">
						<div className="lk-grid-layout-wrapper flex min-h-0 flex-1 flex-col overflow-hidden">
							<GridLayout
								tracks={tracks}
								className="!h-full min-h-0 flex-1 [&_.lk-participant-tile]:h-full [&_.lk-participant-tile]:min-h-0"
							>
								<ParticipantTile />
							</GridLayout>
						</div>
					</div>
					<ControlBar
						variation="minimal"
						controls={{
							microphone: true,
							camera: true,
							screenShare: true,
							chat: false,
							settings: false,
							leave: false,
						}}
					/>
				</div>
			</div>
		</LayoutContextProvider>
	)
}
