"use client"

import * as React from "react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import type {
	Appointment,
	AppointmentAttachment,
	AppointmentBookedDocumentType,
	ListMeetingDocumentSignerAssignmentsResult,
	ListMeetingDocumentSignersResult,
	MeetingPaymentStatus,
	MeetingSignerParticipant,
	UserProfile,
} from "@repo/contracts"

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/core/components/ui/alert-dialog"
import { Button, buttonVariants } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/core/components/ui/collapsible"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Spinner } from "@/core/components/ui/spinner"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { cn } from "@/core/lib/utils"
import { useAppointmentQuery } from "@/features/appointments/api/appointments.hooks"
import {
	canDownloadSessionChargesReceipt,
	lineItemsFromAttachments,
	meetingDocumentDisplayName,
	type SessionChargesExportInput,
} from "@/features/appointments/lib/export-session-charges"
import { formatMeetingDocumentType } from "@/features/appointments/lib/meeting-document-types"
import {
	downloadNotarizedPdfFromApiUrl,
	notarizedPdfOpenErrorMessage,
	openNotarizedPdfFromApiUrl,
} from "@/features/appointments/lib/open-notarized-pdf"
import { uploadAppointmentAttachmentFile } from "@/features/appointments/lib/upload-appointment-file"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import { env } from "@/env"

import {
	useAppointmentAttachmentsQuery,
	useAppointmentBookedDocumentTypesQuery,
	useCreateMeetingDocumentProjectMutation,
	useDeleteMeetingDocumentMutation,
	useLinkMeetingDocumentMutation,
	useListMeetingDocumentSignerAssignmentsQuery,
	useListMeetingDocumentSignersQuery,
	useMeetingSignerParticipantsQuery,
	usePrincipalMeetingDocumentUploadMutation,
	useUpdateMeetingDocumentFeeMutation,
} from "../../api/meeting.hooks"
import type { useDocumentSigning } from "../../api/use-document-signing"
import {
	isMeetingDocumentUploadLocked,
	isMeetingNotarizedPdfLocked,
} from "../../lib/meeting-access"
import { DocumentActions } from "./document/document-actions"
import type { SignerParticipant } from "./document/meeting-signer-types"
import { MeetingFeeBreakdownView } from "./meeting-fee-breakdown"
import { MeetingPaymentStatusStrip } from "./meeting-payment-status-strip"
import { SessionChargesExportButtons } from "./session-charges-export-buttons"
import { UploadDocumentModal } from "./upload-document-modal"

