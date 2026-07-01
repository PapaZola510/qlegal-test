"use client"

import * as React from "react"
import type { Route } from "next"
import { CheckmarkCircle02Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
	notarialAttestationTextFor,
	type DocumentReviewQuicksignQueue,
	type ListIenAttestationsResponse,
	type ListMeetingDocumentSignersResult,
	type QuicksignProject,
} from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/core/components/ui/select"
import { Spinner } from "@/core/components/ui/spinner"
import { Textarea } from "@/core/components/ui/textarea"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import {
	useListQuicksignIenAttestationsQuery,
	useRecordQuicksignIenAttestationMutation,
} from "@/features/appointments/api/ien-attestation.hooks"
import { useListMeetingDocumentSignersQuery } from "@/features/appointments/api/meeting.hooks"
import { IenAttestationPrompt } from "@/features/appointments/components/ien-attestation-prompt"
import { useQuicksignProjectQuery } from "@/features/quicksign/api/quicksign.hooks"

import {
	NOTARIZATION_TYPE_OPTIONS,
	type MeetingPayload,
	type NotarizationType,
} from "../lib/fixtures"
import { QuicksignNotarizedPdfActions } from "./quicksign-notarized-pdf-actions"

interface PrincipalSignerStatus {
	email: string
	name: string
	hasSigned: boolean
	signedAt: string | null
}

interface StepCreateMeetingProps {
	meeting: MeetingPayload
	isLoading: boolean
	error: string | null
	meetingCreated: boolean
	clientJoinLink: string
	enpJoinLink: string
	signDocumentUrl: string
	enpSignDocumentUrl: string
	principalSignerStatus: PrincipalSignerStatus | null
	quicksignProjectId: string | null
	appointmentId: string | null
	documentFileId: string | null
	documentTitle: string
	signingComplete: boolean
	registrySynced: boolean
	signerEmail: string
	projectRef: string
	onUpdate: (m: Partial<MeetingPayload>) => void
	onSubmit: () => void
	onStartAnother: () => void
	onBack: () => void
	ienFromReview?: boolean
	reviewQueue?: DocumentReviewQuicksignQueue | null
	onContinueReviewQueue?: () => void
	isAdvancingReview?: boolean
	notarizationType?: NotarizationType
	onNotarizationTypeChange?: (notarizationType: NotarizationType) => void
}

function formatSignedAt(iso: string | null): string | null {
	if (!iso) return null
	try {
		return new Date(iso).toLocaleString(undefined, {
			dateStyle: "medium",
			timeStyle: "short",
		})
	} catch {
		return null
	}
}

