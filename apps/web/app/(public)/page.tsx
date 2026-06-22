import type { Metadata } from "next"

import { Compliance } from "@/features/home/compliance"
import { CTA } from "@/features/home/cta"
import { Features } from "@/features/home/features"
import { Footer } from "@/features/home/footer"
import { Hero } from "@/features/home/hero"
import { Navbar } from "@/features/home/navbar"
import { TrustedBy } from "@/features/home/trusted-by"

export const metadata: Metadata = {
	title: "Electronic Notarization Platform",
	description:
		"Quanby Legal provides secure electronic notarization, document review, signing, and notarial registry workflows.",
}

export default function Page() {
	return (
		<div className="relative">
			<Navbar />
			<Hero />
			<TrustedBy />
			<Features />
			<Compliance />
			<CTA />
			<Footer />
		</div>
	)
}
