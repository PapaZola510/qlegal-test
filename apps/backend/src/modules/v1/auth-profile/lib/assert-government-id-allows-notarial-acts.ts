import { eq } from "drizzle-orm"

import { clientProfiles, enpProfiles } from "@repo/db/schema"

import { db } from "@/common/database/database.client"

import {
	deriveGovernmentIdValidation,
	type GovernmentIdValidationInput,
} from "./government-id-expiry-validation"

export async function assertGovernmentIdAllowsNotarialActs(
	userId: string
): Promise<{ ok: true } | { ok: false; detail: string }> {
	const [enp] = await db
		.select({
			governmentIdValidUntil: enpProfiles.governmentIdValidUntil,
			governmentIdExpiryNoticeDismissals: enpProfiles.governmentIdExpiryNoticeDismissals,
			governmentIdExpiryNoticeSnoozeUntil: enpProfiles.governmentIdExpiryNoticeSnoozeUntil,
		})
		.from(enpProfiles)
		.where(eq(enpProfiles.userId, userId))
		.limit(1)

	if (enp) {
		const validation = deriveGovernmentIdValidation(enp satisfies GovernmentIdValidationInput)
		if (validation.blocked && validation.blockReason) {
			return { ok: false, detail: validation.blockReason }
		}
		return { ok: true }
	}

	const [client] = await db
		.select({
			governmentIdValidUntil: clientProfiles.governmentIdValidUntil,
			governmentIdExpiryNoticeDismissals: clientProfiles.governmentIdExpiryNoticeDismissals,
			governmentIdExpiryNoticeSnoozeUntil: clientProfiles.governmentIdExpiryNoticeSnoozeUntil,
		})
		.from(clientProfiles)
		.where(eq(clientProfiles.userId, userId))
		.limit(1)

	if (!client) {
		return { ok: true }
	}

	const validation = deriveGovernmentIdValidation(client satisfies GovernmentIdValidationInput)
	if (validation.blocked && validation.blockReason) {
		return { ok: false, detail: validation.blockReason }
	}

	return { ok: true }
}
