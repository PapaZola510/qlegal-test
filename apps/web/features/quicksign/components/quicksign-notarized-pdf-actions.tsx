"use client"

import * as React from "react"
import type { Route } from "next"
import Link from "next/link"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/core/components/ui/button"
import { cn } from "@/core/lib/utils"
import {
	downloadNotarizedPdfFromApiUrl,
	notarizedPdfOpenErrorMessage,
	openNotarizedPdfFromApiUrl,
} from "@/features/appointments/lib/open-notarized-pdf"
import { env } from "@/env"

interface QuicksignNotarizedPdfActionsProps {
	appointmentId: string
	documentFileId: string
	documentTitle: string
	registrySynced: boolean
	/** When false, signatures are still syncing in our DB / DocOnChain. */
	canAccessNotarized: boolean
}

export function QuicksignNotarizedPdfActions({
	appointmentId,
	documentFileId,
	documentTitle,
	registrySynced,
	canAccessNotarized,
}: QuicksignNotarizedPdfActionsProps) {
	const apiBase = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
	const notarizedPdfBase = `${apiBase}/v1/sessions/meetings/${appointmentId}/documents/${documentFileId}/notarized-pdf`
	const notarizedViewHref = notarizedPdfBase
	const notarizedDownloadHref = `${notarizedPdfBase}?download=1`
	const docName = documentTitle.trim() || "document.pdf"
	const downloadName = docName.toLowerCase().endsWith(".pdf") ? docName : `${docName}.pdf`
	const notarizedDownloadName = `${downloadName.replace(/\.pdf$/i, "")}-notarized.pdf`

	const [opening, setOpening] = React.useState(false)

	async function handleViewNotarizedPdf() {
		setOpening(true)
		try {
			await openNotarizedPdfFromApiUrl(notarizedViewHref)
		} catch (e) {
			toast.error(notarizedPdfOpenErrorMessage(e))
		} finally {
			setOpening(false)
		}
	}

	async function handleDownloadNotarizedPdf() {
		setOpening(true)
		try {
			await downloadNotarizedPdfFromApiUrl(notarizedDownloadHref, notarizedDownloadName)
		} catch (e) {
			toast.error(notarizedPdfOpenErrorMessage(e))
		} finally {
			setOpening(false)
		}
	}

	return (
		<div className="space-y-2">
			<p className="text-xs font-medium text-green-600 dark:text-green-500">
				{!canAccessNotarized
					? "Syncing signature status from DocOnChain…"
					: "All signatures complete — use View or Download for the notarized PDF"}
			</p>
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					size="sm"
					title="Sealed notarized PDF from DocOnChain"
					disabled={opening || !canAccessNotarized}
					onClick={() => void handleViewNotarizedPdf()}
				>
					{opening ? "Loading PDF…" : "View"}
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					title="Sealed notarized PDF from DocOnChain"
					disabled={opening || !canAccessNotarized}
					onClick={() => void handleDownloadNotarizedPdf()}
				>
					Download
				</Button>
				{registrySynced ? (
					<Link
						href={"/registry" as Route}
						className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
					>
						Open registry
					</Link>
				) : null}
			</div>
		</div>
	)
}
