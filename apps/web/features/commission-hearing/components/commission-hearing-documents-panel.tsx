"use client"

import { toast } from "sonner"

import type { EnpCommissionApplication } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import { Separator } from "@/core/components/ui/separator"
import { useHearingApplicationQuery } from "@/features/commission-hearing/api/commission-hearing.hooks"
import {
	downloadCommissionApplicationFile,
	openCommissionApplicationFile,
} from "@/features/enp-commission-application/lib/commission-application-file-actions"

const REQUIREMENT_ORDER = [
	"good_moral",
	"passport_photo",
	"filing_fee",
	"enf_video_certification",
] as const

const REQUIREMENT_LABELS: Record<(typeof REQUIREMENT_ORDER)[number], string> = {
	good_moral: "Good moral character",
	passport_photo: "Passport photo",
	filing_fee: "Filing fee proof",
	enf_video_certification: "ENF video certification",
}

function documentByRequirement(application: EnpCommissionApplication) {
	return new Map(application.documents.map(doc => [doc.requirementKey, doc]))
}

function yesNo(value: boolean): string {
	return value ? "Accepted" : "Not accepted"
}

export function CommissionHearingDocumentsPanel({
	applicationId,
}: {
	applicationId: string | null | undefined
}) {
	const applicationQ = useHearingApplicationQuery(applicationId)

	if (!applicationId) {
		return (
			<p className="text-muted-foreground p-2 text-sm">
				Application documents are not linked to this hearing.
			</p>
		)
	}

	if (applicationQ.isLoading) {
		return <p className="text-muted-foreground p-2 text-sm">Loading submitted documents...</p>
	}

	if (applicationQ.isError || !applicationQ.data) {
		return (
			<p className="text-destructive p-2 text-sm">
				{applicationQ.error instanceof Error
					? applicationQ.error.message
					: "Could not load submitted documents."}
			</p>
		)
	}

	const application = applicationQ.data
	const docsByRequirement = documentByRequirement(application)

	async function handleView(fileObjectId: string) {
		try {
			await openCommissionApplicationFile(fileObjectId)
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not open document")
		}
	}

	async function handleDownload(fileObjectId: string, filename: string) {
		try {
			await downloadCommissionApplicationFile(fileObjectId, filename)
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not download document")
		}
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pb-3 text-sm">
			<section className="space-y-3">
				<div>
					<h2 className="text-sm font-semibold">Submitted requirements</h2>
					<p className="text-muted-foreground text-xs leading-relaxed">
						Review the applicant&apos;s commission package during the summary hearing.
					</p>
				</div>
				<ul className="divide-border rounded-md border">
					{REQUIREMENT_ORDER.map(requirementKey => {
						const doc = docsByRequirement.get(requirementKey)
						return (
							<li key={requirementKey} className="space-y-3 p-3">
								<div>
									<p className="text-sm font-medium">{REQUIREMENT_LABELS[requirementKey]}</p>
									<p className="text-muted-foreground text-xs">
										{doc ? `${doc.mimeType} - ${(doc.sizeBytes / 1024).toFixed(1)} KB` : "Missing"}
									</p>
								</div>
								{doc ? (
									<div className="flex flex-wrap gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => void handleView(doc.fileObjectId)}
										>
											View
										</Button>
										<Button
											type="button"
											variant="secondary"
											size="sm"
											onClick={() =>
												void handleDownload(doc.fileObjectId, REQUIREMENT_LABELS[requirementKey])
											}
										>
											Download
										</Button>
									</div>
								) : null}
							</li>
						)
					})}
				</ul>
			</section>

			<Separator className="my-4" />

			<section className="space-y-3">
				<div>
					<h2 className="text-sm font-semibold">Qualifications</h2>
					<p className="text-muted-foreground text-xs leading-relaxed">
						Applicant statements and undertakings submitted with the package.
					</p>
				</div>
				<dl className="grid gap-3 text-xs">
					<div>
						<dt className="text-muted-foreground">Citizenship</dt>
						<dd className="text-sm font-medium">{application.citizenship}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">ULAS compliance no.</dt>
						<dd className="text-sm font-medium">
							{application.ulasComplianceNumber?.trim() || "Not provided"}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Rules undertaking</dt>
						<dd className="text-sm font-medium">{yesNo(application.undertakingRules)}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Data sharing undertaking</dt>
						<dd className="text-sm font-medium">{yesNo(application.undertakingDataSharing)}</dd>
					</div>
				</dl>
				<div>
					<p className="text-muted-foreground text-xs font-medium uppercase">
						Qualifications statement
					</p>
					<pre className="bg-muted/40 mt-2 max-h-56 overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
						{application.qualificationsStatement}
					</pre>
				</div>
			</section>
		</div>
	)
}
