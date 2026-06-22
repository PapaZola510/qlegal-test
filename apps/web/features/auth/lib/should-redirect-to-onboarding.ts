import type { UserProfile } from "@repo/contracts"

/** Certification must be done before dashboard; commission/review are follow-up only. */
const ENP_DASHBOARD_BLOCKED_STEPS = new Set<UserProfile["onboardingStep"]>([
	"profile",
	"client_profile",
	"professional_profile",
	"identity_verification",
	"certification_course",
	"certificate_upload",
])

/** Redirect to `/onboarding` only when ENP setup is in progress and not finished. */
export function shouldRedirectToOnboarding(
	profile: Pick<UserProfile, "hasEnpProfile" | "onboardingStep">
): boolean {
	if (!profile.hasEnpProfile) return false
	if (profile.onboardingStep === "complete") return false
	return ENP_DASHBOARD_BLOCKED_STEPS.has(profile.onboardingStep)
}
