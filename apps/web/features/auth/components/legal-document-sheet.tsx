"use client"

import * as React from "react"
import { BookOpen01Icon, LegalDocument01Icon, LinkSquare01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Separator } from "@/core/components/ui/separator"
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/core/components/ui/sheet"
import { cn } from "@/core/lib/utils"

// ─── RA 10173 content ────────────────────────────────────────────────────────

const RA_10173_SECTIONS = [
	{
		section: "Purpose",
		content:
			"Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012, protects the fundamental human right of privacy of communication while ensuring free flow of information to promote innovation and growth. It regulates the collection, recording, organization, storage, updating, use, consolidation, blocking, erasure, or destruction of personal data.",
	},
	{
		section: "Personal Information Controller",
		content:
			"qLegal / Quanby Solutions, Inc. acts as a Personal Information Controller (PIC) and is responsible for the personal data you provide or that is collected through your use of this platform. We are registered with the National Privacy Commission (NPC).",
	},
	{
		section: "Data Collected",
		content:
			"We collect: (a) identity information — full name, date of birth, nationality; (b) contact information — email address, phone number; (c) government-issued identification documents; (d) video recordings of notarial sessions; (e) document contents submitted for notarization or legal review; (f) device and usage data for security and fraud prevention.",
	},
	{
		section: "Purpose of Processing",
		content:
			"Your data is processed for: (a) account creation and authentication; (b) identity verification (KYC) as required by the Supreme Court's Electronic Notarization Rules; (c) electronic notarization of documents; (d) compliance with reporting obligations under applicable law; (e) communication regarding your transactions; (f) fraud prevention and platform security.",
	},
	{
		section: "Legal Basis",
		content:
			"Processing is performed on the basis of: (a) your explicit consent; (b) contractual necessity — to provide the notarial and legal services you have engaged; (c) legal obligation — compliance with the Rules on Electronic Notarization and related Supreme Court issuances; and (d) legitimate interest — platform security.",
	},
	{
		section: "Data Sharing with the Supreme Court",
		content:
			"Pursuant to the Supreme Court's Rules on Electronic Notarization, transaction data including parties' information, document metadata, and notarial records shall be transmitted to the Supreme Court's Electronic Notarization Registry in accordance with the Electronic Notarization Data Sharing Guidelines.",
	},
	{
		section: "Video Recording Retention (AWS)",
		content:
			"Video recordings of notarial sessions are stored in a secure Amazon Web Services (AWS) S3 bucket located in the Asia-Pacific region. Recordings are retained for the period required by the Rules on Electronic Notarization (currently five (5) years from the date of the notarial act), after which they are permanently deleted. Access is restricted to authorized personnel and the parties to the notarial act.",
	},
	{
		section: "Your Rights as a Data Subject",
		content:
			"Under RA 10173 you have the right to: (a) be informed of the processing of your personal data; (b) access your personal data held by us; (c) object to the processing of your data in certain circumstances; (d) erasure or blocking of your data when no longer necessary; (e) rectification of inaccurate data; (f) data portability; (g) file a complaint with the National Privacy Commission at www.privacy.gov.ph.",
	},
	{
		section: "Data Protection Officer",
		content:
			"For concerns regarding your personal data or to exercise your rights under RA 10173, please contact our Data Protection Officer at: dpo@quanby.legal. We will respond to requests within fifteen (15) working days.",
	},
]

// ─── Electronic Notarization Data Sharing Guidelines content ─────────────────

const ENB_SECTIONS = [
	{
		section: "Overview",
		content:
			"The Electronic Notarization Data Sharing Guidelines are issued by the Supreme Court of the Philippines pursuant to its rule-making authority. These guidelines govern the mandatory transmission of electronic notarial records from duly registered Electronic Notarization Platforms (ENPs) to the Supreme Court's National Electronic Notarial Repository (NENR).",
	},
	{
		section: "Covered Transactions",
		content:
			"All notarial acts performed through a Supreme Court-accredited ENP — including acknowledgments, jurats, oaths, affirmations, and copy certifications — are subject to data sharing under these guidelines. Each act generates a notarial record that must be transmitted to the NENR within twenty-four (24) hours of execution.",
	},
	{
		section: "Data Elements Transmitted",
		content:
			"The following data elements are transmitted per notarial act: (a) Notarial Public Number (NPN) and commission details of the Electronic Notarial Public (ENP); (b) full names, addresses, and government ID references of all parties; (c) document type, title, and act type; (d) date, time, and unique transaction identifier; (e) hash of the notarized document for integrity verification; (f) session recording metadata (duration, participant count).",
	},
	{
		section: "Security of Transmission",
		content:
			"All transmissions to the NENR are encrypted using TLS 1.3 or higher. Each transmission is digitally signed using the ENP's Supreme Court-issued certificate. Data at rest in the NENR is encrypted using AES-256.",
	},
	{
		section: "Access to Shared Data",
		content:
			"Data transmitted to the NENR may be accessed by: (a) the Office of the Court Administrator for regulatory oversight; (b) authorized courts for evidentiary purposes in legal proceedings; (c) the parties to a notarial act upon written request and proper identification. Public access to notarial records is governed by the Rules on Electronic Notarization.",
	},
	{
		section: "Data Retention at NENR",
		content:
			"The NENR retains notarial records permanently as part of the official judicial records of the Republic of the Philippines. ENPs are required to maintain their own copies for at least five (5) years from the date of the notarial act.",
	},
	{
		section: "Your Consent",
		content:
			"By using qLegal, you explicitly consent to the transmission of the data elements described above to the Supreme Court's NENR. This transmission is a mandatory requirement for the valid performance of electronic notarization and cannot be waived by the parties.",
	},
]

