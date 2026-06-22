"use client"

import * as React from "react"
import { Csv01Icon, Loading03Icon, Pdf01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import type { MeetingPaymentStatus } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import { cn } from "@/core/lib/utils"
import {
	canDownloadSessionChargesReceipt,
	downloadSessionChargesCsv,
	downloadSessionChargesPdf,
	type SessionChargesExportInput,
} from "@/features/appointments/lib/export-session-charges"

export function SessionChargesExportButtons({
	exportInput,
	paymentStatus,
	size = "sm",
	className,
	onPointerDown,
}: {
	exportInput: SessionChargesExportInput
	paymentStatus?: MeetingPaymentStatus | null
	size?: "sm" | "xs"
	className?: string
	/** Stop collapsible trigger from toggling when clicking export. */
	onPointerDown?: (e: React.PointerEvent) => void
}) {
	const [exporting, setExporting] = React.useState<"csv" | "pdf" | null>(null)
	const canDownload = canDownloadSessionChargesReceipt(paymentStatus)
	const iconClassName = size === "xs" ? "size-3" : "size-3.5"

	if (!canDownload) return null

	async function handlePdf() {
		if (!canDownloadSessionChargesReceipt(paymentStatus)) {
			toast.error("Receipt is available after payment is completed.")
			return
		}
		setExporting("pdf")
		try {
			await downloadSessionChargesPdf(exportInput, paymentStatus)
			toast.success("Payment receipt downloaded.")
		} catch {
			toast.error("Could not generate PDF.")
		} finally {
			setExporting(null)
		}
	}

	function handleCsv() {
		if (!canDownloadSessionChargesReceipt(paymentStatus)) {
			toast.error("Receipt is available after payment is completed.")
			return
		}
		setExporting("csv")
		try {
			downloadSessionChargesCsv(exportInput, paymentStatus)
			toast.success("Session charges CSV downloaded.")
		} catch {
			toast.error("Could not generate CSV.")
		} finally {
			setExporting(null)
		}
	}

	return (
		<div
			className={cn("flex shrink-0 items-center gap-1", className)}
			onPointerDown={onPointerDown}
			role="presentation"
		>
			<Button
				type="button"
				variant="outline"
				size={size}
				disabled={exporting !== null}
				onClick={() => handleCsv()}
				aria-label="Download session charges as CSV"
			>
				{exporting === "csv" ? (
					<HugeiconsIcon
						icon={Loading03Icon}
						className={cn(iconClassName, "animate-spin")}
						strokeWidth={2}
					/>
				) : (
					<HugeiconsIcon icon={Csv01Icon} className={iconClassName} strokeWidth={2} />
				)}
				CSV
			</Button>
			<Button
				type="button"
				variant="outline"
				size={size}
				disabled={exporting !== null}
				onClick={() => void handlePdf()}
				aria-label="Download payment receipt as PDF"
			>
				{exporting === "pdf" ? (
					<HugeiconsIcon
						icon={Loading03Icon}
						className={cn(iconClassName, "animate-spin")}
						strokeWidth={2}
					/>
				) : (
					<HugeiconsIcon icon={Pdf01Icon} className={iconClassName} strokeWidth={2} />
				)}
				PDF
			</Button>
		</div>
	)
}
