"use client"

import { useEffect, useState } from "react"
import { Copy01Icon, Download04FreeIcons, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import { IEN_ATTESTATION_ROLE_LABELS, type EnbAccessRequest } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import {
	downloadNotarizedPdfFromApiUrl,
	notarizedPdfOpenErrorMessage,
	openNotarizedPdfFromApiUrl,
} from "@/features/appointments/lib/open-notarized-pdf"
import { env } from "@/env"

import { useRegistryRefreshNotarizedDocumentMutation } from "../api/registry.hooks"
import { displayEntryNumber, notarizedPdfDownloadFilename, type RegistryAct } from "../lib/fixtures"
import { scNotarialActLabel, scNotarizationMode } from "../lib/sc-notarial-act-labels"
import { ProtestProceedingsForm } from "./protest-proceedings-form"

function formatRegistryDateTime(iso: string): string {
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return iso
	return date.toLocaleString(undefined, {
		month: "short",
		day: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	})
}

function formatShortDate(iso: string): string {
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return iso
	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "2-digit",
		year: "numeric",
	})
}

function copyToClipboard(value: string, label: string) {
	void navigator.clipboard.writeText(value)
	toast.success(`${label} copied`)
}

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 space-y-0.5">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="text-sm font-medium wrap-break-word">{value}</p>
		</div>
	)
}

function IdRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 space-y-1">
			<p className="text-muted-foreground text-xs">{label}</p>
			<div className="flex min-w-0 flex-wrap items-center gap-2">
				<code className="bg-muted max-w-full rounded px-2 py-1 font-mono text-xs wrap-break-word">
					{value}
				</code>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="text-muted-foreground h-7 shrink-0 px-2 text-xs"
					onClick={() => copyToClipboard(value, label)}
				>
					<HugeiconsIcon icon={Copy01Icon} className="mr-1 size-3" />
					Copy
				</Button>
			</div>
		</div>
	)
}

function accessOutcomeBadge(outcome: EnbAccessRequest["outcome"]) {
	if (outcome === "granted") return <Badge className="text-[10px]">Granted</Badge>
	if (outcome === "refused")
		return (
			<Badge variant="destructive" className="text-[10px]">
				Refused
			</Badge>
		)
	return (
		<Badge variant="outline" className="text-[10px]">
			Pending
		</Badge>
	)
}

