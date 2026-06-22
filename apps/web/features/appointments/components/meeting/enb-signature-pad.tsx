"use client"

import * as React from "react"
import SignatureCanvas from "react-signature-canvas"

import { Button } from "@/core/components/ui/button"
import { cn } from "@/core/lib/utils"

export type EnbSignaturePadHandle = {
	getSignatureDataUrl: () => string | null
	clear: () => void
}

export const EnbSignaturePad = React.forwardRef<
	EnbSignaturePadHandle,
	{
		disabled?: boolean
		className?: string
		padHeight?: number
		/** Bump when a parent dialog opens so the canvas sizes after layout. */
		layoutKey?: string | number | boolean | null
	}
>(function EnbSignaturePad({ disabled, className, padHeight = 140, layoutKey = null }, ref) {
	const containerRef = React.useRef<HTMLDivElement>(null)
	const padRef = React.useRef<SignatureCanvas | null>(null)
	const lastWidthRef = React.useRef(0)
	const [strokeColor, setStrokeColor] = React.useState("#f5f2fa")
	const [padBackground, setPadBackground] = React.useState("#0b0414")

	React.useLayoutEffect(() => {
		const root = getComputedStyle(document.documentElement)
		const fg = root.getPropertyValue("--foreground").trim()
		const bg = root.getPropertyValue("--background").trim()
		if (fg) setStrokeColor(fg)
		if (bg) setPadBackground(bg)
	}, [])

	const fitCanvas = React.useCallback(
		(force = false) => {
			const container = containerRef.current
			const pad = padRef.current
			if (!container || !pad) return

			const width = container.clientWidth
			if (width < 1) return
			if (!force && Math.abs(width - lastWidthRef.current) < 2 && lastWidthRef.current > 0) {
				return
			}
			lastWidthRef.current = width

			const canvas = pad.getCanvas()
			const ratio = Math.max(window.devicePixelRatio || 1, 1)
			canvas.width = Math.floor(width * ratio)
			canvas.height = Math.floor(padHeight * ratio)
			canvas.style.width = `${width}px`
			canvas.style.height = `${padHeight}px`

			const ctx = canvas.getContext("2d")
			if (ctx) {
				ctx.setTransform(1, 0, 0, 1, 0, 0)
				ctx.scale(ratio, ratio)
			}
		},
		[padHeight]
	)

	React.useLayoutEffect(() => {
		lastWidthRef.current = 0
		fitCanvas(true)
		const id = window.requestAnimationFrame(() => fitCanvas(true))
		return () => window.cancelAnimationFrame(id)
	}, [fitCanvas, layoutKey])

	React.useEffect(() => {
		const container = containerRef.current
		if (!container) return
		const observer = new ResizeObserver(() => fitCanvas(false))
		observer.observe(container)
		return () => observer.disconnect()
	}, [fitCanvas])

	React.useImperativeHandle(ref, () => ({
		getSignatureDataUrl: () => {
			const pad = padRef.current
			if (!pad || pad.isEmpty()) return null
			const data = pad.toDataURL("image/png")
			return data.length > 32 ? data : null
		},
		clear: () => {
			padRef.current?.clear()
		},
	}))

	return (
		<div className={cn("space-y-2", className)}>
			<p className="text-muted-foreground text-sm">Draw your signature below</p>
			<div
				ref={containerRef}
				className={cn(
					"border-border bg-background w-full overflow-hidden rounded-md border",
					disabled && "pointer-events-none opacity-60"
				)}
				style={{ height: padHeight }}
			>
				<SignatureCanvas
					ref={padRef}
					penColor={strokeColor}
					backgroundColor={padBackground}
					minWidth={0.5}
					maxWidth={2.5}
					velocityFilterWeight={0.7}
					canvasProps={{
						className: "block w-full touch-none",
						"aria-label": "Signature pad",
					}}
				/>
			</div>
			<div className="flex justify-end">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					disabled={disabled}
					onClick={() => padRef.current?.clear()}
				>
					Clear signature
				</Button>
			</div>
		</div>
	)
})
