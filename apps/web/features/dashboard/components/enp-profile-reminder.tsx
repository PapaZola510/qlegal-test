"use client"

import * as React from "react"
import Link from "next/link"
import {
	AlertCircleFreeIcons,
	ArrowRight01FreeIcons,
	CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { UserProfile } from "@repo/contracts"

import { buttonVariants } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import {
	isNotarialCredentialsComplete,
	missingNotarialCredentialFields,
} from "@/features/profile/lib/notarial-credentials-complete"

export function EnpProfileReminder({ profile }: { profile: UserProfile }) {
	if (profile.role !== "enp") return null

	const missing = missingNotarialCredentialFields(profile)
	const isComplete = isNotarialCredentialsComplete(profile)

	if (isComplete) {
		return (
			<Card className="border-emerald-500/25 bg-emerald-500/[0.04] shadow-sm">
				<CardHeader className="flex flex-row items-start gap-3 space-y-0">
					<span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
						<HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5" strokeWidth={2} />
					</span>
					<div className="min-w-0 flex-1">
						<CardTitle className="text-base">ENP Profile already set up</CardTitle>
						<CardDescription className="text-muted-foreground mt-1 leading-relaxed">
							Your notarial credentials are on file and ready for Supreme Court sync of notarial
							acts.
						</CardDescription>
					</div>
				</CardHeader>
			</Card>
		)
	}

	return (
		<Card className="border-amber-500/25 bg-amber-500/[0.04] shadow-sm">
			<CardHeader className="flex flex-row items-start gap-3 space-y-0">
				<span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-500">
					<HugeiconsIcon icon={AlertCircleFreeIcons} className="size-5" strokeWidth={2} />
				</span>
				<div className="min-w-0 flex-1">
					<CardTitle className="text-base">Complete your ENP Profile for SC sync</CardTitle>
					<CardDescription className="text-muted-foreground mt-1 leading-relaxed">
						Complete these fields for your electronic notarial seal on signed documents and for
						Supreme Court eNotarization registry sync.
					</CardDescription>
				</div>
			</CardHeader>
			<CardContent className="space-y-4 pl-[60px]">
				<div>
					<p className="mb-2 text-sm font-medium">Missing fields:</p>
					<ul className="text-muted-foreground grid gap-1 text-sm leading-relaxed sm:grid-cols-2">
						{missing.map(field => (
							<li key={field.label} className="flex items-center gap-2">
								<span
									className="inline-flex size-1.5 shrink-0 rounded-full bg-amber-500"
									aria-hidden
								/>
								{field.label}
							</li>
						))}
					</ul>
				</div>
				<Link href="/profile?focus=notarial" className={buttonVariants({ size: "default" })}>
					Complete ENP Profile
					<HugeiconsIcon icon={ArrowRight01FreeIcons} className="ml-1.5 size-4" strokeWidth={2} />
				</Link>
			</CardContent>
		</Card>
	)
}
