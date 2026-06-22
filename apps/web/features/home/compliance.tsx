"use client"

import {
	BookOpen01Icon,
	Certificate01Icon,
	LegalDocument01Icon,
	Shield01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

const complianceItems = [
	{
		icon: LegalDocument01Icon,
		title: "Supreme Court-Compliant",
		description:
			"Designed around Philippine electronic notarization workflows, not generic document signing.",
		link: "https://sc.judiciary.gov.ph/enotary-services/enotarization-rules/",
	},
	{
		icon: Certificate01Icon,
		title: "DICT National PKI Verified",
		description:
			"Supports trusted identity and digital-certificate workflows for legal-grade transactions.",
		link: "https://dict.gov.ph/pnpki",
	},
	{
		icon: BookOpen01Icon,
		title: "PropTech Consortium Endorsed",
		description:
			"Built for modern property and legal transactions that need secure online notarization.",
		link: "https://facebook.com/PropTechConsortiumPH",
	},
	{
		icon: Shield01Icon,
		title: "DOCONCHAIN & Hyperledger",
		description:
			"Combines document signing with blockchain-backed audit trails and compliance records.",
		link: "https://doconchain.com",
	},
]

export function Compliance() {
	return (
		<section id="compliance" className="relative overflow-hidden py-20 lg:py-28">
			<div className="via-background absolute inset-0 bg-linear-to-br from-[rgb(233,30,140)]/5 to-[rgb(91,26,128)]/5" />
			<div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto mb-12 max-w-3xl text-center">
					<h2 className="text-3xl font-bold tracking-tight lg:text-5xl">
						Legally compliant and audit-ready
					</h2>
					<p className="text-muted-foreground mt-4 text-lg">
						QLegal brings legal operations, identity, signatures, and registry evidence into a
						single electronic notarization workflow.
					</p>
				</div>

				<div className="grid gap-5 md:grid-cols-2">
					{complianceItems.map(item => (
						<a
							key={item.title}
							href={item.link}
							target="_blank"
							rel="noopener noreferrer"
							className="group bg-background/80 hover:border-primary/40 hover:bg-background rounded-lg border p-6 shadow-sm transition-colors"
						>
							<div className="flex gap-4">
								<div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-lg">
									<HugeiconsIcon icon={item.icon} strokeWidth={2} className="size-6" />
								</div>
								<div>
									<h3 className="group-hover:text-primary text-lg font-semibold">{item.title}</h3>
									<p className="text-muted-foreground mt-2 text-sm leading-relaxed">
										{item.description}
									</p>
								</div>
							</div>
						</a>
					))}
				</div>
			</div>
		</section>
	)
}
