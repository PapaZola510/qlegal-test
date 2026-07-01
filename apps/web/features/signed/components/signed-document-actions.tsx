"use client"

import * as React from "react"
import { toast } from "sonner"

import type { SignedDocumentCtcRequest } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import {
	downloadNotarizedPdfFromApiUrl,
	notarizedPdfOpenErrorMessage,
	openNotarizedPdfFromApiUrl,
} from "@/features/appointments/lib/open-notarized-pdf"
import { VerifyDocumentLink } from "@/features/document-verification/components/verify-document-link"
import { env } from "@/env"

import { CtcPaymentPanel } from "./ctc-payment-panel"

interface SignedDocumentActionsProps {
	appointmentId: string
	documentFileId: string
	documentTitle: string
	ctcRequest: SignedDocumentCtcRequest | null
	onRequestCertifiedTrueCopy: () => void
}

export function CtcStatusBadge({ ctc }: { ctc: SignedDocumentCtcRequest }) {
	if (ctc.outcome === "pending") {
		return (
			<Badge
				variant="outline"
				className="border-amber-500/50 bg-amber-500/15 text-[10px] font-medium text-amber-100"
			>
				CTC pending
			</Badge>
		)
	}
	if (ctc.outcome === "granted") {
		if (ctc.paymentRequired && !ctc.paymentPaid) {
			return (
				<Badge
					variant="outline"
					className="border-amber-500/50 bg-amber-500/15 text-[10px] font-medium text-amber-100"
				>
					CTC approved · payment due
				</Badge>
			)
		}
		return (
			<Badge className="text-[10px] font-medium" title="Certified true copy request approved">
				CTC approved
			</Badge>
		)
	}
	return (
		<Badge variant="destructive" className="text-[10px]" title={ctc.refusalReason ?? undefined}>
			CTC refused
		</Badge>
	)
}

export function SignedDocumentActions({
	appointmentId,
	documentFileId,
	documentTitle,
	ctcRequest,
	onRequestCertifiedTrueCopy,
}: SignedDocumentActionsProps) {
	const apiBase = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
	const notarizedPdfBase = `${apiBase}/v1/sessions/meetings/${appointmentId}/documents/${documentFileId}/notarized-pdf`
	const notarizedViewHref = notarizedPdfBase
	const notarizedDownloadHref = `${notarizedPdfBase}?download=1`
	const docName = documentTitle.trim() || "document.pdf"
	const downloadName = docName.toLowerCase().endsWith(".pdf") ? docName : `${docName}.pdf`
	const notarizedDownloadName = `${downloadName.replace(/\.pdf$/i, "")}-notarized.pdf`

	const [opening, setOpening] = React.useState(false)
	const [payOpen, setPayOpen] = React.useState(false)
	const ctcPending = ctcRequest?.outcome === "pending"
	const ctcGranted = ctcRequest?.outcome === "granted"
	const paymentDue = Boolean(ctcRequest?.paymentRequired && !ctcRequest?.paymentPaid)
	const canRequestCtc = !ctcPending && !ctcGranted
	const canViewNotarizedPdf = ctcGranted && !paymentDue

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
		<div className="flex w-full flex-col items-start gap-2 sm:items-end">
			<div className="flex flex-wrap items-center gap-2">
				{canViewNotarizedPdf ? (
					<>
						<Button
							type="button"
							size="sm"
							title="Sealed notarized PDF "
							disabled={opening}
							onClick={() => void handleViewNotarizedPdf()}
						>
							{opening ? "Loading PDF…" : "View"}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							title="Sealed notarized PDF "
							disabled={opening}
							onClick={() => void handleDownloadNotarizedPdf()}
						>
							Download
						</Button>
					</>
				) : null}
				<VerifyDocumentLink variant="ghost" size="sm">
					Verify
				</VerifyDocumentLink>
				{paymentDue && ctcRequest ? (
					<Button type="button" size="sm" onClick={() => setPayOpen(true)}>
						Pay CTC fee
					</Button>
				) : null}
				{canRequestCtc ? (
					<Button
						type="button"
						variant="secondary"
						size="sm"
						onClick={onRequestCertifiedTrueCopy}
						title="Request a certified true copy from your notary"
					>
						Request certified true copy
					</Button>
				) : null}
			</div>
			{ctcRequest ? (
				<div className="flex flex-col items-start gap-1 sm:items-end">
					{ctcRequest.outcome === "granted" && paymentDue ? (
						<p className="text-muted-foreground max-w-sm text-right text-[11px] leading-relaxed">
							Your notary approved this request. Pay the certified true copy fee to unlock view and
							download.
						</p>
					) : null}
					{ctcRequest.outcome === "granted" && !paymentDue ? (
						<p className="text-muted-foreground max-w-sm text-right text-[11px] leading-relaxed">
							Your notary approved this request. View and download are now available.
						</p>
					) : null}
					{ctcRequest.outcome === "pending" ? (
						<p className="text-muted-foreground max-w-sm text-right text-[11px] leading-relaxed">
							Your certified true copy request is pending notary approval. View and download unlock
							after approval
							{ctcRequest.paymentRequired ? " and online payment" : ""}.
						</p>
					) : null}
					{ctcRequest.outcome === "refused" && ctcRequest.refusalReason ? (
						<p className="text-muted-foreground max-w-sm text-right text-[11px] leading-relaxed">
							Reason: {ctcRequest.refusalReason}
						</p>
					) : null}
					{ctcRequest.outcome === "refused" ? (
						<Button
							type="button"
							variant="link"
							size="sm"
							className="h-auto px-0 text-xs"
							onClick={onRequestCertifiedTrueCopy}
						>
							Submit a new request
						</Button>
					) : null}
				</div>
			) : null}

			{ctcRequest && paymentDue ? (
				<Dialog open={payOpen} onOpenChange={setPayOpen}>
					<DialogContent className="max-w-lg gap-4 sm:max-w-xl">
						<DialogHeader className="text-left">
							<DialogTitle className="text-sm">Pay certified true copy fee</DialogTitle>
							<DialogDescription className="text-xs">
								Complete payment through AltPayNet for {documentTitle}.
							</DialogDescription>
						</DialogHeader>
						<CtcPaymentPanel requestId={ctcRequest.id} onPaid={() => setPayOpen(false)} />
					</DialogContent>
				</Dialog>
			) : null}
		</div>
	)
}
