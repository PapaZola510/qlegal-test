"use client"

import * as React from "react"

import { cn } from "@/core/lib/utils"
import { AffidavitOfLossEditor } from "@/features/legal-templates/components/affidavit-of-loss-editor"
import { LEGAL_TEMPLATES, type TemplateId } from "@/features/legal-templates/types"
import { AffidavitOfDesistanceEditor } from "@/features/legal-templates/components/affidavit-of-desistance-editor"
import { AffidavitOfDiscrepancyEditor } from "@/features/legal-templates/components/affidavit-of-discrepancy-editor"
import { SwornAffidavitNameDiscrepancyEditor } from "@/features/legal-templates/components/sworn-affidavit-name-discrepancy-editor"
import { JudicialAffidavitEditor } from "@/features/legal-templates/components/judicial-affidavit-editor"
import { AffidavitOfUndertakingEditor } from "@/features/legal-templates/components/affidavit-of-undertaking-editor"
import { AffidavitOfUndertakingWithMinorEditor } from "@/features/legal-templates/components/affidavit-of-undertaking-with-minor-editor"
import { AffidavitOfUndertakingPsaBirthMarriageCertificateEditor } from "@/features/legal-templates/components/affidavit-of-undertaking-psa-birth-marriage-certificate-editor"
import { OmnibusSwornStatementEditor } from "@/features/legal-templates/components/omnibus-sworn-statement-editor"
import { CopyCertificationEditor } from "@/features/legal-templates/components/copy-certification-editor"
import { VerificationAndCertificationAgainstForumShoppingEditor } from "@/features/legal-templates/components/verification-and-certification-against-forum-shopping-editor"
import { SwornStatementAssetsLiabilitiesNetWorthEditor } from "@/features/legal-templates/components/sworn-statement-assets-liabilities-net-worth-editor"
import { PetitionForVoluntaryConfinementTreatmentEditor } from "@/features/legal-templates/components/petition-for-voluntary-confinement-treatment-editor"
import { GsisBoardOfTrusteesPetitionEditor } from "@/features/legal-templates/components/gsis-board-of-trustees-petition-editor"
import { DeedOfAbsoluteSaleEditor } from "@/features/legal-templates/components/deed-of-absolute-sale-editor"
import { SpecialPowerOfAttorneyEditor } from "@/features/legal-templates/components/special-power-of-attorney-editor"
import { DeedOfDonationEditor } from "@/features/legal-templates/components/deed-of-donation-editor"
import { ContractOfLeaseEditor } from "@/features/legal-templates/components/contract-of-lease-editor"
import { RealEstateMortgageEditor } from "@/features/legal-templates/components/real-estate-mortgage-editor"
import { ContractOfServicesEditor } from "@/features/legal-templates/components/contract-of-services-editor"

const AFFIDAVIT_TEMPLATE_IDS: TemplateId[] = [
	"affidavit-of-loss",
	"affidavit-of-discrepancy",
	"sworn-affidavit-name-discrepancy",
	"judicial-affidavit",
	"affidavit-of-undertaking",
	"affidavit-of-undertaking-with-minor",
	"affidavit-of-undertaking-psa-birth-marriage-certificate",
	"affidavit-of-desistance",
]

// ── SVG icon for document templates ──────────────────────────────────────────
function TemplateIcon({ className }: { className?: string }) {
	return (
		<svg
			className={cn("size-8", className)}
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			strokeWidth={1.5}
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
			/>
		</svg>
	)
}

// ── Template card ─────────────────────────────────────────────────────────────
function TemplateCard({
	title,
	description,
	badge,
	onClick,
}: {
	title: string
	description: string
	badge?: string
	onClick: () => void
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"group relative flex flex-col gap-4 rounded-xl border p-6 text-left transition-all duration-200",
				"bg-card hover:bg-accent/5 hover:border-primary/40 hover:shadow-primary/5 hover:shadow-md",
				"focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none"
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="bg-primary/10 text-primary group-hover:bg-primary/15 flex size-12 items-center justify-center rounded-lg transition-colors">
					<TemplateIcon className="size-6" />
				</div>
				{badge && (
					<span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
						{badge}
					</span>
				)}
			</div>
			<div>
				<div className="mb-1.5 text-sm leading-snug font-semibold">{title}</div>
				<p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
			</div>
			<div className="text-primary flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
				Open template
				<svg
					className="size-3.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2.5}
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
					/>
				</svg>
			</div>
		</button>
	)
}

