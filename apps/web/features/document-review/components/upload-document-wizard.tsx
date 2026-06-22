"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { NotaryDirectoryEntry, UserProfile } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { cn } from "@/core/lib/utils"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import { useEnpDocumentTypesForEnpQuery } from "@/features/enp-document-types/api/enp-document-types.hooks"
import { EnpDocumentTypeMultiSelect } from "@/features/enp-document-types/components/enp-document-type-multi-select"
import { ProfileKycRequiredCard } from "@/features/kyc/components/profile-kyc-required-card"
import { isProfileKycVerified } from "@/features/kyc/lib/profile-kyc-gate"

import { useCreateDocumentReviewRequestMutation } from "../api/document-review.hooks"
import { formatBytes, formatSlotIso, notarizationLabel, sessionModeLabel } from "../lib/constants"
import { DetailsStep, type DetailsFormValue } from "./details-step"
import { DocumentsUploadStep, type UploadedDocument } from "./documents-upload-step"
import { NotaryPickerStep } from "./notary-picker-step"

type StepKey = "notary" | "types" | "documents" | "details" | "review"

const STEPS: { key: StepKey; label: string; description: string }[] = [
	{ key: "notary", label: "Notary", description: "Pick who will review your document" },
	{ key: "types", label: "Types", description: "Select the document type(s) for pricing" },
	{ key: "documents", label: "Documents", description: "Upload the file(s) to be reviewed" },
	{ key: "details", label: "Details", description: "Title, notes, and preferred times" },
	{ key: "review", label: "Review", description: "Confirm and send the request" },
]

function emptyDetails(): DetailsFormValue {
	return {
		title: "",
		note: "",
		notarizationType: "",
		sessionMode: "remote",
		slots: [],
	}
}

function slotToIso(slot: { date: string; time: string }): string | null {
	if (!slot.date || !slot.time) return null
	const iso = new Date(`${slot.date}T${slot.time}:00`).toISOString()
	if (iso === "Invalid Date") return null
	return iso
}

function mutationErrorMessage(error: unknown): string {
	if (!error || typeof error !== "object") return "Could not send your request. Try again."
	const maybeMessage = (error as { message?: unknown }).message
	if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage
	const shape = error as { data?: { message?: unknown } }
	if (typeof shape.data?.message === "string" && shape.data.message.trim())
		return shape.data.message
	return "Could not send your request. Try again."
}

export function UploadDocumentWizard() {
	const router = useRouter()
	const profileQ = useAuthProfileMeQuery()
	const profile = profileQ.data as UserProfile | undefined
	const kycVerified = isProfileKycVerified(profile?.identityStatus)

	const [stepIndex, setStepIndex] = React.useState(0)
	const [notary, setNotary] = React.useState<NotaryDirectoryEntry | null>(null)
	const [documentTypeIds, setDocumentTypeIds] = React.useState<string[]>([])
	const [documents, setDocuments] = React.useState<UploadedDocument[]>([])
	const [details, setDetails] = React.useState<DetailsFormValue>(emptyDetails)

	const createMutation = useCreateDocumentReviewRequestMutation()
	const docTypesQ = useEnpDocumentTypesForEnpQuery(notary?.id ?? null)

	const currentStep = STEPS[stepIndex]!

	const canAdvanceFrom: Record<StepKey, boolean> = {
		notary: Boolean(notary),
		types: documentTypeIds.length > 0,
		documents: documents.length > 0,
		details: details.title.trim().length > 0 && details.sessionMode.length > 0,
		review: true,
	}

	function next() {
		if (!canAdvanceFrom[currentStep.key]) return
		setStepIndex(i => Math.min(i + 1, STEPS.length - 1))
	}
	function back() {
		setStepIndex(i => Math.max(i - 1, 0))
	}

	async function submit() {
		if (!notary) return
		const slotIsos = details.slots.map(slotToIso).filter((v): v is string => Boolean(v))

		try {
			await createMutation.mutateAsync({
				enpId: notary.id,
				title: details.title.trim(),
				note: details.note.trim() || undefined,
				notarizationType: details.notarizationType || undefined,
				sessionMode: details.sessionMode,
				documentTypeIds,
				fileObjectIds: documents.map(d => d.fileObjectId),
				proposedSlots: slotIsos,
			})
			toast.success("Your document was sent for review")
			router.push("/document-reviews")
		} catch (e) {
			toast.error(mutationErrorMessage(e))
		}
	}

	if (profileQ.isLoading) {
		return <p className="text-muted-foreground text-sm">Loading your profile…</p>
	}

	if (profile && !kycVerified) {
		return <ProfileKycRequiredCard profile={profile} context="booking" />
	}

	return (
		<div className="space-y-6">
			<StepIndicator activeIndex={stepIndex} />

			<Card>
				<CardHeader>
					<CardTitle className="text-sm">{currentStep.description}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{currentStep.key === "notary" && (
						<NotaryPickerStep
							selectedId={notary?.id ?? null}
							onSelect={n => {
								setNotary(n)
								setDocumentTypeIds([])
							}}
						/>
					)}
					{currentStep.key === "types" && (
						<div className="space-y-3">
							<div>
								<p className="text-sm font-medium">Document type(s)</p>
								<p className="text-muted-foreground text-sm">
									Choose one or more types provided by the notary. This controls pricing.
								</p>
							</div>

							<EnpDocumentTypeMultiSelect
								types={docTypesQ.data}
								isLoading={docTypesQ.isLoading}
								isError={docTypesQ.isError}
								emptyMessage="This notary is not accepting requests yet."
								selectedIds={documentTypeIds}
								onSelectedIdsChange={setDocumentTypeIds}
							/>
						</div>
					)}
					{currentStep.key === "documents" && (
						<DocumentsUploadStep
							notaryId={notary?.id ?? null}
							uploaded={documents}
							onChange={setDocuments}
						/>
					)}
					{currentStep.key === "details" && <DetailsStep value={details} onChange={setDetails} />}
					{currentStep.key === "review" && notary && (
						<ReviewSummary notary={notary} documents={documents} details={details} />
					)}
				</CardContent>
			</Card>

			<div className="flex items-center justify-between">
				<Button
					type="button"
					variant="outline"
					onClick={back}
					disabled={stepIndex === 0 || createMutation.isPending}
				>
					Back
				</Button>
				{currentStep.key !== "review" ? (
					<Button type="button" onClick={next} disabled={!canAdvanceFrom[currentStep.key]}>
						Continue
					</Button>
				) : (
					<Button type="button" onClick={() => void submit()} disabled={createMutation.isPending}>
						{createMutation.isPending ? "Sending…" : "Send for Review"}
					</Button>
				)}
			</div>
		</div>
	)
}

