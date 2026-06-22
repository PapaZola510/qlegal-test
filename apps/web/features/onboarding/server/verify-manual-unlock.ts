"use server"

import { env } from "@/env"

/** Gate for onboarding manual-completion controls (staff only). */
export async function verifyOnboardingManualUnlock(password: string): Promise<boolean> {
	const expected = env.ONBOARDING_MANUAL_UNLOCK_PASSWORD?.trim()
	if (!expected) return false
	return password === expected
}
