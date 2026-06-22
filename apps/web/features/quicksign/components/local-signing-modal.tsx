"use client"

import * as React from "react"
import { Loading03Icon, PenToolIcon, Upload04Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { Spinner } from "@/core/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/core/components/ui/toggle-group"

import { useLocalSigning } from "../api/use-local-signing"

export function LocalSigningModal({
	open,
	onOpenChange,
	projectId,
	signerEmail,
	signerName,
	onStamped,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	projectId: string | null
	signerEmail: string
	signerName?: string | null
	onStamped?: () => void
}) {
	const signing = useLocalSigning({
		projectId,
		signerEmail,
		onSuccess: () => {
			onOpenChange(false)
			onStamped?.()
		},
	})

	const fileInputRef = React.useRef<HTMLInputElement>(null)

	React.useEffect(() => {
		if (!open) return
		signing.clearCanvas()
		signing.setMode("draw")
	}, [open])

	React.useEffect(() => {
		if (!open || signing.mode !== "draw") return
		const timer = requestAnimationFrame(() => signing.initCanvas())
		return () => cancelAnimationFrame(timer)
	}, [open, signing.mode, signing.initCanvas])

	const handleFileChange = React.useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0]
			if (file) signing.handleFileUpload(file)
		},
		[signing.handleFileUpload]
	)

	const label = signerName?.trim() || signerEmail

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="z-[200] max-w-md">
				<DialogHeader>
					<DialogTitle className="text-sm">Stamp signature</DialogTitle>
					<DialogDescription className="text-xs leading-relaxed">
						Provide a signature for <strong>{label}</strong> to stamp onto the PDF.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3">
					<ToggleGroup
						type="single"
						value={signing.mode}
						onValueChange={v => {
							if (v) signing.setMode(v as "draw" | "upload")
						}}
						className="gap-2"
					>
						<ToggleGroupItem value="draw" size="sm" className="gap-1.5 text-xs">
							<HugeiconsIcon icon={PenToolIcon} strokeWidth={2} className="size-3.5" />
							Draw
						</ToggleGroupItem>
						<ToggleGroupItem value="upload" size="sm" className="gap-1.5 text-xs">
							<HugeiconsIcon icon={Upload04Icon} strokeWidth={2} className="size-3.5" />
							Upload
						</ToggleGroupItem>
					</ToggleGroup>

					{signing.mode === "draw" ? (
						<div className="space-y-2">
							<canvas
								ref={signing.canvasRef}
								className="border-border h-32 w-full rounded-lg border bg-white"
								onPointerDown={signing.startDrawing}
								onPointerMove={signing.draw}
								onPointerUp={signing.stopDrawing}
								onPointerLeave={signing.stopDrawing}
								onPointerCancel={signing.stopDrawing}
							/>
							<Button
								type="button"
								variant="outline"
								size="xs"
								onClick={signing.clearCanvas}
								className="text-xs"
							>
								Clear
							</Button>
						</div>
					) : (
						<div className="space-y-2">
							<input
								ref={fileInputRef}
								type="file"
								accept="image/png"
								className="hidden"
								onChange={handleFileChange}
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="w-full text-xs"
								onClick={() => fileInputRef.current?.click()}
							>
								<HugeiconsIcon icon={Upload04Icon} strokeWidth={2} className="mr-1.5 size-4" />
								Choose PNG signature
							</Button>
							{signing.signaturePngBase64 && (
								<div className="border-border flex h-20 items-center justify-center rounded-lg border bg-white p-2">
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={signing.signaturePngBase64}
										alt="Uploaded signature"
										className="max-h-full max-w-full object-contain"
									/>
								</div>
							)}
						</div>
					)}
				</div>

				<DialogFooter className="gap-2 sm:justify-end">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="text-xs"
						disabled={signing.isStamping}
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						className="text-xs"
						disabled={signing.isStamping || !signing.signaturePngBase64}
						onClick={() => void signing.stampSignature()}
					>
						{signing.isStamping ? (
							<>
								<Spinner className="mr-1.5" />
								Stamping…
							</>
						) : (
							"Stamp signature"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
