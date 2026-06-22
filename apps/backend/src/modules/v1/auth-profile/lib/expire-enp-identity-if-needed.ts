import { eq } from "drizzle-orm"

import { clientProfiles, enpProfiles } from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import { env } from "@/config/env.config"

import { deriveGovernmentIdValidation } from "./government-id-expiry-validation"

/**
 * When the saved government ID expiration date has passed, reset HyperVerge identity so the user must
 * complete KYC again (typically with a renewed ID).
 */
export async function expireIdentityIfGovernmentIdExpired(userId: string): Promise<boolean> {
	try {
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		if (enp) {
			const validation = deriveGovernmentIdValidation({
				governmentIdValidUntil: enp.governmentIdValidUntil,
				governmentIdExpiryNoticeDismissals: enp.governmentIdExpiryNoticeDismissals ?? [],
				governmentIdExpiryNoticeSnoozeUntil: enp.governmentIdExpiryNoticeSnoozeUntil,
			})
			if (!validation.blocked || enp.identityStatus !== "verified") {
				return false
			}
			const now = new Date()
			await db
				.update(enpProfiles)
				.set({
					identityStatus: "unverified",
					identityVerifiedAt: null,
					identityLastExpiredAt: now,
					updatedAt: now,
				})
				.where(eq(enpProfiles.userId, userId))
			return true
		}

		const [client] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		if (!client) return false

		const validation = deriveGovernmentIdValidation({
			governmentIdValidUntil: client.governmentIdValidUntil,
			governmentIdExpiryNoticeDismissals: client.governmentIdExpiryNoticeDismissals ?? [],
			governmentIdExpiryNoticeSnoozeUntil: client.governmentIdExpiryNoticeSnoozeUntil,
		})
		if (!validation.blocked || client.identityStatus !== "verified") {
			return false
		}

		const now = new Date()
		await db
			.update(clientProfiles)
			.set({
				identityStatus: "unverified",
				identityVerifiedAt: null,
				identityLastExpiredAt: now,
				updatedAt: now,
			})
			.where(eq(clientProfiles.userId, userId))
		return true
	} catch (e) {
		console.error("[expireIdentityIfGovernmentIdExpired] Failed:", e)
		return false
	}
}

/**
 * If ENP identity is verified and older than {@link env.KYC_VERIFICATION_VALIDITY_DAYS}, reset to require
 * re-verification (quanby `expireUserKycIfNeeded` parity).
 *
 * @returns true if an expiry update was applied this call
 */
export async function expireEnpIdentityIfNeeded(userId: string): Promise<boolean> {
	try {
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		if (!enp || enp.identityStatus !== "verified" || !enp.identityVerifiedAt) {
			return false
		}

		const validityMs = env.KYC_VERIFICATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000
		const ageMs = Date.now() - enp.identityVerifiedAt.getTime()
		if (ageMs < validityMs) {
			return false
		}

		const now = new Date()
		await db
			.update(enpProfiles)
			.set({
				identityStatus: "unverified",
				identityVerifiedAt: null,
				identityLastExpiredAt: now,
				updatedAt: now,
			})
			.where(eq(enpProfiles.userId, userId))

		return true
	} catch (e) {
		console.error("[expireEnpIdentityIfNeeded] Failed:", e)
		return false
	}
}

/** Same validity window as ENP, for principal (client) HyperVerge identity on `client_profiles`. */
export async function expireClientIdentityIfNeeded(userId: string): Promise<boolean> {
	try {
		const [client] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		if (!client || client.identityStatus !== "verified" || !client.identityVerifiedAt) {
			return false
		}

		const validityMs = env.KYC_VERIFICATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000
		const ageMs = Date.now() - client.identityVerifiedAt.getTime()
		if (ageMs < validityMs) {
			return false
		}

		const now = new Date()
		await db
			.update(clientProfiles)
			.set({
				identityStatus: "unverified",
				identityVerifiedAt: null,
				identityLastExpiredAt: now,
				updatedAt: now,
			})
			.where(eq(clientProfiles.userId, userId))

		return true
	} catch (e) {
		console.error("[expireClientIdentityIfNeeded] Failed:", e)
		return false
	}
}
