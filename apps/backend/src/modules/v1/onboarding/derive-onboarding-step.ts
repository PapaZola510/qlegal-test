import type { UserProfile } from "@repo/contracts"
import type { clientProfiles, enpProfiles } from "@repo/db/schema"

type OnboardingStep = UserProfile["onboardingStep"]
type EnpRow = typeof enpProfiles.$inferSelect

/** QLearn hosts course + Final Quiz; in-app cert exam is for non-LMS onboarding only. */
export function isLmsCertificationPath(): boolean {
	return Boolean(process.env.LMS_INTEGRATION_BASE_URL?.trim())
}
function isEnpPracticeProfileComplete(enp: EnpRow): boolean {
	return (
		Boolean(enp.phoneE164?.trim()) &&
		Boolean(enp.rollNo?.trim()) &&
		enp.commissionValidUntil !== null &&
		Boolean(enp.cityProvince?.trim()) &&
		Boolean(enp.notaryAddress?.trim())
	)
}

/** ENP certification path finished — user may use ENP dashboard and API role. KYC is optional via Profile. */
export function isEnpOnboardingComplete(enp: EnpRow | undefined): boolean {
	if (!enp) return false
	if (!isEnpPracticeProfileComplete(enp)) return false
	if (!enp.courseCompletedAt) return false
	if (isLmsCertificationPath()) return true
	if (enp.certificateStatus === "none") return false
	return true
}

function deriveEnpOnboardingStep(enp: EnpRow): OnboardingStep {
	if (!isEnpPracticeProfileComplete(enp)) return "professional_profile"
	if (!enp.courseCompletedAt) return "certification_course"
	if (isLmsCertificationPath()) {
		if (!enp.npnCommissionNo?.trim()) return "commission_details"
		return "complete"
	}
	if (enp.certificateStatus === "none") return "certificate_upload"
	return "complete"
}

/**
 * Single source of truth for `/profile/me` and `/onboarding/progress`.
 * Client-only accounts: always `complete` (no signup onboarding gate).
 * ENP path runs only when `enp_profiles` exists and certification is incomplete.
 */
export function deriveOnboardingStep(
	enp: EnpRow | undefined,
	client: typeof clientProfiles.$inferSelect | undefined
): OnboardingStep {
	if (!enp && !client) return "profile"

	if (client && !enp) return "complete"

	if (enp) {
		return deriveEnpOnboardingStep(enp)
	}

	return "complete"
}
