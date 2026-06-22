import { calendarYmdFromDate } from "@/utils/safe-timestamp"

/** Days-before-expiry when proactive UI warnings should appear (once each per expiry cycle). */
export const COMMISSION_WARNING_DAYS = [30, 20, 10, 5, 3, 1] as const

/** Default snooze for "Remind me later" (hours). */
export const COMMISSION_EXPIRY_REMIND_SNOOZE_HOURS = 24

export type CommissionWarningDay = (typeof COMMISSION_WARNING_DAYS)[number]

export type EnpCommissionBlockCategory =
	| "expired"
	| "revoked"
	| "cancelled"
	| "disqualified"
	| "inactive"
	| "unknown"

export type EnpCommissionValidationStatus = "active" | "expiring" | "blocked"

export type EnpCommissionValidationInput = {
	certificateStatus: "none" | "certified" | "revoked"
	commissionValidUntil: Date | null
	commissionExpiryNoticeDismissals: string[]
	commissionExpiryNoticeSnoozeUntil: Date | null
	scCommissionStatus: string | null
}

export type EnpCommissionValidation = {
	status: EnpCommissionValidationStatus
	blockCategory: EnpCommissionBlockCategory | null
	daysRemaining: number | null
	/** Current warning tier to show when status is `expiring`. */
	warningTier: CommissionWarningDay | null
	blocked: boolean
	blockReason: string | null
	commissionExpiry: string | null
}

export const SC_BLOCKED_COMMISSION_STATUSES = new Set([
	"inactive",
	"cancelled",
	"canceled",
	"revoked",
	"disqualified",
	"suspended",
	"unknown",
])

const SC_BLOCKED_STATUSES = SC_BLOCKED_COMMISSION_STATUSES

export function normalizeScCommissionStatus(value: string | null | undefined): string {
	return String(value ?? "")
		.trim()
		.toLowerCase()
}

export function isScCommissionStatusBlocked(status: string | null | undefined): boolean {
	const normalized = normalizeScCommissionStatus(status)
	return normalized.length > 0 && SC_BLOCKED_COMMISSION_STATUSES.has(normalized)
}

export function commissionWarningDismissKey(expiryYmd: string, tier: CommissionWarningDay): string {
	return `${expiryYmd}:${tier}`
}

/** Whole calendar days until end of commission validity (UTC date). */
export function daysUntilCommissionExpiry(
	commissionValidUntil: Date | null,
	now = new Date()
): number | null {
	if (!commissionValidUntil) return null
	const end = new Date(commissionValidUntil)
	end.setUTCHours(23, 59, 59, 999)
	const diffMs = end.getTime() - now.getTime()
	return Math.ceil(diffMs / (24 * 60 * 60 * 1000))
}

/** Map remaining days to the active warning tier (30 → 20 → … → 1 day buckets). */
export function pickCommissionWarningTier(daysRemaining: number): CommissionWarningDay | null {
	if (daysRemaining <= 0 || daysRemaining > 30) return null
	if (daysRemaining > 20) return 30
	if (daysRemaining > 10) return 20
	if (daysRemaining > 5) return 10
	if (daysRemaining > 3) return 5
	if (daysRemaining > 1) return 3
	return 1
}

function normalizeScStatus(value: string | null | undefined): string {
	return String(value ?? "")
		.trim()
		.toLowerCase()
}

function blockCategoryFromScStatus(scStatus: string): EnpCommissionBlockCategory | null {
	if (scStatus === "inactive") return "inactive"
	if (scStatus === "cancelled" || scStatus === "canceled") return "cancelled"
	if (scStatus === "disqualified") return "disqualified"
	if (scStatus === "revoked" || scStatus === "suspended") return "revoked"
	if (scStatus === "unknown") return "unknown"
	return null
}

function blockReasonForCategory(category: EnpCommissionBlockCategory): string {
	switch (category) {
		case "expired":
			return "Your notarial commission has expired. Renew with the Supreme Court and update your profile before performing notarial acts."
		case "revoked":
			return "Your ENP commission or certification has been revoked. You cannot perform notarial acts until this is resolved."
		case "cancelled":
			return "Your notarial commission has been cancelled. You cannot perform notarial acts until your commission is restored."
		case "disqualified":
			return "Your notarial commission is disqualified. You cannot perform notarial acts until this status is cleared."
		case "inactive":
			return "The Supreme Court reports your notarial commission as inactive. Update your commission before performing notarial acts."
		case "unknown":
			return "Your Supreme Court commission status is unknown. Sync or verify your commission before performing notarial acts."
	}
}

export function deriveEnpCommissionValidation(
	row: EnpCommissionValidationInput,
	now = new Date()
): EnpCommissionValidation {
	const commissionExpiry = calendarYmdFromDate(row.commissionValidUntil ?? undefined)
	const daysRemaining = daysUntilCommissionExpiry(row.commissionValidUntil, now)
	const scStatus = normalizeScStatus(row.scCommissionStatus)

	if (row.certificateStatus === "revoked") {
		return {
			status: "blocked",
			blockCategory: "revoked",
			daysRemaining,
			warningTier: null,
			blocked: true,
			blockReason: blockReasonForCategory("revoked"),
			commissionExpiry,
		}
	}

	const scBlock = blockCategoryFromScStatus(scStatus)
	if (scStatus && SC_BLOCKED_STATUSES.has(scStatus)) {
		const category = scBlock ?? "inactive"
		return {
			status: "blocked",
			blockCategory: category,
			daysRemaining,
			warningTier: null,
			blocked: true,
			blockReason: blockReasonForCategory(category),
			commissionExpiry,
		}
	}

	if (!row.commissionValidUntil || daysRemaining === null || daysRemaining <= 0) {
		return {
			status: "blocked",
			blockCategory: "expired",
			daysRemaining: daysRemaining !== null ? Math.min(daysRemaining, 0) : null,
			warningTier: null,
			blocked: true,
			blockReason: blockReasonForCategory("expired"),
			commissionExpiry,
		}
	}

	const tier = pickCommissionWarningTier(daysRemaining)
	const snoozed =
		row.commissionExpiryNoticeSnoozeUntil !== null &&
		row.commissionExpiryNoticeSnoozeUntil.getTime() > now.getTime()
	const dismissed =
		tier !== null &&
		commissionExpiry !== null &&
		row.commissionExpiryNoticeDismissals.includes(
			commissionWarningDismissKey(commissionExpiry, tier)
		)

	if (tier !== null && !dismissed && !snoozed) {
		return {
			status: "expiring",
			blockCategory: null,
			daysRemaining,
			warningTier: tier,
			blocked: false,
			blockReason: null,
			commissionExpiry,
		}
	}

	return {
		status: "active",
		blockCategory: null,
		daysRemaining,
		warningTier: null,
		blocked: false,
		blockReason: null,
		commissionExpiry,
	}
}

export function commissionExpiryWarningMessage(
	tier: CommissionWarningDay,
	commissionExpiry: string | null
): string {
	const expiryLabel = commissionExpiry ?? "your commission expiry date"
	return `Your notarial commission expires in ${tier} day${tier === 1 ? "" : "s"} (valid until ${expiryLabel}). Renew with the Supreme Court and update your profile to avoid interruption of notarial services.`
}
