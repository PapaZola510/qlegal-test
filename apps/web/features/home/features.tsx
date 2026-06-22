"use client"

import {
	BookOpen01Icon,
	File02Icon,
	Shield01Icon,
	SignatureIcon,
	UserGroupIcon,
	Video01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { MotionEffect } from "@/features/home/ui/motion-effect"

const features = [
	{
		icon: Video01Icon,
		title: "IEN & REN Services",
		description:
			"Run in-person and remote electronic notarization with meeting, signing, and review workflows in one place.",
	},
	{
		icon: Shield01Icon,
		title: "DICT National PKI Authentication",
		description:
			"Support identity and signature workflows built around verified digital trust and auditability.",
	},
	{
		icon: SignatureIcon,
		title: "Electronic Signatures & Seal",
		description:
			"Create signing sessions for principals, witnesses, and ENPs with document-level signer management.",
	},
	{
		icon: BookOpen01Icon,
		title: "Notarial Register",
		description:
			"Track notarial acts, audit details, and registry entries from the same operational workspace.",
	},
	{
		icon: File02Icon,
		title: "Document Review",
		description:
			"Let clients upload documents for review, then convert approved files into signing sessions.",
	},
	{
		icon: UserGroupIcon,
		title: "Client & ENP Workspaces",
		description:
			"Separate client and notary workflows keep appointments, documents, recordings, and signed files organized.",
	},
]

export function Features() {
	return (
		<section id="features" className="relative overflow-hidden py-20 lg:py-28">
			<div className="from-primary/5 via-background absolute inset-0 bg-linear-to-br to-pink-500/5" />
			<div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<MotionEffect
					inView
					fade
					slide={{ direction: "up", offset: 24 }}
					transition={{ duration: 0.5 }}
					className="mx-auto mb-12 max-w-3xl text-center"
				>
					<h2 className="text-3xl font-bold tracking-tight lg:text-5xl">
						Full-featured electronic notarization facility
					</h2>
					<p className="text-muted-foreground mt-4 text-lg">
						A practical platform for notarization operations, from client intake to final signed
						document access.
					</p>
				</MotionEffect>

				<div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
					{features.map((feature, index) => (
						<MotionEffect
							key={feature.title}
							inView
							fade
							slide={{ direction: "up", offset: 20 }}
							delay={index * 0.04}
							transition={{ duration: 0.45 }}
							className="bg-background/80 rounded-lg border p-6 shadow-sm backdrop-blur"
						>
							<div className="bg-primary/10 text-primary mb-5 flex size-11 items-center justify-center rounded-lg">
								<HugeiconsIcon icon={feature.icon} strokeWidth={2} className="size-5" />
							</div>
							<h3 className="text-xl font-semibold">{feature.title}</h3>
							<p className="text-muted-foreground mt-3 text-sm leading-relaxed">
								{feature.description}
							</p>
						</MotionEffect>
					))}
				</div>
			</div>
		</section>
	)
}
