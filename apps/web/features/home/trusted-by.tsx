"use client"

import {
	Building05Icon,
	Certificate01Icon,
	GlobalIcon,
	LegalDocument01Icon,
	Shield01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

const partners = [
	{
		icon: LegalDocument01Icon,
		name: "Supreme Court of the Philippines",
		url: "https://sc.judiciary.gov.ph/enotary-services/enotarization-rules/",
	},
	{ icon: Certificate01Icon, name: "DICT National PKI", url: "https://dict.gov.ph/pnpki" },
	{
		icon: GlobalIcon,
		name: "PropTech Consortium PH",
		url: "https://facebook.com/PropTechConsortiumPH",
	},

	{ icon: Building05Icon, name: "Hyperledger Fabric", url: "https://ibm.com/topics/hyperledger" },
]

export function TrustedBy() {
	return (
		<section className="bg-muted/20 relative overflow-hidden border-y py-12">
			<div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
				<h2 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
					Aligned with trusted legal and technology standards
				</h2>
				<div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
					{partners.map(partner => (
						<a
							key={partner.name}
							href={partner.url}
							target="_blank"
							rel="noopener noreferrer"
							className="bg-background/70 hover:border-primary/40 flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-sm transition-colors"
						>
							<HugeiconsIcon icon={partner.icon} strokeWidth={2} className="text-primary size-5" />
							<span>{partner.name}</span>
						</a>
					))}
				</div>
			</div>
		</section>
	)
}