// ── Hub ───────────────────────────────────────────────────────────────────────
export function LegalTemplatesHub() {
	const [activeTemplate, setActiveTemplate] = React.useState<TemplateId | null>(null)
	const affidavitTemplates = LEGAL_TEMPLATES.filter(template => AFFIDAVIT_TEMPLATE_IDS.includes(template.id))
	const otherTemplates = LEGAL_TEMPLATES.filter(template => !AFFIDAVIT_TEMPLATE_IDS.includes(template.id))

	const handleBack = () => setActiveTemplate(null)

	if (activeTemplate === "affidavit-of-loss") {
		return <AffidavitOfLossEditor onBack={handleBack} />
	}

	if (activeTemplate === "affidavit-of-discrepancy") {
		return <AffidavitOfDiscrepancyEditor onBack={handleBack} />
	}

	if (activeTemplate === "sworn-affidavit-name-discrepancy") {
		return <SwornAffidavitNameDiscrepancyEditor onBack={handleBack} />
	}

	if (activeTemplate === "judicial-affidavit") {
		return <JudicialAffidavitEditor onBack={handleBack} />
	}

	if (activeTemplate === "affidavit-of-undertaking") {
		return <AffidavitOfUndertakingEditor onBack={handleBack} />
	}

	if (activeTemplate === "affidavit-of-undertaking-with-minor") {
		return <AffidavitOfUndertakingWithMinorEditor onBack={handleBack} />
	}

	if (activeTemplate === "affidavit-of-undertaking-psa-birth-marriage-certificate") {
		return <AffidavitOfUndertakingPsaBirthMarriageCertificateEditor onBack={handleBack} />
	}

	if (activeTemplate === "verification-and-certification-against-forum-shopping") {
		return <VerificationAndCertificationAgainstForumShoppingEditor onBack={handleBack} />
	}

	if (activeTemplate === "petition-for-voluntary-confinement-treatment") {
		return <PetitionForVoluntaryConfinementTreatmentEditor onBack={handleBack} />
	}

	if (activeTemplate === "gsis-board-of-trustees-petition") {
		return <GsisBoardOfTrusteesPetitionEditor onBack={handleBack} />
	}

	if (activeTemplate === "omnibus-sworn-statement") {
		return <OmnibusSwornStatementEditor onBack={handleBack} />
	}

	if (activeTemplate === "copy-certification") {
		return <CopyCertificationEditor onBack={handleBack} />
	}

	if (activeTemplate === "sworn-statement-assets-liabilities-net-worth") {
		return <SwornStatementAssetsLiabilitiesNetWorthEditor onBack={handleBack} />
	}

	if (activeTemplate === "affidavit-of-desistance") {
		return <AffidavitOfDesistanceEditor onBack={handleBack} />
	}

	if (activeTemplate === "deed-of-absolute-sale") {
		return <DeedOfAbsoluteSaleEditor onBack={handleBack} />
	}

	if (activeTemplate === "special-power-of-attorney") {
		return <SpecialPowerOfAttorneyEditor onBack={handleBack} />
	}

	if (activeTemplate === "deed-of-donation") {
		return <DeedOfDonationEditor onBack={handleBack} />
	}

	if (activeTemplate === "contract-of-lease") {
		return <ContractOfLeaseEditor onBack={handleBack} />
	}

	if (activeTemplate === "real-estate-mortgage") {
		return <RealEstateMortgageEditor onBack={handleBack} />
	}

	if (activeTemplate === "contract-of-services") {
		return <ContractOfServicesEditor onBack={handleBack} />
	}

	return (
		<div className="space-y-6">
			{/* Page header */}
			<div>
				<h1 className="text-xl font-semibold tracking-tight">Legal Document Templates</h1>
				<p className="text-muted-foreground mt-1 text-sm">
					Select a template to fill in, preview, and export as PDF.
				</p>
			</div>

			{/* Affidavit templates folder */}
			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
						Affidavits
					</h2>
					<span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
						{affidavitTemplates.length}
					</span>
				</div>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{affidavitTemplates.map(template => (
						<TemplateCard
							key={template.id}
							title={template.title}
							description={template.description}
							badge="Affidavit"
							onClick={() => setActiveTemplate(template.id)}
						/>
					))}
				</div>
			</div>

			{/* Other legal templates */}
			<div className="space-y-3">
				<div className="flex items-center gap-2">
					<h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
						Other Legal Forms
					</h2>
					<span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
						{otherTemplates.length}
					</span>
				</div>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{otherTemplates.map(template => (
						<TemplateCard
							key={template.id}
							title={template.title}
							description={template.description}
							onClick={() => setActiveTemplate(template.id)}
						/>
					))}
				</div>
			</div>

			{/* Info note */}
			<div className="bg-muted/30 text-muted-foreground rounded-lg border border-dashed p-4 text-xs">
				<strong>Tip:</strong> Your draft is saved locally in your browser. Fill in the blanks, then
				click <strong>Export PDF</strong> to download a printable document.
			</div>
		</div>
	)
}
