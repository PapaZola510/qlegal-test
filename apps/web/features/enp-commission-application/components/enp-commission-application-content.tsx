"use client"

import * as React from "react"
import type { Route } from "next"
import Link from "next/link"
import { JusticeScaleFreeIcons } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import type { UserProfile } from "@repo/contracts"

import { Button, buttonVariants } from "@/core/components/ui/button"
import { Card, CardContent } from "@/core/components/ui/card"
import { Checkbox } from "@/core/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/core/components/ui/field"
import { Input } from "@/core/components/ui/input"
import { Separator } from "@/core/components/ui/separator"
import { Textarea } from "@/core/components/ui/textarea"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/core/components/ui/tooltip"
import { cn } from "@/core/lib/utils"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import {
	useMyEnpCommissionApplicationsQuery,
	useSubmitEnpCommissionApplicationMutation,
} from "@/features/enp-commission-application/api/enp-commission-application.hooks"
import { CommissionSummaryHearingNotice } from "@/features/enp-commission-application/components/commission-summary-hearing-notice"
import {
	buildQualificationsStatement,
	type CommissionQualificationsExtras,
} from "@/features/enp-commission-application/lib/build-qualifications-statement"
import { uploadEnpCommissionApplicationFile } from "@/features/enp-commission-application/lib/upload-enp-commission-file"

const COMMISSION_REQUIREMENTS = [
	"Personal qualifications statement",
	"Good moral character (OBC & IBP)",
	"Passport-size photograph",
	"Proof of filing fee payment",
	"Undertaking — Rules compliance",
	"Undertaking — Data sharing guidelines",
	"ENF instructional video certification",
] as const

type DocumentSlotId = "good_moral" | "passport_photo" | "filing_fee" | "enf_video_certification"

const DOCUMENT_SLOTS: Array<{
	id: DocumentSlotId
	label: string
	hint: string
	accept: string
}> = [
	{
		id: "good_moral",
		label: "Good moral character (OBC & IBP)",
		hint: "Electronic or scanned copy from the OBC and IBP.",
		accept: "application/pdf,image/*",
	},
	{
		id: "passport_photo",
		label: "Passport-size photograph",
		hint: "Colored, light background, taken within 30 days.",
		accept: "image/*",
	},
	{
		id: "filing_fee",
		label: "Proof of payment",
		hint: "Filing fee payment as required by the Rules.",
		accept: "application/pdf,image/*",
	},
	{
		id: "enf_video_certification",
		label: "ENF video certification",
		hint: "Certification that you viewed the ENF instructional video.",
		accept: "application/pdf,image/*",
	},
]

function SectionHeading({ title, description }: { title: string; description?: string }) {
	return (
		<div className="space-y-1">
			<h2 className="text-sm font-semibold tracking-tight">{title}</h2>
			{description ? (
				<p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
			) : null}
		</div>
	)
}

function DocumentUploadRow({
	label,
	hint,
	accept,
	file,
	onChange,
	disabled,
}: {
	label: string
	hint: string
	accept: string
	file: File | null
	onChange: (file: File | null) => void
	disabled?: boolean
}) {
	const inputRef = React.useRef<HTMLInputElement>(null)
	return (
		<div className="border-border/60 grid gap-3 border-b py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
			<div className="min-w-0">
				<p className="text-sm font-medium">{label}</p>
				<p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{hint}</p>
			</div>
			<div className="flex min-w-0 items-center gap-2 sm:max-w-xs sm:justify-end">
				<input
					ref={inputRef}
					type="file"
					accept={accept}
					disabled={disabled}
					className="sr-only"
					onChange={e => onChange(e.target.files?.[0] ?? null)}
				/>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={disabled}
					className="shrink-0"
					onClick={() => inputRef.current?.click()}
				>
					Choose file
				</Button>
				<span className="text-muted-foreground min-w-0 truncate text-xs">
					{file?.name ?? "No file chosen"}
				</span>
			</div>
		</div>
	)
}

