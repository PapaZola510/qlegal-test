"use client"

import * as React from "react"
import { toast } from "sonner"

import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { orpcClient } from "@/services/orpc/client"

export function useMeetingLocalSigning(args: {
	meetingId: string
	documentId: string | null
	onSuccess?: () => void
}) {
	const [signaturePngBase64, setSignaturePngBase64] = React.useState<string | null>(null)
	const [mode, setMode] = React.useState<"draw" | "upload">("draw")
	const [isStamping, setIsStamping] = React.useState(false)

	const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
	const isDrawingRef = React.useRef(false)

	React.useEffect(() => {
		setSignaturePngBase64(null)
		setIsStamping(false)
	}, [args.documentId])

	const initCanvas = React.useCallback(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const rect = canvas.getBoundingClientRect()
		canvas.width = rect.width * devicePixelRatio
		canvas.height = rect.height * devicePixelRatio
		const ctx = canvas.getContext("2d")
		if (!ctx) return

		ctx.scale(devicePixelRatio, devicePixelRatio)
		ctx.strokeStyle = "#000"
		ctx.lineWidth = 2.5
		ctx.lineCap = "round"
		ctx.lineJoin = "round"
	}, [])

	const startDrawing = React.useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
		isDrawingRef.current = true
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext("2d")
		if (!ctx) return
		const rect = canvas.getBoundingClientRect()
		ctx.beginPath()
		ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
	}, [])

	const draw = React.useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
		if (!isDrawingRef.current) return
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext("2d")
		if (!ctx) return
		const rect = canvas.getBoundingClientRect()
		ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
		ctx.stroke()
	}, [])

	const stopDrawing = React.useCallback(() => {
		isDrawingRef.current = false
	}, [])

	const clearCanvas = React.useCallback(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext("2d")
		if (!ctx) return
		ctx.clearRect(0, 0, canvas.width, canvas.height)
		setSignaturePngBase64(null)
	}, [])

	const captureCanvas = React.useCallback(() => {
		const canvas = canvasRef.current
		if (!canvas) return null
		return canvas.toDataURL("image/png")
	}, [])

	const handleFileUpload = React.useCallback((file: File) => {
		const reader = new FileReader()
		reader.onload = () => {
			const result = reader.result as string
			setSignaturePngBase64(result)
		}
		reader.readAsDataURL(file)
	}, [])

	const handleUseCanvasSignature = React.useCallback(() => {
		const dataUrl = captureCanvas()
		if (!dataUrl) return
		setSignaturePngBase64(dataUrl)
	}, [captureCanvas])

	const confirmSignature = React.useCallback(async () => {
		const documentId = args.documentId
		if (!documentId) {
			toast.error("No active document")
			return
		}
		if (!signaturePngBase64) {
			toast.error("Please provide a signature before confirming")
			return
		}

		setIsStamping(true)
		try {
			await (orpcClient as any).session.markSignedForCurrentUser({
				meetingId: args.meetingId,
				documentId,
				signaturePngBase64,
			})
			toast.success("Signature recorded")
			args.onSuccess?.()
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not record the signature"))
		} finally {
			setIsStamping(false)
		}
	}, [args, signaturePngBase64])

	return {
		signaturePngBase64,
		mode,
		setMode,
		isStamping,
		canvasRef,
		initCanvas,
		startDrawing,
		draw,
		stopDrawing,
		clearCanvas,
		captureCanvas,
		handleFileUpload,
		handleUseCanvasSignature,
		confirmSignature,
	}
}