function StepIndicator({ activeIndex }: { activeIndex: number }) {
	return (
		<ol className="flex items-center gap-2 sm:gap-3">
			{STEPS.map((s, i) => {
				const isActive = i === activeIndex
				const isComplete = i < activeIndex
				return (
					<li key={s.key} className="flex flex-1 items-center gap-2">
						<div
							className={cn(
								"flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
								isActive && "bg-primary text-primary-foreground",
								isComplete && "bg-primary/20 text-primary",
								!isActive && !isComplete && "bg-muted text-muted-foreground"
							)}
						>
							{i + 1}
						</div>
						<div className="hidden min-w-0 flex-1 sm:block">
							<p
								className={cn(
									"truncate text-xs font-medium",
									isActive ? "text-foreground" : "text-muted-foreground"
								)}
							>
								{s.label}
							</p>
						</div>
						{i < STEPS.length - 1 && (
							<div className={cn("h-px flex-1", isComplete ? "bg-primary/40" : "bg-border")} />
						)}
					</li>
				)
			})}
		</ol>
	)
}

function ReviewSummary({
	notary,
	documents,
	details,
}: {
	notary: NotaryDirectoryEntry
	documents: UploadedDocument[]
	details: DetailsFormValue
}) {
	const slots = details.slots.map(s => slotToIso(s)).filter((v): v is string => Boolean(v))

	return (
		<div className="space-y-4 text-sm">
			<section>
				<p className="text-muted-foreground text-xs tracking-wide uppercase">Notary</p>
				<p className="mt-1 font-medium">
					{notary.firstName} {notary.lastName}
				</p>
				<p className="text-muted-foreground text-xs">
					{notary.city}
					{notary.province ? `, ${notary.province}` : ""} · ₱{notary.baseFee.toLocaleString()}
				</p>
			</section>

			<section>
				<p className="text-muted-foreground text-xs tracking-wide uppercase">Documents</p>
				<ul className="mt-1 space-y-1">
					{documents.map(d => (
						<li key={d.fileObjectId} className="flex justify-between gap-3">
							<span className="truncate">{d.displayName}</span>
							<span className="text-muted-foreground text-xs">{formatBytes(d.sizeBytes)}</span>
						</li>
					))}
				</ul>
			</section>

			<section className="grid gap-3 sm:grid-cols-2">
				<div>
					<p className="text-muted-foreground text-xs tracking-wide uppercase">Title</p>
					<p className="mt-1 font-medium">{details.title || "—"}</p>
				</div>
				<div>
					<p className="text-muted-foreground text-xs tracking-wide uppercase">Session Mode</p>
					<p className="mt-1 font-medium">{sessionModeLabel(details.sessionMode)}</p>
				</div>
				<div>
					<p className="text-muted-foreground text-xs tracking-wide uppercase">Notarization</p>
					<p className="mt-1 font-medium">
						{details.notarizationType
							? notarizationLabel(details.notarizationType)
							: "Let notary decide"}
					</p>
				</div>
				<div>
					<p className="text-muted-foreground text-xs tracking-wide uppercase">Preferred Times</p>
					<div className="mt-1 flex flex-wrap gap-1.5">
						{slots.length === 0 ? (
							<span className="text-muted-foreground text-xs">No preference</span>
						) : (
							slots.map(s => (
								<Badge key={s} variant="secondary" className="text-[10px]">
									{formatSlotIso(s)}
								</Badge>
							))
						)}
					</div>
				</div>
			</section>

			{details.note && (
				<section>
					<p className="text-muted-foreground text-xs tracking-wide uppercase">Notes</p>
					<p className="mt-1 text-sm whitespace-pre-wrap">{details.note}</p>
				</section>
			)}
		</div>
	)
}
