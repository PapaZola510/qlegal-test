"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { UserProfile } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { shouldRedirectToOnboarding } from "@/features/auth/lib/should-redirect-to-onboarding"
import { useBootstrapRoleMutation } from "@/features/onboarding/api/profile-onboarding.hooks"
import { CancelEnpOnboardingButton } from "@/features/onboarding/components/cancel-enp-onboarding-button"

export function BecomeEnpCard({ profile }: { profile: UserProfile }) {
	const router = useRouter()
	const bootstrap = useBootstrapRoleMutation()
	const [err, setErr] = React.useState<string | null>(null)

	if (profile.role !== "client") return null

	const inProgress = profile.hasEnpProfile && shouldRedirectToOnboarding(profile)

	return (
		<Card className="border-primary/25 bg-primary/5 border shadow-sm">
			<CardHeader>
				<CardTitle className="text-base">
					{inProgress ? "Continue ENP setup" : "Become an Attorney / ENP"}
				</CardTitle>
				<CardDescription className="text-muted-foreground leading-relaxed">
					{inProgress
						? "Finish practice details, certification course, and exam to perform electronic notarization on qLegal. Identity verification is available anytime from Profile."
						: "Offer electronic notarization, manage appointments, QuickSign, and registry listing after certification."}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
					<Button
						type="button"
						size="lg"
						className="min-h-11"
						disabled={bootstrap.isPending}
						onClick={() => {
							setErr(null)
							const run = inProgress ? Promise.resolve() : bootstrap.mutateAsync({ role: "enp" })
							void run
								.then(() => router.push("/onboarding"))
								.catch(e => {
									const msg =
										e &&
										typeof e === "object" &&
										"message" in e &&
										typeof (e as { message: unknown }).message === "string"
											? (e as { message: string }).message
											: "Could not start ENP setup. Try again."
									setErr(msg)
									toast.error(msg)
								})
						}}
					>
						{bootstrap.isPending
							? "Starting…"
							: inProgress
								? "Continue setup"
								: "Get started as ENP"}
					</Button>
					{inProgress ? (
						<CancelEnpOnboardingButton variant="outline" size="lg" className="min-h-11" />
					) : null}
				</div>
				{err ? <p className="text-destructive text-sm">{err}</p> : null}
			</CardContent>
		</Card>
	)
}
