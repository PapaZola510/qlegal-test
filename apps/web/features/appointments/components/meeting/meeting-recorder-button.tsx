"use client"

import * as React from "react"
import { CameraVideoFreeIcons, StopCircleFreeIcons } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import { Button } from "@/core/components/ui/button"
import { emitQlegalClientEventAsync, joinSessionRoom } from "@/services/ws/ws-client"

import { RecordingConsentDialog } from "./dialogs/recording-consent-dialog"

interface MeetingRecorderButtonProps {
	appointmentId: string
	sessionRoomId: string
	/** Optional extra slug appended to the downloaded filename. */
	filenameSuffix?: string
	onRecordingSaved?: (recording: { filename: string; blob: Blob; durationSeconds: number }) => void
}

function pad2(n: number) {
	return n.toString().padStart(2, "0")
}

function formatElapsed(totalSeconds: number) {
	const h = Math.floor(totalSeconds / 3600)
	const m = Math.floor((totalSeconds % 3600) / 60)
	const s = Math.floor(totalSeconds % 60)
	return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`
}

function pickMimeType(): string {
	if (typeof MediaRecorder === "undefined") return "video/webm"
	const candidates = [
		"video/webm;codecs=vp9,opus",
		"video/webm;codecs=vp8,opus",
		"video/webm;codecs=h264,opus",
		"video/webm",
	]
	for (const t of candidates) {
		if (typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(t)) {
			return t
		}
	}
	return "video/webm"
}

function safeAppointmentSlug(appointmentId: string) {
	const tail = appointmentId
		.replace(/[^a-zA-Z0-9]+/g, "")
		.slice(0, 8)
		.toUpperCase()
	return tail || "MEETING"
}

export function MeetingRecorderButton({
	appointmentId,
	sessionRoomId,
	filenameSuffix,
	onRecordingSaved,
}: MeetingRecorderButtonProps) {
	const [isRecording, setIsRecording] = React.useState(false)
	const [isStarting, setIsStarting] = React.useState(false)
	const [consentOpen, setConsentOpen] = React.useState(false)
	const [elapsed, setElapsed] = React.useState(0)

	const recorderRef = React.useRef<MediaRecorder | null>(null)
	const chunksRef = React.useRef<Blob[]>([])
	const displayStreamRef = React.useRef<MediaStream | null>(null)
	const micStreamRef = React.useRef<MediaStream | null>(null)
	const audioCtxRef = React.useRef<AudioContext | null>(null)
	const tickerRef = React.useRef<number | null>(null)
	const mountedRef = React.useRef(true)
	const continuingConsentRef = React.useRef(false)

	const cleanupStreams = React.useCallback(() => {
		displayStreamRef.current?.getTracks().forEach(t => {
			try {
				t.stop()
			} catch {
				/* noop */
			}
		})
		micStreamRef.current?.getTracks().forEach(t => {
			try {
				t.stop()
			} catch {
				/* noop */
			}
		})
		displayStreamRef.current = null
		micStreamRef.current = null
		if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
			void audioCtxRef.current.close().catch(() => undefined)
		}
		audioCtxRef.current = null
		if (tickerRef.current !== null) {
			window.clearInterval(tickerRef.current)
			tickerRef.current = null
		}
	}, [])

	const recordingStartedAtRef = React.useRef<string | null>(null)

	const broadcastRecordingStatus = React.useCallback(
		async (status: "started" | "acknowledged" | "stopped") => {
			await joinSessionRoom(sessionRoomId)
			await emitQlegalClientEventAsync("session:recording-notice", {
				roomId: sessionRoomId,
				status,
				...(status === "acknowledged" && recordingStartedAtRef.current
					? { startedAt: recordingStartedAtRef.current }
					: {}),
			}).catch(() => {
				/* recording notices degrade gracefully if WS is unavailable */
			})
		},
		[sessionRoomId]
	)

	const broadcastRecordingStatusSafely = React.useCallback(
		(status: "started" | "acknowledged" | "stopped") => {
			void broadcastRecordingStatus(status).catch(() => {
				if (status !== "stopped") {
					toast.warning("Recording started, but participants could not be notified in real time.")
				}
			})
		},
		[broadcastRecordingStatus]
	)

	const stop = React.useCallback(() => {
		const rec = recorderRef.current
		if (!rec || rec.state === "inactive") return
		try {
			rec.stop()
		} catch {
			/* state transitioned underneath us */
		}
	}, [])

	const stopAndNotify = React.useCallback(() => {
		if (isRecording) {
			broadcastRecordingStatusSafely("stopped")
		}
		stop()
	}, [broadcastRecordingStatusSafely, isRecording, stop])

	const start = React.useCallback(async () => {
		if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
			toast.error("Screen recording is not supported in this browser.")
			return
		}
		if (typeof MediaRecorder === "undefined") {
			toast.error("This browser does not support MediaRecorder.")
			return
		}

		setIsStarting(true)
		let displayStream: MediaStream | null = null
		let micStream: MediaStream | null = null
		try {
			displayStream = await navigator.mediaDevices.getDisplayMedia({
				video: { frameRate: 24 },
				audio: true,
			})
			displayStreamRef.current = displayStream

			try {
				micStream = await navigator.mediaDevices.getUserMedia({
					audio: { echoCancellation: true, noiseSuppression: true },
					video: false,
				})
				micStreamRef.current = micStream
			} catch {
				// Mic is optional — proceed with screen-only audio.
			}

			const ctx = new AudioContext()
			audioCtxRef.current = ctx
			const dest = ctx.createMediaStreamDestination()
			let hasAudio = false
			if (displayStream.getAudioTracks().length > 0) {
				ctx.createMediaStreamSource(displayStream).connect(dest)
				hasAudio = true
			}
			if (micStream && micStream.getAudioTracks().length > 0) {
				ctx.createMediaStreamSource(micStream).connect(dest)
				hasAudio = true
			}

			const composed = new MediaStream([
				...displayStream.getVideoTracks(),
				...(hasAudio ? dest.stream.getAudioTracks() : []),
			])

			const mimeType = pickMimeType()
			const recorder = new MediaRecorder(composed, { mimeType })
			recorderRef.current = recorder
			chunksRef.current = []

			recorder.ondataavailable = e => {
				if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
			}

			const startedAt = Date.now()
			tickerRef.current = window.setInterval(() => {
				if (!mountedRef.current) return
				setElapsed(Math.floor((Date.now() - startedAt) / 1000))
			}, 500)

			recorder.onstop = () => {
				try {
					const blob = new Blob(chunksRef.current, { type: mimeType })
					if (blob.size > 0) {
						const url = URL.createObjectURL(blob)
						const a = document.createElement("a")
						const stamp = new Date().toISOString().replace(/[:.]/g, "-")
						const suffix = filenameSuffix
							? `-${filenameSuffix.replace(/[^a-zA-Z0-9_-]+/g, "")}`
							: ""
						const filename = `qlegal-meeting-${safeAppointmentSlug(appointmentId)}${suffix}-${stamp}.webm`
						a.href = url
						a.download = filename
						document.body.appendChild(a)
						a.click()
						a.remove()
						window.setTimeout(() => URL.revokeObjectURL(url), 1500)
						onRecordingSaved?.({
							filename,
							blob,
							durationSeconds: Math.max(1, Math.floor((Date.now() - startedAt) / 1000)),
						})
						toast.success("Meeting recording saved to your device.")
					} else {
						toast.warning("Recording stopped before any data was captured.")
					}
				} catch {
					toast.error("Failed to save recording file.")
				} finally {
					chunksRef.current = []
					recorderRef.current = null
					recordingStartedAtRef.current = null
					cleanupStreams()
					if (mountedRef.current) {
						setIsRecording(false)
						setElapsed(0)
					}
				}
			}

			// If the user stops sharing from the browser banner, end the recording too.
			const videoTrack = displayStream.getVideoTracks()[0]
			if (videoTrack) {
				videoTrack.addEventListener("ended", () => {
					if (recorder.state !== "inactive") {
						try {
							recorder.stop()
						} catch {
							/* noop */
						}
					}
				})
			}

			recorder.start(1000) // gather data in 1-second chunks
			recordingStartedAtRef.current = new Date().toISOString()
			setIsRecording(true)
			if (!hasAudio) {
				toast.warning(
					"Recording started without audio. To capture voices, share a tab with 'Share tab audio' enabled, or allow microphone access."
				)
			} else {
				toast.success("Recording started. It will save to your device when you stop.")
			}
			broadcastRecordingStatusSafely("acknowledged")
		} catch (e) {
			recordingStartedAtRef.current = null
			cleanupStreams()
			recorderRef.current = null
			chunksRef.current = []
			broadcastRecordingStatusSafely("stopped")
			const name = (e as DOMException | null)?.name
			if (name === "NotAllowedError" || name === "SecurityError") {
				toast.error("Screen capture permission was denied.")
			} else if (name === "NotFoundError" || name === "AbortError") {
				toast.info("Screen capture cancelled.")
			} else {
				const msg = e instanceof Error ? e.message : "Could not start screen recording."
				toast.error(msg)
			}
		} finally {
			setIsStarting(false)
		}
	}, [
		appointmentId,
		broadcastRecordingStatusSafely,
		cleanupStreams,
		filenameSuffix,
		onRecordingSaved,
	])

	React.useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
			const rec = recorderRef.current
			if (rec && rec.state !== "inactive") {
				broadcastRecordingStatusSafely("stopped")
				try {
					rec.stop()
				} catch {
					/* noop */
				}
			} else {
				cleanupStreams()
			}
		}
	}, [broadcastRecordingStatusSafely, cleanupStreams])

	if (isRecording) {
		return (
			<Button
				type="button"
				variant="destructive"
				size="sm"
				onClick={stopAndNotify}
				title="Stop recording and download the video file to your device"
			>
				<span
					className="mr-1.5 inline-flex size-2 animate-pulse rounded-full bg-white"
					aria-hidden
				/>
				<HugeiconsIcon icon={StopCircleFreeIcons} className="mr-1 size-3.5" strokeWidth={2} />
				Stop &amp; save ({formatElapsed(elapsed)})
			</Button>
		)
	}

	return (
		<>
			<Button
				type="button"
				variant="secondary"
				size="sm"
				onClick={() => {
					setConsentOpen(true)
					broadcastRecordingStatusSafely("started")
				}}
				disabled={isStarting}
				title="Record this session to a video file saved on your device (required for notarial record)"
			>
				<HugeiconsIcon icon={CameraVideoFreeIcons} className="mr-1.5 size-3.5" strokeWidth={2} />
				{isStarting ? "Starting…" : "Record meeting"}
			</Button>
			<RecordingConsentDialog
				open={consentOpen}
				onOpenChange={open => {
					setConsentOpen(open)
					if (!open && !continuingConsentRef.current && !isRecording) {
						broadcastRecordingStatusSafely("stopped")
					}
				}}
				isStarting={isStarting}
				onCancel={() => {
					setConsentOpen(false)
					broadcastRecordingStatusSafely("stopped")
				}}
				onContinue={() => {
					continuingConsentRef.current = true
					setConsentOpen(false)
					void start().finally(() => {
						continuingConsentRef.current = false
					})
				}}
			/>
		</>
	)
}
