import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { shouldRedirectToOnboarding } from "@/features/auth/lib/should-redirect-to-onboarding"
import { loadDashboardProfile } from "@/features/dashboard/server/load-dashboard-profile"
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard"

export const metadata: Metadata = {
	title: "ENP setup",
}

export default async function OnboardingShellPage() {
	const profile = await loadDashboardProfile()
	if (profile && !shouldRedirectToOnboarding(profile)) {
		redirect("/dashboard")
	}

	return (
		<section className="flex min-h-[70vh] flex-1 flex-col py-10 md:py-16">
			<div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
				<OnboardingWizard />
			</div>
		</section>
	)
}
