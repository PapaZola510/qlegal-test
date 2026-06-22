"use client"

import { RealOnboardingFlow } from "@/features/onboarding/components/real-onboarding-flow"

/** Google SSO users land here when `/profile/me` reports onboarding is not yet complete. */
export function OnboardingWizard() {
	return <RealOnboardingFlow />
}
