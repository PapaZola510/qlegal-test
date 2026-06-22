import * as React from "react"

import { Checkbox } from "@/core/components/ui/checkbox"
import { FieldDescription } from "@/core/components/ui/field"
import { cn } from "@/core/lib/utils"

import { LegalDocumentSheet } from "./legal-document-sheet"

export interface TermsPrivacyNoteProps {
	id?: string
	termsUrl?: string | null
	privacyUrl?: string | null
	consentRequired?: boolean
	consented?: boolean
	onConsentChange?: (next: boolean) => void
	onConsented?: () => void
}

export function TermsPrivacyNote({
	id = "terms-privacy-consent",
	termsUrl,
	privacyUrl,
	consentRequired = false,
	consented = false,
	onConsentChange,
	onConsented,
}: TermsPrivacyNoteProps) {
	const showConsent =
		consentRequired && (typeof onConsentChange === "function" || typeof onConsented === "function")

	return (
		<FieldDescription
			className={cn(
				"text-[11px] leading-snug sm:text-xs",
				showConsent ? "px-0 text-left" : "px-0 text-left sm:px-0"
			)}
		>
			{showConsent ? (
				<span className="inline-flex items-start gap-2.5">
					<Checkbox
						id={id}
						className="mt-0.5 shrink-0 after:content-none"
						checked={consented}
						onCheckedChange={checked => {
							const next = checked === true
							onConsentChange?.(next)
							if (next && typeof onConsented === "function") onConsented()
						}}
						aria-label="Agree to Data Privacy terms"
					/>
					<label
						htmlFor={id}
						className="font-montserrat cursor-pointer leading-relaxed text-[var(--muted-foreground)] select-none"
					>
						All parties and their personal information shall be collected and processed in
						accordance with <LegalDocumentSheet document="ra10173" externalUrl={termsUrl} /> and
						shall be shared with the Supreme Court in accordance with the{" "}
						<LegalDocumentSheet document="enb-guidelines" externalUrl={privacyUrl} />; check storage
						of video recording to AWS account.
					</label>
				</span>
			) : (
				<span className="font-montserrat leading-relaxed text-[var(--muted-foreground)]">
					By clicking continue, your information is processed per{" "}
					<LegalDocumentSheet document="ra10173" externalUrl={termsUrl} /> and the{" "}
					<LegalDocumentSheet document="enb-guidelines" externalUrl={privacyUrl} />.
				</span>
			)}
		</FieldDescription>
	)
}
