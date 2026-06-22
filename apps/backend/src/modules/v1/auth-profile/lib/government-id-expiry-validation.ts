import { calendarYmdFromDate } from "@/utils/safe-timestamp"

import { daysUntilCommissionExpiry } from "./enp-commission-validation"

/** Days-before-expiry when proactive UI warnings should appear (once each per expiry cycle). */
export const GOVERNMENT_ID_WARNING_DAYS = [30, 20, 10, 5, 3, 1] as const

/** Default snooze for "Remind me later" (hours). */
export const GOVERNMENT_ID_EXPIRY_REMIND_SNOOZE_HOURS = 24

export type GovernmentIdWarningDay = (typeof GOVERNMENT_ID_WARNING_DAYS)[number]

export type GovernmentIdValidationStatus = "active" | "expiring" | "blocked"

export type GovernmentIdValidationInput = {
	governmentIdValidUntil: Date | null
	governmentIdExpiryNoticeDismissals: string[]
	governmentIdExpiryNoticeSnoozeUntil: Date | null
}

export type GovernmentIdValidation = {
	status: GovernmentIdValidationStatus
	daysRemaining: number | null
	warningTier: GovernmentIdWarningDay | null
	blocked: boolean
	blockReason: string | null
	governmentIdExpiry: string | null
}

export function governmentIdWarningDismissKey(
	expiryYmd: string,
	tier: GovernmentIdWarningDay
): string {
	return `${expiryYmd}:${tier}`
}

export function daysUntilGovernmentIdExpiry(
	governmentIdValidUntil: Date | null,
	now = new Date()
): number | null {
	return daysUntilCommissionExpiry(governmentIdValidUntil, now)
}

/** Map remaining days to the active warning tier (30 → 20 → … → 1 day buckets). */
export function pickGovernmentIdWarningTier(daysRemaining: number): GovernmentIdWarningDay | null {
	if (daysRemaining <= 0 || daysRemaining > 30) return null
	if (daysRemaining > 20) return 30
	if (daysRemaining > 10) return 20
	if (daysRemaining > 5) return 10
	if (daysRemaining > 3) return 5
	if (daysRemaining > 1) return 3
	return 1
}

function blockReasonExpired(): string {
	return "Your government-issued ID has expired. Complete identity verification again with your renewed ID."
}

export function deriveGovernmentIdValidation(
	row: GovernmentIdValidationInput,
	now = new Date()
): GovernmentIdValidation {
	const governmentIdExpiry = calendarYmdFromDate(row.governmentIdValidUntil ?? undefined)
	const daysRemaining = daysUntilGovernmentIdExpiry(row.governmentIdValidUntil, now)

	if (!row.governmentIdValidUntil) {
		return {
			status: "active",
			daysRemaining: null,
			warningTier: null,
			blocked: false,
			blockReason: null,
			governmentIdExpiry: null,
		}
	}

	if (daysRemaining === null || daysRemaining <= 0) {
		return {
			status: "blocked",
			daysRemaining: daysRemaining !== null ? Math.min(daysRemaining, 0) : null,
			warningTier: null,
			blocked: true,
			blockReason: blockReasonExpired(),
			governmentIdExpiry,
		}
	}

	const tier = pickGovernmentIdWarningTier(daysRemaining)
	const snoozed =
		row.governmentIdExpiryNoticeSnoozeUntil !== null &&
		row.governmentIdExpiryNoticeSnoozeUntil.getTime() > now.getTime()
	const dismissed =
		tier !== null &&
		governmentIdExpiry !== null &&
		row.governmentIdExpiryNoticeDismissals.includes(
			governmentIdWarningDismissKey(governmentIdExpiry, tier)
		)

	if (tier !== null && !dismissed && !snoozed) {
		return {
			status: "expiring",
			daysRemaining,
			warningTier: tier,
			blocked: false,
			blockReason: null,
			governmentIdExpiry,
		}
	}

	return {
		status: "active",
		daysRemaining,
		warningTier: null,
		blocked: false,
		blockReason: null,
		governmentIdExpiry,
	}
}