// ─── Section component ────────────────────────────────────────────────────────

function DocSection({ section, content }: { section: string; content: string }) {
	return (
		<div className="space-y-1.5">
			<h4 className="font-montserrat text-xs font-semibold tracking-wide text-[var(--foreground)] uppercase">
				{section}
			</h4>
			<p className="font-montserrat text-xs leading-relaxed text-[var(--muted-foreground)]">
				{content}
			</p>
		</div>
	)
}

// ─── Sheet trigger button ─────────────────────────────────────────────────────

interface LegalDocumentSheetProps {
	document: "ra10173" | "enb-guidelines"
	externalUrl?: string | null
	className?: string
}

const DOC_META = {
	"ra10173": {
		trigger: "Republic Act No. 10173 or the \u201cData Privacy Act of 2012\u201d",
		title: "Republic Act No. 10173",
		subtitle: "Data Privacy Act of 2012",
		badge: "RA 10173",
		icon: BookOpen01Icon,
		sections: RA_10173_SECTIONS,
		officialUrl: "https://www.privacy.gov.ph/data-privacy-act/",
	},
	"enb-guidelines": {
		trigger: "Electronic Notarization Data Sharing Guidelines",
		title: "Electronic Notarization Data Sharing Guidelines",
		subtitle: "Supreme Court of the Philippines",
		badge: "SC Guidelines",
		icon: LegalDocument01Icon,
		sections: ENB_SECTIONS,
		officialUrl: "https://sc.judiciary.gov.ph",
	},
}

export function LegalDocumentSheet({ document, externalUrl, className }: LegalDocumentSheetProps) {
	const meta = DOC_META[document]
	const officialHref = externalUrl ?? meta.officialUrl

	return (
		<Sheet>
			<SheetTrigger
				className={cn(
					"font-montserrat inline cursor-pointer border-b border-dashed border-[var(--primary)] text-[var(--primary)] transition-colors hover:border-solid hover:text-[var(--primary)]/80",
					className
				)}
				onPointerDown={e => e.stopPropagation()}
				onClick={e => e.stopPropagation()}
			>
				{meta.trigger}
			</SheetTrigger>

			<SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
				<SheetHeader className="pb-2">
					<div className="flex items-start gap-3">
						<div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10">
							<HugeiconsIcon
								icon={meta.icon}
								className="size-5 text-[var(--primary)]"
								strokeWidth={1.5}
							/>
						</div>
						<div className="min-w-0">
							<div className="mb-1 flex items-center gap-2">
								<Badge
									variant="outline"
									className="border-[var(--primary)]/30 bg-[var(--primary)]/5 text-[9px] text-[var(--primary)]"
								>
									{meta.badge}
								</Badge>
							</div>
							<SheetTitle className="font-poppins text-sm leading-snug">{meta.title}</SheetTitle>
							<SheetDescription className="font-montserrat mt-0.5 text-xs">
								{meta.subtitle}
							</SheetDescription>
						</div>
					</div>
				</SheetHeader>

				<Separator />

				<div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
					{meta.sections.map((s, i) => (
						<React.Fragment key={s.section}>
							<DocSection section={s.section} content={s.content} />
							{i < meta.sections.length - 1 && <Separator className="opacity-40" />}
						</React.Fragment>
					))}
				</div>

				<Separator />

				<SheetFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<p className="font-montserrat text-[10px] leading-snug text-[var(--muted-foreground)]">
						This is a summary. View the official document for complete provisions.
					</p>
					<a href={officialHref} target="_blank" rel="noreferrer noopener" className="shrink-0">
						<Button variant="outline" size="sm" className="font-montserrat gap-1.5 text-xs">
							<HugeiconsIcon icon={LinkSquare01Icon} className="size-3.5" strokeWidth={2} />
							Official Source
						</Button>
					</a>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	)
}