export function StepCreateMeeting({
	meeting,
	isLoading,
	error,
	meetingCreated,
	clientJoinLink,
	enpJoinLink,
	signDocumentUrl,
	enpSignDocumentUrl,
	principalSignerStatus,
	quicksignProjectId,
	appointmentId,
	documentFileId,
	documentTitle,
	signingComplete: signingCompleteInitial,
	registrySynced: registrySyncedInitial,
	signerEmail,
	projectRef,
	onUpdate,
	onSubmit,
	onStartAnother,
	onBack,
	ienFromReview = false,
	reviewQueue = null,
	onContinueReviewQueue,
	isAdvancingReview = false,
	notarizationType = "acknowledgment",
	onNotarizationTypeChange,
}: StepCreateMeetingProps) {
	const [copied, setCopied] = React.useState<"client" | "sign" | null>(null)
	const [enpAcknowledged, setEnpAcknowledged] = React.useState(false)
	const [attestError, setAttestError] = React.useState<string | null>(null)

	const ienAttestationsQ = useListQuicksignIenAttestationsQuery(quicksignProjectId, {
		enabled: ienFromReview && Boolean(quicksignProjectId) && !meetingCreated,
	})
	const recordEnpAttestation = useRecordQuicksignIenAttestationMutation()
	const enpAlreadyAttested = React.useMemo(() => {
		const rows =
			(ienAttestationsQ.data as ListIenAttestationsResponse | undefined)?.attestations ?? []
		return rows.some(a => a.role === "enp")
	}, [ienAttestationsQ.data])
	const enpAttestationReady = !ienFromReview || enpAlreadyAttested || enpAcknowledged

	const enpAttestationText = React.useMemo(
		() =>
			notarialAttestationTextFor({
				notarizationType,
				sessionMode: "in_person",
				role: "enp",
			}) ?? "",
		[notarizationType]
	)

	async function handleSendForSigning() {
		if (!enpAttestationReady) return
		setAttestError(null)
		if (ienFromReview && quicksignProjectId && !enpAlreadyAttested) {
			try {
				await recordEnpAttestation.mutateAsync({
					id: quicksignProjectId,
					role: "enp",
					acknowledged: true,
					notarizationType,
				})
			} catch (e) {
				setAttestError(getOrpcMutationErrorMessage(e))
				return
			}
		}
		onSubmit()
	}

	const projectQuery = useQuicksignProjectQuery(quicksignProjectId, {
		enabled: meetingCreated && Boolean(quicksignProjectId),
	})

	const meetingSignersQ = useListMeetingDocumentSignersQuery(
		meetingCreated ? (appointmentId ?? undefined) : undefined,
		meetingCreated ? (documentFileId ?? undefined) : undefined,
		{ pollWhileSigning: true }
	)
	const project = projectQuery.data as QuicksignProject | undefined
	const meetingSigners = meetingSignersQ.data as ListMeetingDocumentSignersResult | undefined

	const allSignersSigned =
		meetingSigners?.completed === true ||
		(meetingSigners !== undefined &&
			meetingSigners.totalCount > 0 &&
			meetingSigners.signedCount === meetingSigners.totalCount)
	const signingComplete = allSignersSigned || (project?.signingComplete ?? signingCompleteInitial)
	const registrySynced = project?.registrySynced ?? registrySyncedInitial

	const enpSignerRow = meetingSigners?.signers.find(s => s.role === "notary")
	const enpHasSigned = enpSignerRow?.status === "signed"

	const principalFromPoll = React.useMemo(() => {
		const signatories = project?.signatories
		if (!signatories?.length) return null
		const primary =
			signatories.find(s => s.email.trim().toLowerCase() === signerEmail.trim().toLowerCase()) ??
			signatories[0]
		if (!primary) return null
		return {
			email: primary.email,
			name: primary.name,
			hasSigned: primary.signedAt !== null,
			signedAt: primary.signedAt,
		} satisfies PrincipalSignerStatus
	}, [project?.signatories, signerEmail])

	const principalStatus = principalFromPoll ?? principalSignerStatus
	const principalHasSigned = principalStatus?.hasSigned ?? false
	const principalLabel = principalStatus?.name || signerEmail || "Principal"

	function handleCopy(value: string, kind: "client" | "sign") {
		navigator.clipboard.writeText(value).then(() => {
			setCopied(kind)
			setTimeout(() => setCopied(null), 2000)
		})
	}

	if (meetingCreated) {
		return (
			<Card className="mx-auto max-w-lg">
				<CardHeader className="text-center">
					<div className="text-primary mx-auto mb-2 text-4xl">✓</div>
					<CardTitle>Meeting Created</CardTitle>
					<CardDescription>
						Project <strong>{projectRef}</strong> is ready. An invite was sent to{" "}
						<strong>{signerEmail || "the signer"}</strong>.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div
						className="flex items-start gap-3 rounded-lg border p-3"
						role="status"
						aria-live="polite"
					>
						{principalHasSigned ? (
							<HugeiconsIcon
								icon={CheckmarkCircle02Icon}
								strokeWidth={2}
								className="text-primary mt-0.5 size-5 shrink-0"
								aria-hidden
							/>
						) : (
							<HugeiconsIcon
								icon={Loading03Icon}
								strokeWidth={2}
								className="text-muted-foreground mt-0.5 size-5 shrink-0"
								aria-hidden
							/>
						)}
						<div className="min-w-0 space-y-1">
							<p className="text-sm font-medium">Principal signing</p>
							<p className="text-muted-foreground text-xs leading-relaxed">
								{principalHasSigned ? (
									<>
										<strong className="text-foreground">{principalLabel}</strong> has signed.
										{formatSignedAt(principalStatus?.signedAt ?? null)
											? ` (${formatSignedAt(principalStatus?.signedAt ?? null)})`
											: null}{" "}
										You can open your notary signing link below.
									</>
								) : (
									<>
										Waiting for <strong className="text-foreground">{principalLabel}</strong> to
										sign first. The invite email includes their signing link — your notary link
										unlocks after they complete signing.
									</>
								)}
							</p>
							{projectQuery.isFetching ? (
								<p className="text-muted-foreground text-[11px]">Checking status…</p>
							) : null}
						</div>
					</div>

					{signingComplete && appointmentId && documentFileId ? (
						<div
							className="flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/5 p-3"
							role="status"
						>
							<HugeiconsIcon
								icon={CheckmarkCircle02Icon}
								strokeWidth={2}
								className="mt-0.5 size-5 shrink-0 text-green-600 dark:text-green-500"
								aria-hidden
							/>
							<div className="min-w-0 flex-1 space-y-2">
								<div className="space-y-1">
									<p className="text-sm font-medium text-green-700 dark:text-green-400">
										Document fully signed
									</p>
									<p className="text-muted-foreground text-xs leading-relaxed">
										All required signatures are complete.
										{registrySynced
											? " This act has been added to your notarial registry."
											: " Registry entry will appear once finalizes the project."}
									</p>
								</div>
								<QuicksignNotarizedPdfActions
									appointmentId={appointmentId}
									documentFileId={documentFileId}
									documentTitle={documentTitle}
									registrySynced={registrySynced}
									canAccessNotarized={allSignersSigned}
								/>
							</div>
						</div>
					) : principalHasSigned ? (
						<div className="flex items-start gap-3 rounded-lg border p-3" role="status">
							<HugeiconsIcon
								icon={enpHasSigned ? CheckmarkCircle02Icon : Loading03Icon}
								strokeWidth={2}
								className={
									enpHasSigned
										? "text-primary mt-0.5 size-5 shrink-0"
										: "text-muted-foreground mt-0.5 size-5 shrink-0"
								}
								aria-hidden
							/>
							<div className="min-w-0 space-y-1">
								<p className="text-sm font-medium">Notary signing</p>
								<p className="text-muted-foreground text-xs leading-relaxed">
									{enpHasSigned
										? "Your notary signature is recorded. Waiting for to seal the document…"
										: "Complete your notary signature using the button below."}
								</p>
							</div>
						</div>
					) : null}

					{!ienFromReview ? (
						<div className="space-y-1.5">
							<Label className="text-xs">Signer join link (hybrid session lobby)</Label>
							<div className="flex gap-2">
								<Input readOnly value={clientJoinLink} className="text-xs" />
								<Button
									size="sm"
									variant="outline"
									onClick={() => handleCopy(clientJoinLink, "client")}
								>
									{copied === "client" ? "Copied!" : "Copy"}
								</Button>
							</div>
						</div>
					) : null}

					{enpSignDocumentUrl && !signingComplete ? (
						<Button
							className="w-full"
							variant="secondary"
							disabled={!principalHasSigned || enpHasSigned}
							title={
								enpHasSigned
									? "You have already signed as notary"
									: principalHasSigned
										? "Open your notary signing session "
										: "Available after the principal finishes signing"
							}
							onClick={() => window.open(enpSignDocumentUrl, "_blank", "noopener,noreferrer")}
						>
							Sign document now (ENP)
						</Button>
					) : null}

					{signDocumentUrl && !signingComplete ? (
						<div className="space-y-1.5">
							<Label className="text-xs">Principal signing link (for your records)</Label>
							<div className="flex gap-2">
								<Input readOnly value={signDocumentUrl} className="text-xs" />
								<Button
									size="sm"
									variant="outline"
									onClick={() => handleCopy(signDocumentUrl, "sign")}
								>
									{copied === "sign" ? "Copied!" : "Copy"}
								</Button>
							</div>
						</div>
					) : null}

					{signingComplete && reviewQueue?.hasMore && onContinueReviewQueue ? (
						<Button className="w-full" onClick={onContinueReviewQueue} disabled={isAdvancingReview}>
							{isAdvancingReview
								? "Loading next document…"
								: `Continue to document ${reviewQueue.currentIndex + 1} of ${reviewQueue.totalDocuments}`}
						</Button>
					) : null}

					{!ienFromReview ? (
						<div className="flex flex-col gap-2 sm:flex-row">
							<Button
								variant="outline"
								className="flex-1"
								onClick={() => {
									window.location.href = enpJoinLink || ("/appointments" as Route)
								}}
							>
								Join session (ENP)
							</Button>
							<Button
								className="flex-1"
								onClick={() => {
									window.location.href = "/appointments" as Route
								}}
							>
								Open appointments
							</Button>
						</div>
					) : null}

					<Button variant="ghost" className="w-full" onClick={onStartAnother}>
						{reviewQueue ? "Exit review queue" : "Start another QuickSign"}
					</Button>

					<Badge variant="secondary" className="w-fit text-xs">
						{ienFromReview
							? "In-person e-sign (no video meeting)"
							: meeting.date && meeting.time
								? `Scheduled: ${meeting.date} at ${meeting.time}`
								: "Available now — hybrid session"}
					</Badge>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card className="mx-auto max-w-lg">
			<CardHeader>
				<CardTitle>{ienFromReview ? "Send for signing" : "Create Meeting"}</CardTitle>
				<CardDescription>
					{ienFromReview
						? `Send signing links for project ${projectRef}. The principal (${signerEmail || "—"}) signs in person — no video meeting.`
						: `Schedule a hybrid session for project ${projectRef}. The signer (${signerEmail || "—"}) will receive an email with links to join and sign.`}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label htmlFor="qs-meeting-date">Date (optional)</Label>
						<Input
							id="qs-meeting-date"
							type="date"
							value={meeting.date}
							onChange={e => onUpdate({ date: e.target.value })}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="qs-meeting-time">Time (optional)</Label>
						<Input
							id="qs-meeting-time"
							type="time"
							value={meeting.time}
							onChange={e => onUpdate({ time: e.target.value })}
						/>
					</div>
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="qs-notarization-type">Notarization Type</Label>
					<Select
						value={notarizationType}
						onValueChange={value => onNotarizationTypeChange?.(value as NotarizationType)}
					>
						<SelectTrigger id="qs-notarization-type" className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{NOTARIZATION_TYPE_OPTIONS.map(option => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-1.5">
					<Label htmlFor="qs-meeting-notes">Notes (optional)</Label>
					<Textarea
						id="qs-meeting-notes"
						placeholder="Any special instructions for the signer…"
						value={meeting.notes}
						onChange={e => onUpdate({ notes: e.target.value })}
						rows={3}
					/>
				</div>

				<p className="text-muted-foreground text-xs leading-relaxed">
					The principal signs first, then you complete notary signing. The signer must already have
					a client account using the same email you added in the previous step. Leave date and time
					empty to start the session immediately.
				</p>

				{ienFromReview && !enpAlreadyAttested ? (
					<IenAttestationPrompt
						role="enp"
						attestationText={enpAttestationText}
						documentTitle={documentTitle}
						acknowledged={enpAcknowledged}
						onAcknowledgedChange={setEnpAcknowledged}
						disabled={isLoading || recordEnpAttestation.isPending}
					/>
				) : null}

				{attestError ? (
					<p className="text-destructive text-sm" role="alert">
						{attestError}
					</p>
				) : null}

				{error ? (
					<p className="text-destructive text-sm" role="alert">
						{error}
					</p>
				) : null}

				<div className="flex items-center justify-between gap-2">
					<Button variant="outline" onClick={onBack} disabled={isLoading}>
						Back
					</Button>
					<Button
						onClick={() => void handleSendForSigning()}
						disabled={
							isLoading || recordEnpAttestation.isPending || !signerEmail || !enpAttestationReady
						}
					>
						{(isLoading || recordEnpAttestation.isPending) && <Spinner className="mr-2" />}
						{ienFromReview ? "Send signing links" : "Create Meeting"}
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