export function EnpCommissionApplicationContent({
	initialProfile,
}: {
	initialProfile: UserProfile | null
}) {
	const profileQ = useAuthProfileMeQuery(initialProfile)
	const profile = profileQ.data as UserProfile | undefined
	const myApplicationsQ = useMyEnpCommissionApplicationsQuery()
	const submitMutation = useSubmitEnpCommissionApplicationMutation()

	const [citizenship, setCitizenship] = React.useState("Filipino")
	const [ulasComplianceNumber, setUlasComplianceNumber] = React.useState("")
	const [statement, setStatement] = React.useState("")
	const [documents, setDocuments] = React.useState<Record<DocumentSlotId, File | null>>({
		good_moral: null,
		passport_photo: null,
		filing_fee: null,
		enf_video_certification: null,
	})
	const [undertakingRules, setUndertakingRules] = React.useState(false)
	const [undertakingDataSharing, setUndertakingDataSharing] = React.useState(false)
	const latestSubmission = myApplicationsQ.data?.[0] ?? null
	const submittedAt = latestSubmission?.submittedAt ?? null
	const submitting = submitMutation.isPending

	React.useEffect(() => {
		if (!profile) return
		const extras: CommissionQualificationsExtras = {
			citizenship,
			ulasComplianceNumber,
		}
		setStatement(buildQualificationsStatement(profile, extras))
	}, [profile, citizenship, ulasComplianceNumber])

	if (profileQ.isPending || myApplicationsQ.isPending) {
		return <p className="text-muted-foreground text-sm">Loading your profile…</p>
	}

	if (!profile || profile.role !== "enp") {
		return (
			<Card>
				<CardContent className="py-10 text-center">
					<p className="text-muted-foreground text-sm">
						This application is available to Electronic Notary Public (ENP) accounts only.
					</p>
					<Link href={"/dashboard" as Route} className={buttonVariants({ className: "mt-4" })}>
						Back to dashboard
					</Link>
				</CardContent>
			</Card>
		)
	}

	if (profile.certificateStatus !== "active") {
		return (
			<Card>
				<CardContent className="space-y-4 py-10 text-center">
					<p className="text-muted-foreground text-sm leading-relaxed">
						Complete ENP certification before applying for an electronic notarial commission.
					</p>
					<Link href={"/dashboard" as Route} className={buttonVariants({ variant: "outline" })}>
						Return to dashboard
					</Link>
				</CardContent>
			</Card>
		)
	}

	const enpProfile = profile

	const missingProfileFields = [
		!enpProfile.rollNumber?.trim() && "Roll of Attorneys number",
		!enpProfile.ptrNumber?.trim() && "PTR number",
		!enpProfile.ibpNumber?.trim() && "IBP membership number",
		!enpProfile.mcleNumber?.trim() && "MCLE compliance number",
		!enpProfile.phone?.trim() && "phone number",
		!enpProfile.residentialAddress?.trim() && "residential address",
		!enpProfile.officeAddress?.trim() && "office address",
	].filter(Boolean) as string[]

	const missingDocumentLabels = DOCUMENT_SLOTS.filter(slot => !documents[slot.id]).map(
		slot => slot.label
	)

	const submissionBlockers = [
		!citizenship.trim() && "Citizenship",
		!statement.trim() && "Qualifications statement",
		!enpProfile.subOrgId && "ENP organization assignment",
		...missingProfileFields.map(field => `Profile: ${field}`),
		...missingDocumentLabels.map(label => `Document: ${label}`),
		!undertakingRules && "Undertaking: Rules compliance",
		!undertakingDataSharing && "Undertaking: Data sharing guidelines",
	].filter(Boolean) as string[]

	const hasSubmissionBlockers = submissionBlockers.length > 0
	const canSubmit = !submitting && !hasSubmissionBlockers

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault()
		if (hasSubmissionBlockers) {
			toast.error("Complete the missing application requirements before submitting.")
			return
		}
		const subOrgId = enpProfile.subOrgId
		if (!subOrgId) {
			toast.error("Complete your ENP profile before submitting.")
			return
		}

		try {
			const uploads = {} as Record<DocumentSlotId, string>
			for (const slot of DOCUMENT_SLOTS) {
				const file = documents[slot.id]
				if (!file) continue
				const { fileObjectId } = await uploadEnpCommissionApplicationFile({
					file,
					subOrgId,
				})
				uploads[slot.id] = fileObjectId
			}

			await submitMutation.mutateAsync({
				citizenship: citizenship.trim(),
				ulasComplianceNumber: ulasComplianceNumber.trim() || undefined,
				qualificationsStatement: statement.trim(),
				undertakingRules: true,
				undertakingDataSharing: true,
				documents: uploads,
			})

			setDocuments({
				good_moral: null,
				passport_photo: null,
				filing_fee: null,
				enf_video_certification: null,
			})
			setUndertakingRules(false)
			setUndertakingDataSharing(false)
			toast.success("Application submitted to your Electronic Notary Administrator.")
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not submit application")
		}
	}

	return (
		<div className="space-y-4">
			{latestSubmission?.summaryHearing.scheduledAt ? (
				<CommissionSummaryHearingNotice
					hearing={latestSubmission.summaryHearing}
					hearingStatus={latestSubmission.hearingStatus}
					applicationStatus={latestSubmission.status}
				/>
			) : null}

			{submittedAt ? (
				<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
					<p className="font-medium text-emerald-800 dark:text-emerald-300">
						Application submitted on {new Date(submittedAt).toLocaleString()}
					</p>
					<p className="text-muted-foreground mt-0.5 text-xs">
						{latestSubmission?.status === "hearing_scheduled"
							? "Your ENA has scheduled your virtual summary hearing (see notice above)."
							: "Your package has been transmitted to your assigned ENA for review."}
					</p>
				</div>
			) : null}

			{missingProfileFields.length > 0 ? (
				<div className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="text-sm">
						<p className="font-medium text-amber-900 dark:text-amber-200">
							Complete your ENP profile before filing
						</p>
						<p className="text-muted-foreground mt-0.5 text-xs">
							Missing: {missingProfileFields.join(", ")}.
						</p>
					</div>
					<Link
						href={"/profile" as Route}
						className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0" })}
					>
						Open profile
					</Link>
				</div>
			) : null}

			<Card className="border-border overflow-hidden shadow-sm">
				<div className="bg-muted/30 border-b px-4 py-4 sm:px-6">
					<div className="flex flex-wrap items-start gap-3">
						<span className="bg-primary/10 text-primary inline-flex size-9 shrink-0 items-center justify-center rounded-lg">
							<HugeiconsIcon icon={JusticeScaleFreeIcons} className="size-5" strokeWidth={2} />
						</span>
						<div className="min-w-0 flex-1">
							<p className="text-sm font-semibold">Application package checklist</p>
							<p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
								All items below must be completed. The signed application is transmitted to your
								Electronic Notary Administrator (ENA).
							</p>
						</div>
					</div>
					<ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{COMMISSION_REQUIREMENTS.map((item, index) => (
							<li
								key={item}
								className="bg-background/60 border-border/50 flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
							>
								<span className="bg-primary/10 text-primary inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
									{index + 1}
								</span>
								<span className="text-muted-foreground leading-snug">{item}</span>
							</li>
						))}
					</ul>
				</div>

				<form onSubmit={e => void onSubmit(e)}>
					<div className="space-y-0 px-4 py-5 sm:px-6">
						<SectionHeading
							title="1. Personal qualifications"
							description="Pre-filled from your profile. Edit citizenship or ULAS if needed."
						/>
						<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<Field>
								<FieldLabel htmlFor="citizenship">Citizenship</FieldLabel>
								<Input
									id="citizenship"
									value={citizenship}
									onChange={e => setCitizenship(e.target.value)}
									required
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="ulas">ULAS compliance no.</FieldLabel>
								<Input
									id="ulas"
									value={ulasComplianceNumber}
									onChange={e => setUlasComplianceNumber(e.target.value)}
									placeholder="Reference number"
								/>
							</Field>
							<Field className="sm:col-span-2 lg:col-span-2">
								<FieldLabel>Email on file</FieldLabel>
								<Input value={profile.email} readOnly disabled className="bg-muted/40" />
							</Field>
						</div>
						<Field className="mt-4">
							<FieldLabel htmlFor="qualifications-statement">Qualifications statement</FieldLabel>
							<Textarea
								id="qualifications-statement"
								value={statement}
								onChange={e => setStatement(e.target.value)}
								rows={7}
								className="mt-1.5 resize-y font-mono text-xs leading-relaxed"
								required
							/>
							<FieldDescription className="mt-1.5">
								Review and edit before submitting to the ENA.
							</FieldDescription>
						</Field>
					</div>

					<Separator />

					<div className="px-4 py-5 sm:px-6">
						<SectionHeading
							title="2. Supporting documents"
							description="PDF or image files, up to 20MB each."
						/>
						<div className="mt-2">
							{DOCUMENT_SLOTS.map(slot => (
								<DocumentUploadRow
									key={slot.id}
									label={slot.label}
									hint={slot.hint}
									accept={slot.accept}
									file={documents[slot.id]}
									disabled={submitting}
									onChange={file =>
										setDocuments(prev => ({
											...prev,
											[slot.id]: file,
										}))
									}
								/>
							))}
						</div>
					</div>

					<Separator />

					<div className="px-4 py-5 sm:px-6">
						<SectionHeading
							title="3. Undertakings"
							description="Both undertakings are required under the Rules."
						/>
						<div className="mt-3 space-y-2">
							<label
								className={cn(
									"flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5",
									undertakingRules && "border-primary/40 bg-primary/5"
								)}
							>
								<Checkbox
									checked={undertakingRules}
									onCheckedChange={v => setUndertakingRules(v === true)}
								/>
								<span className="text-sm leading-snug">
									I undertake to execute electronic notarial acts strictly in accordance with the
									Rules on Electronic Notarization.
								</span>
							</label>
							<label
								className={cn(
									"flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5",
									undertakingDataSharing && "border-primary/40 bg-primary/5"
								)}
							>
								<Checkbox
									checked={undertakingDataSharing}
									onCheckedChange={v => setUndertakingDataSharing(v === true)}
								/>
								<span className="text-sm leading-snug">
									I undertake to comply with the Electronic Notarization Data Sharing Guidelines.
								</span>
							</label>
						</div>
					</div>

					<div className="bg-muted/25 flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
						<p className="text-muted-foreground text-xs leading-relaxed">
							By submitting, you sign with your authenticated session and authorize transmission to
							your assigned ENA.
						</p>
						<div className="flex shrink-0 gap-2">
							<Link
								href={"/dashboard" as Route}
								className={buttonVariants({ variant: "outline", size: "sm" })}
							>
								Cancel
							</Link>
							<TooltipProvider delay={100}>
								<Tooltip>
									<TooltipTrigger
										render={
											<Button
												type="submit"
												size="sm"
												disabled={submitting}
												aria-disabled={!canSubmit}
												className={cn(
													!canSubmit &&
														!submitting &&
														"hover:bg-primary cursor-not-allowed opacity-70"
												)}
												onClick={event => {
													if (!hasSubmissionBlockers) return
													event.preventDefault()
												}}
											>
												{submitting ? "Submitting…" : "Sign & submit to ENA"}
											</Button>
										}
									/>
									{hasSubmissionBlockers ? (
										<TooltipContent align="end" className="max-w-80 items-start text-left">
											<div className="space-y-1">
												<p className="font-medium">Complete these before submitting:</p>
												<ul className="list-disc space-y-0.5 pl-4">
													{submissionBlockers.map(blocker => (
														<li key={blocker}>{blocker}</li>
													))}
												</ul>
											</div>
										</TooltipContent>
									) : null}
								</Tooltip>
							</TooltipProvider>
						</div>
					</div>
				</form>
			</Card>
		</div>
	)
}