export function RegistryExpandPanel({
	act,
	accessRequests = [],
	onReviewAccessRequest,
}: {
	act: RegistryAct
	accessRequests?: EnbAccessRequest[]
	onReviewAccessRequest?: (request: EnbAccessRequest) => void
}) {
	const refreshNotarizedDocument = useRegistryRefreshNotarizedDocumentMutation()
	const [documentCode, setDocumentCode] = useState<string | null>(act.documentCode)
	const [openingPdf, setOpeningPdf] = useState(false)

	useEffect(() => {
		setDocumentCode(act.documentCode)
	}, [act.id, act.documentCode])

	const scActLabel = scNotarialActLabel(act.actType)
	const scMode = scNotarizationMode(act.sessionMode)
	const principalNames =
		act.principals.length > 0 ? act.principals.map(p => p.name).join(", ") : "—"
	const witnessNames = act.witnesses.length > 0 ? act.witnesses.join(", ") : "None"
	const bookPage =
		act.bookNo && act.pageNo
			? `Book ${act.bookNo} · Page ${act.pageNo}`
			: act.bookNo
				? `Book ${act.bookNo}`
				: act.pageNo
					? `Page ${act.pageNo}`
					: "—"
	const hasEnbSignatures = act.principalEnbSignatures.length > 0
	const hasIenAttestations = act.ienNotarialAttestations.length > 0

	const meetingDocId = act.documentFileObjectId?.trim() || ""
	const canProxyNotarizedPdf = Boolean(meetingDocId)
	const storedUrl = act.documentUrl.trim()
	const apiBase = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
	const viewHref = `${apiBase}/v1/registry/acts/${act.id}/notarized-pdf`
	const downloadHref = `${viewHref}?download=1`
	const downloadName = notarizedPdfDownloadFilename(act)

	const loadVerificationCode = async () => {
		if (documentCode?.trim()) {
			copyToClipboard(documentCode.trim(), "Verification code")
			return
		}
		try {
			const result = await refreshNotarizedDocument.mutateAsync(act.id)
			const code = result.documentCode?.trim() || null
			setDocumentCode(code)
			if (code) {
				toast.success("Verification code loaded")
			} else {
				toast.error("No verification code is available for this document yet")
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to load verification code")
		}
	}

	const handleViewPdf = async () => {
		if (canProxyNotarizedPdf) {
			setOpeningPdf(true)
			try {
				await openNotarizedPdfFromApiUrl(viewHref)
			} catch (e) {
				toast.error(notarizedPdfOpenErrorMessage(e))
			} finally {
				setOpeningPdf(false)
			}
			return
		}
		if (storedUrl) {
			window.open(storedUrl, "_blank", "noopener,noreferrer")
		}
	}

	const handleDownloadPdf = async () => {
		if (canProxyNotarizedPdf) {
			setOpeningPdf(true)
			try {
				await downloadNotarizedPdfFromApiUrl(downloadHref, downloadName)
			} catch (e) {
				toast.error(notarizedPdfOpenErrorMessage(e))
			} finally {
				setOpeningPdf(false)
			}
			return
		}
		if (storedUrl) {
			const link = document.createElement("a")
			link.href = storedUrl
			link.download = downloadName
			link.target = "_blank"
			link.rel = "noopener noreferrer"
			link.click()
		}
	}

	const canOpenPdf = canProxyNotarizedPdf || Boolean(storedUrl)

	return (
		<div className="bg-muted/20 w-full max-w-full min-w-0 space-y-4 p-4 sm:p-5">
			{/* Header */}
			<div className="min-w-0 space-y-2">
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<Badge variant="outline" className="font-mono text-xs">
						{displayEntryNumber(act)}
					</Badge>
					<Badge variant="secondary" className="text-xs">
						{scActLabel}
					</Badge>
					<Badge variant="outline" className="text-xs">
						{scMode}
					</Badge>
					{act.completionStatus === "incomplete" ? (
						<Badge variant="outline" className="text-xs">
							Incomplete
						</Badge>
					) : null}
				</div>
				<h3 className="text-base leading-snug font-semibold wrap-break-word">
					{act.documentTitle}
				</h3>
			</div>

			{act.completionStatus === "incomplete" ? (
				<div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
					{act.incompleteReason ? (
						<p>
							<span className="font-medium">Reason:</span> {act.incompleteReason}
						</p>
					) : null}
					{act.incompleteCircumstances ? (
						<p className={act.incompleteReason ? "mt-1" : undefined}>
							<span className="font-medium">Circumstances:</span> {act.incompleteCircumstances}
						</p>
					) : null}
				</div>
			) : null}

			{act.actType === "protest" ? <ProtestProceedingsForm registryActId={act.id} /> : null}

			{/* Entry details — single compact block */}
			<div className="bg-background grid min-w-0 gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3">
				<DetailRow label="Principal(s)" value={principalNames} />
				<DetailRow label="Witnesses" value={witnessNames} />
				<DetailRow label="Book / page" value={bookPage} />
				<DetailRow label="Date & time" value={formatRegistryDateTime(act.executedAt)} />
				{act.location ? <DetailRow label="Location" value={act.location} /> : null}
				{act.appointmentPurpose?.trim() ? (
					<DetailRow label="Purpose of request" value={act.appointmentPurpose.trim()} />
				) : null}
				<DetailRow label="Fee" value={`₱${act.fee.toLocaleString()}`} />
			</div>

			{hasIenAttestations ? (
				<div className="bg-background min-w-0 space-y-3 rounded-lg border p-4">
					<div className="min-w-0 space-y-1">
						<p className="text-sm font-medium">{scMode} notarial acknowledgments</p>
						<p className="text-muted-foreground text-xs wrap-break-word">
							Checkbox confirmations recorded during ENB signing.
						</p>
					</div>
					<ul className="space-y-3">
						{act.ienNotarialAttestations.map((att, index) => (
							<li
								key={`${att.role}-${att.signerEmail}-${index}`}
								className="bg-muted/30 space-y-2 rounded-md border p-3"
							>
								<div className="space-y-0.5">
									<p className="text-sm font-medium wrap-break-word">{att.signerName}</p>
									<p className="text-muted-foreground text-xs">
										{IEN_ATTESTATION_ROLE_LABELS[att.role]} · {formatShortDate(att.confirmedAt)}
									</p>
								</div>
								<div className="bg-background max-h-32 overflow-y-auto rounded-md border px-3 py-2">
									<p className="text-xs leading-relaxed whitespace-pre-wrap">
										{att.acknowledgmentText}
									</p>
								</div>
							</li>
						))}
					</ul>
				</div>
			) : null}

			{/* ENB signatures — simplified */}
			<div className="bg-background min-w-0 space-y-3 rounded-lg border p-4">
				<div className="min-w-0 space-y-1">
					<p className="text-sm font-medium">ENB electronic signatures</p>
					<p className="text-muted-foreground text-xs wrap-break-word">Rule §4 · live session</p>
				</div>

				{hasEnbSignatures ? (
					<ul className="space-y-2">
						{act.principalEnbSignatures.map((sig, index) => (
							<li
								key={`${sig.signerName}-${sig.signedAt}-${index}`}
								className="bg-muted/30 flex min-w-0 flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center"
							>
								{sig.signatureImageData ? (
									<div className="bg-background shrink-0 self-start rounded border p-1.5">
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											src={
												sig.signatureImageData.startsWith("data:")
													? sig.signatureImageData
													: `data:image/png;base64,${sig.signatureImageData}`
											}
											alt={`Signature of ${sig.signerName}`}
											className="max-h-14 max-w-36 object-contain"
										/>
									</div>
								) : null}
								<div className="min-w-0 flex-1 space-y-0.5">
									<p className="text-sm font-medium wrap-break-word">{sig.signerName}</p>
									<p className="text-muted-foreground text-xs capitalize">
										{sig.signerRole ?? "signer"} · {formatShortDate(sig.signedAt)}
									</p>
								</div>
							</li>
						))}
					</ul>
				) : (
					<p className="text-muted-foreground text-sm">
						No electronic signatures recorded for this entry yet.
					</p>
				)}
			</div>

			{/* ENB access / certified true copy requests for this entry */}
			{accessRequests.length > 0 ? (
				<div className="bg-background min-w-0 space-y-3 rounded-lg border p-4">
					<div className="min-w-0 space-y-1">
						<p className="text-sm font-medium">ENB access requests</p>
						<p className="text-muted-foreground text-xs">
							Inspect, copy, and certified true copy requests linked to this entry.
						</p>
					</div>
					<ul className="space-y-2">
						{accessRequests.map(request => (
							<li
								key={request.id}
								className="bg-muted/30 flex min-w-0 flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
							>
								<div className="min-w-0 space-y-1">
									<div className="flex flex-wrap items-center gap-2">
										<p className="text-sm font-medium">{request.requesterName}</p>
										{request.certifiedTrueCopy ? (
											<Badge variant="secondary" className="text-[9px]">
												CTC
											</Badge>
										) : null}
										{accessOutcomeBadge(request.outcome)}
									</div>
									<p className="text-muted-foreground text-xs wrap-break-word">
										{request.lawfulPurpose}
									</p>
									<p className="text-muted-foreground text-xs">
										Requested {formatShortDate(request.requestedAt)}
									</p>
								</div>
								{request.outcome === "pending" && onReviewAccessRequest ? (
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="shrink-0"
										onClick={() => onReviewAccessRequest(request)}
									>
										Review request
									</Button>
								) : null}
							</li>
						))}
					</ul>
				</div>
			) : null}

			{/* Notarized document */}
			<div className="bg-background min-w-0 space-y-3 rounded-lg border p-4">
				<p className="text-sm font-medium">Notarized document</p>
				{documentCode ? (
					<p className="text-muted-foreground font-mono text-xs wrap-break-word">
						Verification: {documentCode}
					</p>
				) : null}
				<div className="flex min-w-0 flex-wrap gap-2">
					<Button
						type="button"
						size="sm"
						variant="secondary"
						className="min-w-0 shrink"
						disabled={refreshNotarizedDocument.isPending}
						onClick={() => void loadVerificationCode()}
					>
						{refreshNotarizedDocument.isPending ? (
							<HugeiconsIcon icon={Loading03Icon} className="mr-2 size-4 animate-spin" />
						) : null}
						{documentCode ? "Copy verification code" : "Load verification code"}
					</Button>
					{canOpenPdf ? (
						<>
							<Button
								type="button"
								size="sm"
								variant="outline"
								disabled={openingPdf}
								onClick={() => void handleViewPdf()}
							>
								{openingPdf ? "Loading…" : "View"}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								disabled={openingPdf}
								onClick={() => void handleDownloadPdf()}
							>
								<HugeiconsIcon icon={Download04FreeIcons} className="mr-2 size-4" />
								Download
							</Button>
						</>
					) : null}
					{documentCode ? (
						<Button
							size="sm"
							variant="outline"
							nativeButton={false}
							render={
								<a
									href={`/verify/document?code=${encodeURIComponent(documentCode)}`}
									target="_blank"
									rel="noopener noreferrer"
								/>
							}
						>
							Verify document
						</Button>
					) : null}
				</div>
			</div>

			{/* Registry identifiers */}
			<div className="bg-background min-w-0 space-y-3 rounded-lg border p-4">
				<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
					Supreme Court registry identifiers
				</p>
				<div className="grid min-w-0 gap-3">
					<IdRow label="NRID" value={act.nrid} />
					<IdRow label="Registry entry (NRN)" value={act.nrn} />
					{act.projectUuid ? <IdRow label="Project UUID" value={act.projectUuid} /> : null}
				</div>
			</div>

			{act.scSync === "failed" && act.scFailureReason ? (
				<div className="bg-destructive/10 border-destructive/20 rounded-lg border p-4">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="destructive" className="text-[10px]">
							SC sync failed
						</Badge>
						{act.scFailureTimestamp ? (
							<span className="text-muted-foreground text-xs">
								{formatRegistryDateTime(act.scFailureTimestamp)}
							</span>
						) : null}
					</div>
					<p className="text-destructive mt-2 text-sm leading-relaxed break-words">
						{act.scFailureReason}
					</p>
				</div>
			) : null}
		</div>
	)
}
