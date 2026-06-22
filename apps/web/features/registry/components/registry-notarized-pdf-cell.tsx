"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/core/components/ui/button"
import { cn } from "@/core/lib/utils"
import {
	downloadNotarizedPdfFromApiUrl,
	notarizedPdfOpenErrorMessage,
	openNotarizedPdfFromApiUrl,
} from "@/features/appointments/lib/open-notarized-pdf"
import { env } from "@/env"

import { notarizedPdfDownloadFilename, type RegistryAct } from "../lib/fixtures"

interface RegistryNotarizedPdfCellProps {
	act: RegistryAct
}

export function RegistryNotarizedPdfCell({ act }: RegistryNotarizedPdfCellProps) {
	const meetingDocId = act.documentFileObjectId?.trim() || ""
	const canProxyNotarizedPdf = Boolean(meetingDocId)
	const storedUrl = act.documentUrl.trim()

	const apiBase = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
	const viewHref = `${apiBase}/v1/registry/acts/${act.id}/notarized-pdf`
	const downloadHref = `${viewHref}?download=1`
	const downloadName = notarizedPdfDownloadFilename(act)

	const [opening, setOpening] = React.useState(false)

	async function handleView() {
		setOpening(true)
		try {
			await openNotarizedPdfFromApiUrl(viewHref)
		} catch (e) {
			toast.error(notarizedPdfOpenErrorMessage(e))
		} finally {
			setOpening(false)
		}
	}

	async function handleDownload() {
		setOpening(true)
		try {
			await downloadNotarizedPdfFromApiUrl(downloadHref, downloadName)
		} catch (e) {
			toast.error(notarizedPdfOpenErrorMessage(e))
		} finally {
			setOpening(false)
		}
	}

	if (canProxyNotarizedPdf) {
		return (
			<div className="flex flex-wrap items-center gap-2">
				<Button
					type="button"
					size="sm"
					variant="outline"
					disabled={opening}
					onClick={() => void handleView()}
				>
					{opening ? "Loading PDF…" : "View"}
				</Button>
				<Button
					type="button"
					size="sm"
					variant="secondary"
					disabled={opening}
					onClick={() => void handleDownload()}
				>
					Download
				</Button>
			</div>
		)
	}

	if (storedUrl) {
		return (
			<div className="flex flex-wrap items-center gap-2">
				<a
					href={storedUrl}
					target="_blank"
					rel="noopener noreferrer"
					className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
				>
					View
				</a>
				<a
					href={storedUrl}
					download={downloadName}
					target="_blank"
					rel="noopener noreferrer"
					className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "inline-flex")}
				>
					Download
				</a>
			</div>
		)
	}

	return <span className="text-muted-foreground text-xs">—</span>
}
