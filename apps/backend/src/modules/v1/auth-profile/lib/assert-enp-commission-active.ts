import { eq } from "drizzle-orm"

import { enpProfiles } from "@repo/db/schema"

import { db } from "@/common/database/database.client"

import {
	deriveEnpCommissionValidation,
	type EnpCommissionValidationInput,
} from "./enp-commission-validation"

export async function assertEnpCommissionAllowsNotarialActs(
	userId: string
): Promise<{ ok: true } | { ok: false; detail: string }> {
	const [enp] = await db
		.select({
			certificateStatus: enpProfiles.certificateStatus,
			commissionValidUntil: enpProfiles.commissionValidUntil,
			commissionExpiryNoticeDismissals: enpProfiles.commissionExpiryNoticeDismissals,
			commissionExpiryNoticeSnoozeUntil: enpProfiles.commissionExpiryNoticeSnoozeUntil,
			scCommissionStatus: enpProfiles.scCommissionStatus,
		})
		.from(enpProfiles)
		.where(eq(enpProfiles.userId, userId))
		.limit(1)

	if (!enp) {
		return { ok: false, detail: "ENP profile is required." }
	}

	const validation = deriveEnpCommissionValidation(enp satisfies EnpCommissionValidationInput)
	if (validation.blocked) {
		return {
			ok: false,
			detail: validation.blockReason ?? "Your notarial commission is not active.",
		}
	}

	return { ok: true }
}