function formatBytes(bytes: number | undefined): string {
	if (!bytes || bytes <= 0) return "Unknown size"
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function mimeLabel(mime: string): string {
	if (mime.includes("pdf")) return "PDF"
	if (mime.includes("wordprocessingml")) return "DOCX"
	if (mime.startsWith("image/")) return "Image"
	return mime.split("/").pop()?.toUpperCase() ?? "File"
}

function formatFeePhp(amount: number): string {
	return `₱${amount.toLocaleString("en-PH")}`
}

function summarizeDocumentFees(items: AppointmentAttachment[]): {
	totalFeePhp: number
	pricedCount: number
	unpricedCount: number
} {
	let totalFeePhp = 0
	let pricedCount = 0
	for (const item of items) {
		if (typeof item.feePhp === "number" && item.feePhp > 0) {
			totalFeePhp += item.feePhp
			pricedCount += 1
		}
	}
	return {
		totalFeePhp,
		pricedCount,
		unpricedCount: items.length - pricedCount,
	}
}

function MeetingDocumentsPosTotal({
	appointmentId,
	appointmentTitle,
	items,
	isEnp,
	isClient,
	paymentStatus,
	stickyFooter = false,
}: {
	appointmentId: string
	appointmentTitle?: string
	items: AppointmentAttachment[]
	isEnp: boolean
	isClient: boolean
	paymentStatus?: MeetingPaymentStatus
	stickyFooter?: boolean
}) {
	const feeSummary = summarizeDocumentFees(items)
	const showPaymentStatus = paymentStatus?.required === true && (paymentStatus.totalFeePhp ?? 0) > 0
	const headerTotalPhp = paymentStatus?.breakdown?.totalPhp ?? feeSummary.totalFeePhp

	const exportInput: SessionChargesExportInput = {
		appointmentId,
		appointmentTitle,
		lineItems: lineItemsFromAttachments(items, meetingDocumentDisplayName),
		breakdown: paymentStatus?.breakdown,
	}

	return (
		<Collapsible
			defaultOpen={!stickyFooter}
			className={cn(
				"border-foreground/15 bg-card overflow-hidden rounded-lg border",
				stickyFooter ? "shadow-none" : "shadow-sm"
			)}
		>
			<div
				className={cn(
					"hover:bg-muted/40 flex w-full items-center gap-2 transition-colors",
					stickyFooter ? "px-3 py-2" : "px-4 py-2.5"
				)}
			>
				<CollapsibleTrigger
					className="group flex min-w-0 flex-1 items-center gap-2 text-left"
					aria-label="Toggle session charges"
				>
					<div className="min-w-0 flex-1">
						<p className="text-[10px] font-semibold tracking-[0.2em] uppercase">Session charges</p>
						<p className="mt-0.5 text-sm font-semibold tabular-nums">
							{formatFeePhp(headerTotalPhp)}
							{paymentStatus?.paid ? (
								<span className="text-muted-foreground ml-2 text-xs font-normal">· Paid</span>
							) : null}
						</p>
					</div>
					<HugeiconsIcon
						icon={ArrowDown01Icon}
						strokeWidth={2}
						className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-panel-open:rotate-180"
					/>
				</CollapsibleTrigger>
				{canDownloadSessionChargesReceipt(paymentStatus) ? (
					<SessionChargesExportButtons
						exportInput={exportInput}
						paymentStatus={paymentStatus}
						size="xs"
					/>
				) : null}
			</div>
			<CollapsibleContent>
				<div
					className={cn(
						"border-foreground/10 space-y-0 border-t font-mono text-xs",
						stickyFooter ? "px-3 py-2" : "px-4 py-3"
					)}
					aria-label="Session fees total"
				>
					<ul
						className={cn(
							"space-y-2",
							stickyFooter &&
								items.length > 2 &&
								"max-h-20 overflow-y-auto overscroll-y-contain pr-1"
						)}
					>
						{items.map((att, idx) => {
							const name = meetingDocumentDisplayName(att, idx)
							const fee = typeof att.feePhp === "number" && att.feePhp > 0 ? att.feePhp : null
							return (
								<li
									key={att.id}
									className="border-border/80 flex items-start justify-between gap-3 border-b border-dashed pb-2 last:border-0 last:pb-0"
								>
									<span className="text-foreground line-clamp-2 min-w-0 flex-1 font-sans leading-snug break-words">
										{name}
									</span>
									<span
										className={cn(
											"shrink-0 tabular-nums",
											fee !== null ? "text-foreground font-medium" : "text-muted-foreground"
										)}
									>
										{fee !== null ? formatFeePhp(fee) : isEnp ? "—" : "Pending"}
									</span>
								</li>
							)
						})}
					</ul>
					<div className="border-foreground/20 my-3 border-t border-double" />
					<div className="text-muted-foreground flex items-center justify-between gap-4 font-sans text-xs">
						<span>
							{items.length} item{items.length === 1 ? "" : "s"}
							{feeSummary.pricedCount < items.length ? ` · ${feeSummary.pricedCount} priced` : ""}
						</span>
						<span className="tabular-nums">
							{feeSummary.pricedCount === items.length && items.length > 0
								? "All priced"
								: feeSummary.pricedCount > 0
									? `${feeSummary.unpricedCount} awaiting fee`
									: isEnp
										? "Set fees above"
										: "Awaiting ENP"}
						</span>
					</div>
					{paymentStatus?.breakdown &&
					feeSummary.pricedCount === items.length &&
					items.length > 0 ? (
						<div className="border-foreground/15 mt-2 border-t pt-2.5">
							<MeetingFeeBreakdownView breakdown={paymentStatus.breakdown} compact />
						</div>
					) : (
						<div className="border-foreground/15 mt-2 flex items-baseline justify-between gap-3 border-t pt-2.5">
							<span className="text-muted-foreground font-sans text-xs font-semibold tracking-wide uppercase">
								Notarial subtotal
							</span>
							<span className="text-base font-semibold tabular-nums">
								{formatFeePhp(feeSummary.totalFeePhp)}
							</span>
						</div>
					)}
					{showPaymentStatus && paymentStatus ? (
						<div className="mt-2">
							<MeetingPaymentStatusStrip
								paymentStatus={paymentStatus}
								role={isClient ? "client" : "enp"}
							/>
						</div>
					) : null}
					{feeSummary.unpricedCount > 0 ? (
						<p className="text-muted-foreground mt-2 text-center font-sans text-[11px] leading-relaxed">
							{isEnp
								? "Total updates when every document has a notarization fee."
								: "Total will update after the ENP sets fees on all documents."}
						</p>
					) : (paymentStatus?.breakdown?.totalPhp ?? feeSummary.totalFeePhp) > 0 &&
					  !showPaymentStatus ? (
						<p className="text-muted-foreground mt-2 text-center font-sans text-[11px] leading-relaxed">
							{isClient
								? "Pay this total in the Payment tab via QRPH."
								: "The client pays this total in their Payment tab."}
						</p>
					) : null}
				</div>
			</CollapsibleContent>
		</Collapsible>
	)
}

function DocumentInstrumentCard({
	attachment,
	index,
	apiBaseWithoutSlash,
	meetingId,
	participants,
	participantsLoaded,
	isEnp,
	enpUserId,
	currentUserId,
	currentUserEmail,
	documentSigning,
	createProject,
	notarizedPdfLocked,
	isClientViewer,
}: {
	attachment: AppointmentAttachment
	index: number
	apiBaseWithoutSlash: string
	meetingId: string
	participants: SignerParticipant[]
	participantsLoaded: boolean
	isEnp: boolean
	enpUserId: string | undefined
	currentUserId: string | undefined
	currentUserEmail: string | undefined
	documentSigning: ReturnType<typeof useDocumentSigning>
	createProject: ReturnType<typeof useCreateMeetingDocumentProjectMutation>
	/** Clients/witnesses: hide notarized view/download until session payment succeeds. */
	notarizedPdfLocked: boolean
	isClientViewer: boolean
}) {
	const signersQ = useListMeetingDocumentSignersQuery(meetingId, attachment.fileObjectId, {
		pollWhileSigning: true,
	})
	const assignmentsQ = useListMeetingDocumentSignerAssignmentsQuery(
		meetingId,
		attachment.fileObjectId
	)
	const updateFee = useUpdateMeetingDocumentFeeMutation(meetingId)
	const deleteDocument = useDeleteMeetingDocumentMutation(meetingId)
	const signersResult = signersQ.data as ListMeetingDocumentSignersResult | undefined
	const assignments = assignmentsQ.data as ListMeetingDocumentSignerAssignmentsResult | undefined
	const signersStatusLoading = signersQ.isPending && signersResult === undefined
	const plotCompletedAt = signersResult?.plotCompletedAt
	const isPlotted = documentSigning.isDocumentPlotted(attachment.fileObjectId, plotCompletedAt)
	const signingComplete = signersResult?.completed ?? false
	const notarizedPdfReady = signersResult?.notarizedPdfReady ?? false
	const notarizedStoredInDb = signersResult?.notarizedStoredInDb ?? false
	const preparingNotarized = signingComplete && !notarizedPdfReady && !signersStatusLoading
	const notarizedPdfBase = `${apiBaseWithoutSlash}/v1/sessions/meetings/${meetingId}/documents/${attachment.fileObjectId}/notarized-pdf`
	const notarizedViewHref = notarizedPdfBase
	const notarizedDownloadHref = `${notarizedPdfBase}?download=1`
	const originalHref = `${apiBaseWithoutSlash}/v1/files/${attachment.fileObjectId}`
	const docName = meetingDocumentDisplayName(attachment, index)
	const downloadName = docName.toLowerCase().endsWith(".pdf") ? docName : `${docName}.pdf`
	const notarizedDownloadName = `${downloadName.replace(/\.pdf$/i, "")}-notarized.pdf`
	const typeLabel = formatMeetingDocumentType(attachment.documentType)
	const sizeText = formatBytes(attachment.sizeBytes)

	const [notarizedPdfOpening, setNotarizedPdfOpening] = React.useState(false)
	const [feeDialogOpen, setFeeDialogOpen] = React.useState(false)
	const [feeInput, setFeeInput] = React.useState("")
	const [feeInputError, setFeeInputError] = React.useState<string | null>(null)
	const [feeDraft, setFeeDraft] = React.useState(
		attachment.feePhp !== null && attachment.feePhp !== undefined ? String(attachment.feePhp) : ""
	)
	const [feeDraftError, setFeeDraftError] = React.useState<string | null>(null)
	const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
	const serverProjectUuid =
		signersResult?.doconchainProjectUuid?.trim() ?? attachment.doconchainProjectUuid?.trim() ?? null
	const hasDoconchainProject = Boolean(serverProjectUuid)
	const isPrincipalUpload = attachment.uploadedByPrincipal === true
	const isCreatingProjectThis =
		createProject.isPending && createProject.variables?.fileObjectId === attachment.fileObjectId
	const assignedSignerCount = assignments?.signers.length ?? 0
	const canDeleteDocument =
		isEnp && assignmentsQ.isSuccess && assignedSignerCount === 0 && !signingComplete
	const isUpdatingFeeThis =
		updateFee.isPending && updateFee.variables?.fileObjectId === attachment.fileObjectId
	const isDeletingThis =
		deleteDocument.isPending && deleteDocument.variables?.fileObjectId === attachment.fileObjectId

	function parseFeePhp(raw: string): number | null {
		const trimmed = raw.trim().replace(/,/g, "")
		if (!trimmed) return null
		const n = Number.parseFloat(trimmed)
		if (!Number.isFinite(n) || n <= 0) return null
		return Math.round(n)
	}

	const savedFeePhp = attachment.feePhp ?? null
	const draftFeePhp = parseFeePhp(feeDraft)
	const feeIsDirty = draftFeePhp !== null && draftFeePhp !== savedFeePhp

	React.useEffect(() => {
		setFeeDraft(
			attachment.feePhp !== null && attachment.feePhp !== undefined ? String(attachment.feePhp) : ""
		)
		setFeeDraftError(null)
	}, [attachment.feePhp])

	function openCreateProjectFlow() {
		if (attachment.feePhp !== null && attachment.feePhp !== undefined && attachment.feePhp > 0) {
			void submitCreateProject(attachment.feePhp)
			return
		}
		setFeeInput("")
		setFeeInputError(null)
		setFeeDialogOpen(true)
	}

	async function submitCreateProject(feePhp: number) {
		try {
			await createProject.mutateAsync({
				fileObjectId: attachment.fileObjectId,
				feePhp,
			})
			setFeeDialogOpen(false)
			toast.success("Signing project created. You can now add signers.")
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not create the signing project."))
		}
	}

	async function confirmFeeAndCreateProject() {
		const feePhp = parseFeePhp(feeInput)
		if (feePhp === null) {
			setFeeInputError("Enter a fee greater than zero (PHP).")
			return
		}
		await submitCreateProject(feePhp)
	}

	async function saveDocumentFee() {
		const feePhp = parseFeePhp(feeDraft)
		if (feePhp === null) {
			setFeeDraftError("Enter a fee greater than zero (PHP).")
			return
		}
		setFeeDraftError(null)
		try {
			await updateFee.mutateAsync({
				fileObjectId: attachment.fileObjectId,
				feePhp,
			})
			toast.success("Notarization fee updated.")
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not update the fee."))
		}
	}

	async function handleDeleteDocument() {
		try {
			await deleteDocument.mutateAsync({ fileObjectId: attachment.fileObjectId })
			setDeleteDialogOpen(false)
			toast.success("Document removed from this session.")
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not delete the document."))
		}
	}

	async function handleViewNotarizedPdf() {
		setNotarizedPdfOpening(true)
		try {
			await openNotarizedPdfFromApiUrl(notarizedViewHref)
		} catch (e) {
			toast.error(notarizedPdfOpenErrorMessage(e))
		} finally {
			setNotarizedPdfOpening(false)
		}
	}

	async function handleDownloadNotarizedPdf() {
		setNotarizedPdfOpening(true)
		try {
			await downloadNotarizedPdfFromApiUrl(notarizedDownloadHref, notarizedDownloadName)
		} catch (e) {
			toast.error(notarizedPdfOpenErrorMessage(e))
		} finally {
			setNotarizedPdfOpening(false)
		}
	}

	const metaLine = [typeLabel, sizeText, mimeLabel(attachment.mimeType)].join(" · ")
	const showFeeEditor = isEnp && !signingComplete
	const showFeeReadOnly =
		!showFeeEditor && savedFeePhp !== null && savedFeePhp !== undefined && savedFeePhp > 0

	return (
		<Card data-size="sm" className="flex min-h-0 flex-col gap-3 overflow-visible py-3 shadow-sm">
			<CardHeader className="gap-1 px-3 pb-0">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0 flex-1">
						<CardTitle className="text-sm leading-snug font-semibold break-words">
							{docName}
						</CardTitle>
						<CardDescription className="text-xs leading-relaxed">{metaLine}</CardDescription>
					</div>
					{isEnp ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="text-destructive hover:text-destructive h-8 shrink-0 px-2 text-xs"
							disabled={!canDeleteDocument || isDeletingThis}
							onClick={() => setDeleteDialogOpen(true)}
							title={
								canDeleteDocument
									? "Remove this document from the session"
									: "Delete is only available before signers are assigned"
							}
						>
							{isDeletingThis ? "Deleting…" : "Delete"}
						</Button>
					) : null}
				</div>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-3 px-3 pt-0 pb-4">
				{showFeeEditor ? (
					<div className="space-y-2 rounded-md border border-dashed p-2.5">
						<Label htmlFor={`fee-edit-${attachment.fileObjectId}`} className="text-xs">
							Notarization fee (PHP)
						</Label>
						<div className="flex flex-wrap items-center gap-2">
							<Input
								id={`fee-edit-${attachment.fileObjectId}`}
								type="number"
								min={1}
								step={1}
								inputMode="numeric"
								className="h-8 max-w-[7.5rem] text-xs"
								value={feeDraft}
								onChange={e => {
									setFeeDraft(e.target.value)
									setFeeDraftError(null)
								}}
								disabled={isUpdatingFeeThis}
							/>
							<Button
								type="button"
								size="sm"
								variant="secondary"
								className="h-8 text-xs"
								disabled={!feeIsDirty || isUpdatingFeeThis}
								onClick={() => void saveDocumentFee()}
							>
								{isUpdatingFeeThis ? "Saving…" : "Save"}
							</Button>
						</div>
						{feeDraftError ? (
							<p className="text-destructive text-xs" role="alert">
								{feeDraftError}
							</p>
						) : savedFeePhp !== null && savedFeePhp !== undefined && savedFeePhp > 0 ? (
							<p className="text-muted-foreground text-[11px]">
								Saved: ₱{savedFeePhp.toLocaleString()}
							</p>
						) : null}
					</div>
				) : showFeeReadOnly ? (
					<p className="text-muted-foreground text-xs">Fee: ₱{savedFeePhp.toLocaleString()}</p>
				) : null}
				{!hasDoconchainProject ? (
					isEnp ? (
						<div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
							<p className="text-xs leading-relaxed">
								{isPrincipalUpload
									? "The principal added this document. Create the signing project to plot signatures and assign signers."
									: "Create the signing project to plot signatures and assign signers."}
							</p>
							<Button
								type="button"
								size="sm"
								className="w-full sm:w-auto"
								disabled={isCreatingProjectThis}
								onClick={() => openCreateProjectFlow()}
							>
								{isCreatingProjectThis ? "Creating project…" : "Initiate Signing Process"}
							</Button>
						</div>
					) : (
						<p className="text-muted-foreground text-xs leading-relaxed">
							Waiting for the ENP to create the signing project for this document.
						</p>
					)
				) : null}
				<div className="flex flex-wrap items-center gap-2">
					{signersStatusLoading ? (
						<p className="text-muted-foreground text-xs">Loading…</p>
					) : signingComplete ? (
						notarizedPdfLocked ? (
							<p className="text-muted-foreground text-xs leading-relaxed">
								{isClientViewer
									? "Complete session fee payment in the Payment tab to view or download notarized documents."
									: "Notarized PDF is available after the client completes session fee payment."}
							</p>
						) : preparingNotarized ? (
							<div className="flex flex-col gap-2">
								<div className="flex flex-wrap items-center gap-2">
									<Button
										type="button"
										size="sm"
										className="h-8 text-xs"
										disabled
										title="Waiting for DocOnChain to publish the completed notarized document"
									>
										<Spinner className="mr-1.5 size-3.5" />
										Preparing notarized…
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-8 text-xs"
										disabled
										title="Waiting for DocOnChain to publish the completed notarized document"
									>
										<Spinner className="mr-1.5 size-3.5" />
										Download
									</Button>
								</div>
								<p className="text-muted-foreground text-xs leading-relaxed">
									All signatures are in. Waiting for DocOnChain to finish notarization and publish
									the sealed document — this usually takes a minute.
								</p>
							</div>
						) : (
							<>
								<Button
									type="button"
									size="sm"
									className="h-8 text-xs"
									title={
										notarizedStoredInDb
											? "Sealed notarized PDF (stored copy)"
											: "Sealed notarized PDF from DocOnChain"
									}
									disabled={!notarizedPdfReady || notarizedPdfOpening}
									onClick={() => void handleViewNotarizedPdf()}
								>
									{notarizedPdfOpening ? (
										<>
											<Spinner className="mr-1.5 size-3.5" />
											Opening…
										</>
									) : (
										"View notarized"
									)}
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-8 text-xs"
									title={
										notarizedStoredInDb
											? "Download sealed copy from storage"
											: "Download sealed PDF from DocOnChain"
									}
									disabled={!notarizedPdfReady || notarizedPdfOpening}
									onClick={() => void handleDownloadNotarizedPdf()}
								>
									{notarizedPdfOpening ? (
										<>
											<Spinner className="mr-1.5 size-3.5" />
											Downloading…
										</>
									) : (
										"Download"
									)}
								</Button>
							</>
						)
					) : (
						<>
							<a
								href={originalHref}
								target="_blank"
								rel="noopener noreferrer"
								title="Original upload (requires sign-in)"
								className={cn(
									buttonVariants({ variant: "outline", size: "sm" }),
									"inline-flex h-8 text-xs"
								)}
							>
								View
							</a>
							<a
								href={originalHref}
								download={downloadName}
								title="Original upload (requires sign-in)"
								className={cn(
									buttonVariants({ variant: "outline", size: "sm" }),
									"inline-flex h-8 text-xs"
								)}
							>
								Download
							</a>
						</>
					)}
				</div>
				<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
					<AlertDialogContent size="sm">
						<AlertDialogHeader>
							<AlertDialogTitle>Delete document?</AlertDialogTitle>
							<AlertDialogDescription>
								Remove &quot;{docName}&quot; from this session. This cannot be undone. You can only
								delete documents that do not have signers assigned yet.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={isDeletingThis}>Cancel</AlertDialogCancel>
							<AlertDialogAction
								variant="destructive"
								disabled={isDeletingThis}
								onClick={() => void handleDeleteDocument()}
							>
								{isDeletingThis ? "Deleting…" : "Delete document"}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

				<Dialog open={feeDialogOpen} onOpenChange={setFeeDialogOpen}>
					<DialogContent className="max-w-sm">
						<DialogHeader>
							<DialogTitle>Notarization fee</DialogTitle>
							<DialogDescription>
								Set the fee for this instrument before creating the signing project. It is recorded
								for the notarial book.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-1.5">
							<Label htmlFor={`fee-php-${attachment.fileObjectId}`}>Fee (PHP)</Label>
							<Input
								id={`fee-php-${attachment.fileObjectId}`}
								type="number"
								min={1}
								step={1}
								inputMode="numeric"
								value={feeInput}
								onChange={e => {
									setFeeInput(e.target.value)
									setFeeInputError(null)
								}}
								placeholder="e.g. 500"
							/>
							{feeInputError ? (
								<p className="text-destructive text-xs" role="alert">
									{feeInputError}
								</p>
							) : null}
						</div>
						<DialogFooter className="gap-2 sm:gap-0">
							<Button
								type="button"
								variant="outline"
								onClick={() => setFeeDialogOpen(false)}
								disabled={isCreatingProjectThis}
							>
								Cancel
							</Button>
							<Button
								type="button"
								disabled={isCreatingProjectThis}
								onClick={() => void confirmFeeAndCreateProject()}
							>
								{isCreatingProjectThis ? "Creating…" : "Continue"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{hasDoconchainProject ? (
					<DocumentActions
						meetingId={meetingId}
						documentId={attachment.fileObjectId}
						participants={participants}
						participantsLoaded={participantsLoaded}
						isEnp={isEnp}
						enpUserId={enpUserId}
						currentUserId={currentUserId}
						currentUserEmail={currentUserEmail}
						signingComplete={signingComplete}
						onPlotSignature={documentSigning.goToPlotter}
						onSignClick={(_email, documentId) => {
							documentSigning.setSigningDocumentId(documentId)
						}}
						isLocallySigned={documentSigning.isLocallySigned}
						isSigningThisDocument={documentSigning.signingDocumentId === attachment.fileObjectId}
						isDocumentPlotted={isPlotted}
					/>
				) : null}
			</CardContent>
		</Card>
	)
}

function groupAttachmentsByBookedType(
	items: AppointmentAttachment[],
	bookedTypes: AppointmentBookedDocumentType[]
): {
	sections: { type: AppointmentBookedDocumentType; items: AppointmentAttachment[] }[]
	uncategorized: AppointmentAttachment[]
} {
	const byId = new Map<string, AppointmentAttachment[]>()
	for (const t of bookedTypes) {
		byId.set(t.id, [])
	}
	const uncategorized: AppointmentAttachment[] = []
	for (const item of items) {
		const typeId = item.enpDocumentTypeId
		if (typeId && byId.has(typeId)) {
			byId.get(typeId)!.push(item)
		} else {
			uncategorized.push(item)
		}
	}
	return {
		sections: bookedTypes.map(type => ({
			type,
			items: byId.get(type.id) ?? [],
		})),
		uncategorized,
	}
}

export function SessionDocumentsPanel({
	appointmentId,
	isEnp,
	isClient,
	isGuestParticipant = false,
	paymentStatus,
	documentSigning,
}: {
	appointmentId: string
	isEnp: boolean
	isClient: boolean
	isGuestParticipant?: boolean
	paymentStatus?: MeetingPaymentStatus
	documentSigning: ReturnType<typeof useDocumentSigning>
}) {
	const [uploadOpen, setUploadOpen] = React.useState(false)
	const [uploadTarget, setUploadTarget] = React.useState<AppointmentBookedDocumentType | undefined>(
		undefined
	)
	const aptQ = useAppointmentQuery(appointmentId)
	const appointment = aptQ.data as Appointment | undefined
	const q = useAppointmentAttachmentsQuery(appointmentId)
	const bookedTypesQ = useAppointmentBookedDocumentTypesQuery(appointmentId)
	const linkDoc = useLinkMeetingDocumentMutation(appointmentId)
	const principalUpload = usePrincipalMeetingDocumentUploadMutation(appointmentId)
	const createProject = useCreateMeetingDocumentProjectMutation(appointmentId)
	const profileQ = useAuthProfileMeQuery()
	const profile = profileQ.data as UserProfile | undefined
	const subOrgId = profile?.subOrgId ?? null
	const participantsQ = useMeetingSignerParticipantsQuery(appointmentId)
	const items = React.useMemo(() => {
		const raw = (q.data as AppointmentAttachment[] | undefined) ?? []
		return [...raw].sort((a, b) => new Date(b.linkedAt).getTime() - new Date(a.linkedAt).getTime())
	}, [q.data])
	const bookedTypes = (bookedTypesQ.data as AppointmentBookedDocumentType[] | undefined) ?? []
	const hasBookedSections = bookedTypes.length > 0
	const grouped = React.useMemo(
		() => groupAttachmentsByBookedType(items, bookedTypes),
		[items, bookedTypes]
	)
	const participants = React.useMemo((): SignerParticipant[] => {
		const raw = (participantsQ.data as MeetingSignerParticipant[] | undefined) ?? []
		return raw.map(p => ({
			userId: p.userId,
			displayName: p.displayName,
			email: p.email,
			role: p.role,
		}))
	}, [participantsQ.data])
	const enpUserId = React.useMemo(
		() => participants.find(p => p.role === "enp")?.userId,
		[participants]
	)
	const currentUserId = profile?.id
	const currentUserEmail = profile?.email
	const canUploadDocuments = isEnp || (isClient && !isGuestParticipant)
	const participantsLoaded = participantsQ.isSuccess
	const base = env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
	const uploadsLocked = isMeetingDocumentUploadLocked(paymentStatus)
	const notarizedPdfLocked = isMeetingNotarizedPdfLocked(paymentStatus, isEnp)

	React.useEffect(() => {
		if (uploadsLocked && uploadOpen) {
			setUploadOpen(false)
			setUploadTarget(undefined)
		}
	}, [uploadsLocked, uploadOpen])

	async function handleUpload(payload: {
		file: File
		documentName: string
		documentType: string
		enpDocumentTypeId?: string
		feePhp?: number
	}) {
		if (uploadsLocked) {
			toast.error("Session payment is complete. No further documents can be uploaded.")
			return
		}
		try {
			if (isEnp) {
				if (!subOrgId) {
					toast.error(
						"Your profile is missing an organization context. Complete ENP setup and try again."
					)
					return
				}
				if (payload.feePhp === null || payload.feePhp === undefined || payload.feePhp <= 0) {
					toast.error("Enter a notarization fee greater than zero (PHP).")
					return
				}
				const { fileObjectId } = await uploadAppointmentAttachmentFile({
					file: payload.file,
					subOrgId,
				})
				await linkDoc.mutateAsync({
					fileObjectId,
					documentName: payload.documentName,
					documentType: payload.documentType,
					enpDocumentTypeId: payload.enpDocumentTypeId,
					feePhp: payload.feePhp,
				})
			} else {
				await principalUpload.mutateAsync({
					file: payload.file,
					documentName: payload.documentName,
					documentType: payload.documentType,
					enpDocumentTypeId: payload.enpDocumentTypeId,
				})
			}
			toast.success(`"${payload.documentName}" uploaded`)
			setUploadOpen(false)
			setUploadTarget(undefined)
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not upload the document."))
		}
	}

	const isUploadSubmitting = isEnp ? linkDoc.isPending : principalUpload.isPending

	function renderInstrumentCards(sectionItems: AppointmentAttachment[], indexOffset = 0) {
		return sectionItems.map((att, idx) => (
			<DocumentInstrumentCard
				key={att.id}
				attachment={att}
				index={indexOffset + idx}
				apiBaseWithoutSlash={base}
				meetingId={appointmentId}
				participants={participants}
				participantsLoaded={participantsLoaded}
				isEnp={isEnp}
				enpUserId={enpUserId}
				currentUserId={currentUserId}
				currentUserEmail={currentUserEmail}
				documentSigning={documentSigning}
				createProject={createProject}
				notarizedPdfLocked={notarizedPdfLocked}
				isClientViewer={isClient}
			/>
		))
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-2 [scrollbar-gutter:stable]">
				<div className="space-y-2">
					<h3 className="text-sm font-semibold tracking-tight">Documents</h3>
					<p className="text-muted-foreground max-w-prose text-xs leading-relaxed">
						{uploadsLocked
							? "Session payment is complete. Document uploads are closed; you can continue signing and reviewing uploaded files."
							: isEnp
								? "Upload instruments for this live session. Everyone in the meeting can view them here."
								: isGuestParticipant
									? "Documents for this session appear here. Sign when the notary assigns you as a witness."
									: "Upload documents for this session. The ENP will create the signing project."}
					</p>
					{uploadsLocked ? (
						<p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs leading-relaxed text-emerald-800 dark:text-emerald-200">
							Payment received — uploads are locked for this session.
						</p>
					) : null}
					<details className="bg-muted/40 rounded-md border px-3 py-2">
						<summary className="cursor-pointer list-none text-xs font-medium">
							Signing flow (4 steps)
						</summary>
						<ol className="mt-2 space-y-1.5 pl-4 text-xs leading-relaxed">
							<li>
								<span className="font-medium">Upload document:</span> add the PDF for each booked
								document type section.
							</li>
							<li>
								<span className="font-medium">Add signers:</span> assign each signer to the document
								and verify the participant identity/email before proceeding.
							</li>
							<li>
								<span className="font-medium">Plot signatures:</span> place each signature/initial
								field on the right page and map it to the correct signer.
							</li>
							<li>
								<span className="font-medium">Sign and finalize:</span> complete signing in order,
								confirm all signers are done, then view/download the notarized PDF.
							</li>
						</ol>
					</details>
					{canUploadDocuments && !hasBookedSections && !uploadsLocked ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="w-full sm:w-auto"
							disabled={!appointment}
							onClick={() => {
								setUploadTarget(undefined)
								setUploadOpen(true)
							}}
						>
							+ Upload document
						</Button>
					) : null}
				</div>

				{bookedTypesQ.isError ? (
					<p className="text-destructive text-xs" role="alert">
						Could not load booked document types.
					</p>
				) : null}

				{q.isError ? (
					<p className="text-destructive text-xs leading-relaxed" role="alert">
						Could not load documents (
						{q.error instanceof Error ? q.error.message : "request failed"}
						).
					</p>
				) : null}
				{q.isLoading || bookedTypesQ.isLoading ? (
					<p className="text-muted-foreground text-xs">Loading documents…</p>
				) : null}

				{!q.isLoading && !bookedTypesQ.isLoading && items.length === 0 && !hasBookedSections ? (
					<Card className="shadow-sm">
						<CardContent className="text-muted-foreground px-3 py-6 text-xs leading-relaxed">
							{uploadsLocked
								? "No documents uploaded yet. Uploads are closed after payment."
								: isGuestParticipant
									? "No documents in this session yet. The notary will upload instruments for signing."
									: "No documents uploaded yet. Use Upload document to add one."}
						</CardContent>
					</Card>
				) : null}

				<div className="flex flex-col gap-6 pb-2">
					{hasBookedSections
						? grouped.sections.map(section => (
								<section key={section.type.id} className="space-y-3">
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div className="min-w-0">
											<h4 className="text-sm font-semibold">{section.type.name}</h4>
											<p className="text-muted-foreground text-xs">
												Booked at ₱{section.type.pricePhpSnapshot.toLocaleString()} — upload the
												PDF(s) for this type.
											</p>
										</div>
										{canUploadDocuments && !uploadsLocked ? (
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="shrink-0"
												disabled={!appointment}
												onClick={() => {
													setUploadTarget(section.type)
													setUploadOpen(true)
												}}
											>
												+ Upload
											</Button>
										) : null}
									</div>
									{section.items.length === 0 ? (
										<p className="text-muted-foreground border-border rounded-md border border-dashed px-3 py-4 text-xs">
											No files uploaded for this type yet.
										</p>
									) : (
										<div className="flex flex-col gap-4">
											{renderInstrumentCards(section.items)}
										</div>
									)}
								</section>
							))
						: renderInstrumentCards(items)}

					{grouped.uncategorized.length > 0 ? (
						<section className="space-y-3">
							{hasBookedSections ? (
								<div>
									<h4 className="text-sm font-semibold">Other documents</h4>
									<p className="text-muted-foreground text-xs">
										Uploaded before document types were assigned to sections.
									</p>
								</div>
							) : null}
							<div className="flex flex-col gap-4">
								{renderInstrumentCards(grouped.uncategorized)}
							</div>
						</section>
					) : null}
				</div>
			</div>

			{!q.isLoading && items.length > 0 ? (
				<div className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/85 z-10 shrink-0 border-t pt-2 shadow-[0_-6px_16px_-6px_rgba(0,0,0,0.25)] backdrop-blur-sm">
					<MeetingDocumentsPosTotal
						appointmentId={appointmentId}
						appointmentTitle={appointment?.title}
						items={items}
						isEnp={isEnp}
						isClient={isClient}
						paymentStatus={paymentStatus}
						stickyFooter
					/>
				</div>
			) : null}

			{appointment && !uploadsLocked ? (
				<UploadDocumentModal
					open={uploadOpen}
					onOpenChange={open => {
						setUploadOpen(open)
						if (!open) setUploadTarget(undefined)
					}}
					isSubmitting={isUploadSubmitting}
					isEnp={isEnp}
					bookedDocumentType={uploadTarget}
					defaultFeePhp={uploadTarget?.pricePhpSnapshot}
					notarizationType={appointment.notarizationType}
					onSubmit={handleUpload}
				/>
			) : null}
		</div>
	)
}
