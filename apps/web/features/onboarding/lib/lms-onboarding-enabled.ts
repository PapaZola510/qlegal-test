import type { UserProfile } from "@repo/contracts"

import { env } from "@/env"

/**
 * QLearn onboarding UI — prefer backend runtime flag (works on staging without a web rebuild).
 * Fall back to build-time `NEXT_PUBLIC_ENABLE_LMS_INTEGRATION` for local stub mode.
 */
export function isLmsOnboardingEnabled(profile?: UserProfile | null): boolean {
	if (profile?.lmsCertificationEnabled) return true
	return env.NEXT_PUBLIC_ENABLE_LMS_INTEGRATION === "true"
}
