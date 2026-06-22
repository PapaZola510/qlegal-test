import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { and, desc, eq, isNull } from "drizzle-orm"

import {
	accounts,
	clientProfiles,
	enpProfiles,
	hypervergeTransactions,
	subOrgs,
	users,
} from "@repo/db/schema"

import { DoconchainAdapterService } from "@/services/doconchain/doconchain-adapter.service"
import { db } from "@/common/database/database.client"
import type { QlegalRole } from "@/common/session/qlegal-session.types"
import type { V1Inputs, V1Outputs } from "@/config/contract-types"
import { doconchainOrgEmailFallback, env } from "@/config/env.config"
import {
	effectiveAppRole,
	qlegalRoleFromProfiles,
} from "@/modules/v1/auth-profile/lib/effective-app-role"
import {
	COMMISSION_EXPIRY_REMIND_SNOOZE_HOURS,
	commissionWarningDismissKey,
	deriveEnpCommissionValidation,
} from "@/modules/v1/auth-profile/lib/enp-commission-validation"
import {
	expireClientIdentityIfNeeded,
	expireEnpIdentityIfNeeded,
	expireIdentityIfGovernmentIdExpired,
} from "@/modules/v1/auth-profile/lib/expire-enp-identity-if-needed"
import {
	deriveGovernmentIdValidation,
	GOVERNMENT_ID_EXPIRY_REMIND_SNOOZE_HOURS,
	governmentIdWarningDismissKey,
} from "@/modules/v1/auth-profile/lib/government-id-expiry-validation"
import { syncEnpScCommissionStatusIfStale } from "@/modules/v1/auth-profile/lib/sync-enp-sc-commission-status"
import {
	deriveOnboardingStep,
	isEnpOnboardingComplete,
	isLmsCertificationPath,
} from "@/modules/v1/onboarding/derive-onboarding-step"
import {
	calendarYmdFromDate,
	dateToIsoOrNull,
	ensureSerializableDate,
} from "@/utils/safe-timestamp"

type UserProfileDto = V1Outputs["authProfile"]["me"]
type HypervergeTransactionDto = V1Outputs["authProfile"]["identityHistory"][number]

type UpdateProfileInput = V1Inputs["authProfile"]["update"]
type BootstrapRoleInput = V1Inputs["authProfile"]["bootstrapRole"]
type DismissCommissionExpiryWarningInput = V1Inputs["authProfile"]["dismissCommissionExpiryWarning"]

type IdentityStatusApi = UserProfileDto["identityStatus"]
type CertificateStatusApi = UserProfileDto["certificateStatus"]
type UserRoleApi = UserProfileDto["role"]
type HypervergeStatusApi = HypervergeTransactionDto["status"]

function parseOptionalProfileDate(ymd?: string): Date | null {
	if (!ymd?.trim()) return null
	return new Date(`${ymd.trim()}T12:00:00.000Z`)
}

function mapEnpNotarialSealProfileFields(
	enp: Pick<
		typeof enpProfiles.$inferSelect,
		"rollDate" | "ptrLocation" | "ptrDate" | "ibpDate" | "mclePeriod" | "mcleDate"
	>
) {
	return {
		rollDate: calendarYmdFromDate(enp.rollDate ?? undefined),
		ptrLocation: enp.ptrLocation ?? null,
		ptrDate: calendarYmdFromDate(enp.ptrDate ?? undefined),
		ibpDate: enp.ibpDate ?? null,
		mclePeriod: enp.mclePeriod ?? null,
		mcleDate: calendarYmdFromDate(enp.mcleDate ?? undefined),
	}
}

function mapIdentityFromEnp(
	dbStatus: "unverified" | "pending" | "verified" | "failed"
): IdentityStatusApi {
	switch (dbStatus) {
		case "unverified":
			return "unverified"
		case "pending":
			return "pending"
		case "verified":
			return "verified"
		case "failed":
			return "rejected"
		default:
			return "unverified"
	}
}

function mapCertificateFromEnp(db: "none" | "certified" | "revoked"): CertificateStatusApi {
	switch (db) {
		case "none":
			return "none"
		case "certified":
			return "active"
		case "revoked":
			return "revoked"
		default:
			return "none"
	}
}

function splitDisplayName(name: string): { firstName: string; lastName: string } {
	const trimmed = name.trim()
	const parts = trimmed.split(/\s+/).filter(Boolean)
	if (parts.length === 0) return { firstName: "User", lastName: "." }
	if (parts.length === 1) return { firstName: parts[0]!, lastName: "." }
	return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") }
}

function mapCommissionValidation(
	enp: Pick<
		typeof enpProfiles.$inferSelect,
		| "certificateStatus"
		| "commissionValidUntil"
		| "commissionExpiryNoticeDismissals"
		| "commissionExpiryNoticeSnoozeUntil"
		| "scCommissionStatus"
	>
): UserProfileDto["commissionValidation"] {
	return deriveEnpCommissionValidation({
		certificateStatus: enp.certificateStatus,
		commissionValidUntil: enp.commissionValidUntil,
		commissionExpiryNoticeDismissals: enp.commissionExpiryNoticeDismissals ?? [],
		commissionExpiryNoticeSnoozeUntil: enp.commissionExpiryNoticeSnoozeUntil ?? null,
		scCommissionStatus: enp.scCommissionStatus ?? null,
	})
}

function mapGovernmentIdValidation(
	row: Pick<
		typeof enpProfiles.$inferSelect | typeof clientProfiles.$inferSelect,
		| "governmentIdValidUntil"
		| "governmentIdExpiryNoticeDismissals"
		| "governmentIdExpiryNoticeSnoozeUntil"
	>
): UserProfileDto["governmentIdValidation"] {
	return deriveGovernmentIdValidation({
		governmentIdValidUntil: row.governmentIdValidUntil ?? null,
		governmentIdExpiryNoticeDismissals: row.governmentIdExpiryNoticeDismissals ?? [],
		governmentIdExpiryNoticeSnoozeUntil: row.governmentIdExpiryNoticeSnoozeUntil ?? null,
	})
}

function mapHypervergeStatus(
	db: "started" | "success" | "fail" | "needs_review"
): HypervergeStatusApi {
	switch (db) {
		case "started":
			return "in_progress"
		case "success":
			return "approved"
		case "fail":
			return "rejected"
		case "needs_review":
			return "needs_review"
		default:
			return "pending"
	}
}

function readTxnMeta(raw: unknown): {
	documentType?: string
	confidence?: number | null
	reason?: string | null
} {
	if (!raw || typeof raw !== "object") return {}
	const o = raw as Record<string, unknown>
	const documentType = typeof o.documentType === "string" ? o.documentType : undefined
	const confidence = typeof o.confidence === "number" ? o.confidence : null
	const reason = typeof o.reason === "string" ? o.reason : null
	return { documentType, confidence, reason }
}

@Injectable()
export class AuthProfileService {
	private readonly log = new Logger(AuthProfileService.name)

	constructor(private readonly dc: DoconchainAdapterService) {}

	private async tryAutoJoinDoconchainOrganization(user: typeof users.$inferSelect): Promise<void> {
		const organizationId = env.DOCONCHAIN_ORGANIZATION_ID?.trim()
		if (!organizationId) return

		const orgEmail = doconchainOrgEmailFallback()?.trim()
		if (!orgEmail) {
			this.log.warn(
				`DOCONCHAIN_ORGANIZATION_ID is set but neither DOCONCHAIN_ORG_EMAIL nor DOCONCHAIN_EMAIL is set; skipping auto-join for ${user.email}`
			)
			return
		}

		const { firstName, lastName } = splitDisplayName(user.name)
		const role = env.DOCONCHAIN_ORGANIZATION_MEMBER_ROLE?.trim() || "Member"

		try {
			const token = await this.dc.getAccessToken(orgEmail, { allowMock: false })
			await this.dc.autoJoinMemberInOrganization({
				token,
				email: user.email,
				firstName,
				lastName,
				role,
				organizationId,
			})
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error)
			this.log.warn(`Doconchain auto-join failed for ${user.email}: ${msg}`)
		}
	}

	async ensureClientProfile(userId: string): Promise<UserProfileDto> {
		const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
		if (!userRow || userRow.deletedAt) throw new NotFoundException("User profile not found")

		const [existing] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		if (!existing) {
			const { firstName, lastName } = splitDisplayName(userRow.name)
			const now = new Date()
			await db.insert(clientProfiles).values({
				userId,
				firstName,
				lastName,
				createdAt: now,
				updatedAt: now,
			})
			await this.tryAutoJoinDoconchainOrganization(userRow)
		}

		return this.getProfile(userId, "none")
	}

	async bootstrapRole(userId: string, input: BootstrapRoleInput): Promise<UserProfileDto> {
		const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
		if (!userRow || userRow.deletedAt) throw new NotFoundException("User profile not found")

		if (input.role === "client") {
			return this.ensureClientProfile(userId)
		}

		const [enpBefore] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, userId))
			.limit(1)
		if (enpBefore) {
			await this.tryAutoJoinDoconchainOrganization(userRow)
			const [clientRow] = await db
				.select()
				.from(clientProfiles)
				.where(eq(clientProfiles.userId, userId))
				.limit(1)
			return this.getProfile(
				userId,
				qlegalRoleFromProfiles(userRow.platformRole, enpBefore, clientRow)
			)
		}

		await this.ensureClientProfile(userId)

		const { firstName, lastName } = splitDisplayName(userRow.name)
		const now = new Date()

		await db.transaction(async tx => {
			const [sub] = await tx
				.insert(subOrgs)
				.values({
					ownerId: userId,
					name: `${firstName} ${lastName}`.trim() || "ENP workspace",
					kind: "personal",
					createdAt: now,
					updatedAt: now,
				})
				.returning()
			if (!sub) throw new NotFoundException("Failed to create sub-organization for ENP")

			await tx.insert(enpProfiles).values({
				userId,
				subOrgId: sub.id,
				firstName,
				lastName,
				createdAt: now,
				updatedAt: now,
			})
		})

		await this.tryAutoJoinDoconchainOrganization(userRow)
		const [enpAfter] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, userId))
			.limit(1)
		const [clientAfter] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		return this.getProfile(
			userId,
			qlegalRoleFromProfiles(userRow.platformRole, enpAfter, clientAfter)
		)
	}

	/**
	 * Removes incomplete ENP setup so the account returns to client-only (dashboard, no /onboarding redirect).
	 */
	async cancelEnpOnboarding(userId: string): Promise<UserProfileDto> {
		const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
		if (!userRow || userRow.deletedAt) throw new NotFoundException("User profile not found")

		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		if (!enp) {
			throw new NotFoundException("No ENP profile found")
		}
		if (isEnpOnboardingComplete(enp)) {
			throw new BadRequestException(
				"ENP setup cannot be cancelled after certification is complete. Contact support if you need help."
			)
		}

		const subOrgId = enp.subOrgId
		const now = new Date()

		await db.transaction(async tx => {
			await tx.delete(enpProfiles).where(eq(enpProfiles.userId, userId))
			await tx
				.update(subOrgs)
				.set({ deletedAt: now, updatedAt: now })
				.where(
					and(
						eq(subOrgs.id, subOrgId),
						eq(subOrgs.ownerId, userId),
						eq(subOrgs.kind, "personal"),
						isNull(subOrgs.deletedAt)
					)
				)
		})

		await this.ensureClientProfile(userId)
		const [clientRow] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		return this.getProfile(
			userId,
			qlegalRoleFromProfiles(userRow.platformRole, undefined, clientRow)
		)
	}

	async getProfile(userId: string, _qlegalRole: QlegalRole): Promise<UserProfileDto> {
		const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
		if (!userRow || userRow.deletedAt) throw new NotFoundException("User profile not found")

		// Google OAuth users should be treated as verified.
		let emailVerified = userRow.emailVerified
		if (!emailVerified) {
			const [google] = await db
				.select({ id: accounts.accountId })
				.from(accounts)
				.where(and(eq(accounts.userId, userId), eq(accounts.providerId, "google")))
				.limit(1)
			if (google) {
				emailVerified = true
				await db
					.update(users)
					.set({ emailVerified: true, updatedAt: new Date() })
					.where(eq(users.id, userId))
			}
		}

		let [enpRow] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, userId))
			.limit(1)
		let [clientRow] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)

		if (!enpRow && !clientRow) {
			const { firstName, lastName } = splitDisplayName(userRow.name)
			const now = new Date()
			await db.insert(clientProfiles).values({
				userId,
				firstName,
				lastName,
				createdAt: now,
				updatedAt: now,
			})
			await this.tryAutoJoinDoconchainOrganization(userRow)
			;[clientRow] = await db
				.select()
				.from(clientProfiles)
				.where(eq(clientProfiles.userId, userId))
				.limit(1)
		}

		await expireIdentityIfGovernmentIdExpired(userId)
		if (enpRow) {
			await expireEnpIdentityIfNeeded(userId)
			try {
				await syncEnpScCommissionStatusIfStale(userId)
			} catch {
				// SC sync is best-effort; profile load must not fail when SC is unreachable.
			}
			;[enpRow] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		}
		if (clientRow) {
			await expireClientIdentityIfNeeded(userId)
			;[clientRow] = await db
				.select()
				.from(clientProfiles)
				.where(eq(clientProfiles.userId, userId))
				.limit(1)
		}

		const role = effectiveAppRole(userRow.platformRole, enpRow, clientRow) as UserRoleApi
		const validityDays = env.KYC_VERIFICATION_VALIDITY_DAYS
		const onboardingStep = deriveOnboardingStep(enpRow, clientRow)
		const hasEnpProfile = Boolean(enpRow)
		const lmsCertificationEnabled = isLmsCertificationPath()

		if (role === "enp" && enpRow) {
			return {
				id: userRow.id,
				email: userRow.email,
				emailVerified,
				name: userRow.name,
				role,
				complianceAuditAccess: userRow.complianceAuditAccess ?? false,
				avatarUrl: userRow.image ?? null,
				phone: enpRow.phoneE164 ?? null,
				organization: null,
				position: null,
				namePrefix: enpRow.prefix ?? null,
				rollNumber: enpRow.rollNo ?? null,
				...mapEnpNotarialSealProfileFields(enpRow),
				regionProvinceCity: enpRow.cityProvince ?? null,
				officeAddress: enpRow.notaryAddress ?? null,
				ptrNumber: enpRow.ptrNo ?? null,
				ibpNumber: enpRow.ibpNo ?? null,
				mcleNumber: enpRow.mcleNo ?? null,
				residentialAddress: enpRow.homeStreet ?? null,
				commissionArea: enpRow.cityProvince ?? null,
				identityStatus: mapIdentityFromEnp(enpRow.identityStatus),
				certificateStatus: mapCertificateFromEnp(enpRow.certificateStatus),
				onboardingStep,
				commissionNumber: enpRow.npnCommissionNo ?? null,
				commissionExpiry: calendarYmdFromDate(enpRow.commissionValidUntil ?? undefined),
				certificateId: enpRow.certificateId ?? null,
				subOrgId: enpRow.subOrgId,
				identityLastExpiredAt: dateToIsoOrNull(enpRow.identityLastExpiredAt ?? undefined),
				identityVerificationValidityDays: validityDays,
				hasEnpProfile,
				directorySpecializations: (enpRow.directorySpecializations ??
					[]) as UserProfileDto["directorySpecializations"],
				lmsCertificationEnabled,
				commissionValidation: mapCommissionValidation(enpRow),
				governmentIdExpiry: calendarYmdFromDate(enpRow.governmentIdValidUntil ?? undefined),
				governmentIdValidation: mapGovernmentIdValidation(enpRow),
				termsAcceptedAt: userRow.termsAcceptedAt?.toISOString() ?? null,
				createdAt: ensureSerializableDate(userRow.createdAt),
				updatedAt: ensureSerializableDate(userRow.updatedAt),
			}
		}

		if (clientRow) {
			const enpInProgress = Boolean(enpRow && !isEnpOnboardingComplete(enpRow))
			const sealFields =
				enpInProgress && enpRow
					? mapEnpNotarialSealProfileFields(enpRow)
					: {
							rollDate: null,
							ptrLocation: null,
							ptrDate: null,
							ibpDate: null,
							mclePeriod: null,
							mcleDate: null,
						}
			return {
				id: userRow.id,
				email: userRow.email,
				emailVerified,
				name: userRow.name,
				role,
				complianceAuditAccess: userRow.complianceAuditAccess ?? false,
				avatarUrl: userRow.image ?? null,
				phone: clientRow.phoneE164 ?? null,
				organization: clientRow.organization ?? null,
				position: clientRow.position ?? null,
				namePrefix: enpInProgress ? (enpRow?.prefix ?? null) : null,
				rollNumber: enpInProgress ? (enpRow?.rollNo ?? null) : null,
				...sealFields,
				regionProvinceCity: enpInProgress ? (enpRow?.cityProvince ?? null) : null,
				officeAddress: enpInProgress ? (enpRow?.notaryAddress ?? null) : null,
				ptrNumber: enpInProgress ? (enpRow?.ptrNo ?? null) : null,
				ibpNumber: enpInProgress ? (enpRow?.ibpNo ?? null) : null,
				mcleNumber: enpInProgress ? (enpRow?.mcleNo ?? null) : null,
				residentialAddress: enpInProgress
					? (enpRow?.homeStreet ?? null)
					: (clientRow.homeStreet ?? null),
				commissionArea: enpInProgress ? (enpRow?.cityProvince ?? null) : null,
				identityStatus: mapIdentityFromEnp(
					enpInProgress && enpRow ? enpRow.identityStatus : clientRow.identityStatus
				),
				certificateStatus:
					enpInProgress && enpRow ? mapCertificateFromEnp(enpRow.certificateStatus) : "none",
				onboardingStep,
				commissionNumber: null,
				commissionExpiry: null,
				certificateId: null,
				subOrgId: clientRow.subOrgId ?? null,
				identityLastExpiredAt: dateToIsoOrNull(clientRow.identityLastExpiredAt ?? undefined),
				identityVerificationValidityDays: validityDays,
				hasEnpProfile,
				lmsCertificationEnabled,
				commissionValidation: enpInProgress && enpRow ? mapCommissionValidation(enpRow) : null,
				governmentIdExpiry: calendarYmdFromDate(clientRow.governmentIdValidUntil ?? undefined),
				governmentIdValidation: mapGovernmentIdValidation(clientRow),
				termsAcceptedAt: userRow.termsAcceptedAt?.toISOString() ?? null,
				createdAt: ensureSerializableDate(userRow.createdAt),
				updatedAt: ensureSerializableDate(userRow.updatedAt),
			}
		}

		return {
			id: userRow.id,
			email: userRow.email,
			emailVerified,
			name: userRow.name,
			role: "client",
			complianceAuditAccess: userRow.complianceAuditAccess ?? false,
			avatarUrl: userRow.image ?? null,
			phone: null,
			organization: null,
			position: null,
			namePrefix: null,
			rollNumber: null,
			rollDate: null,
			regionProvinceCity: null,
			officeAddress: null,
			ptrNumber: null,
			ptrLocation: null,
			ptrDate: null,
			ibpNumber: null,
			ibpDate: null,
			mclePeriod: null,
			mcleNumber: null,
			mcleDate: null,
			residentialAddress: null,
			commissionArea: null,
			identityStatus: "unverified",
			certificateStatus: "none",
			onboardingStep: "complete",
			commissionNumber: null,
			commissionExpiry: null,
			certificateId: null,
			subOrgId: null,
			identityLastExpiredAt: null,
			identityVerificationValidityDays: validityDays,
			hasEnpProfile: false,
			lmsCertificationEnabled,
			commissionValidation: null,
			governmentIdExpiry: null,
			governmentIdValidation: null,
			termsAcceptedAt: userRow.termsAcceptedAt?.toISOString() ?? null,
			createdAt: ensureSerializableDate(userRow.createdAt),
			updatedAt: ensureSerializableDate(userRow.updatedAt),
		}
	}

	async acceptTerms(userId: string): Promise<{ acceptedAt: string }> {
		const now = new Date()
		await db.update(users).set({ termsAcceptedAt: now, updatedAt: now }).where(eq(users.id, userId))
		return { acceptedAt: now.toISOString() }
	}

	async updateProfile(userId: string, data: UpdateProfileInput): Promise<UserProfileDto> {
		const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
		if (!userRow || userRow.deletedAt) throw new NotFoundException("User profile not found")

		const now = new Date()
		const userPatch: Partial<typeof users.$inferInsert> = { updatedAt: now }
		if (data.name !== undefined) userPatch.name = data.name
		if (data.avatarUrl !== undefined) userPatch.image = data.avatarUrl

		if (Object.keys(userPatch).length > 1) {
			await db.update(users).set(userPatch).where(eq(users.id, userId))
		}

		const [enpRow] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, userId))
			.limit(1)
		const [clientRow] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)

		if (data.name !== undefined) {
			const { firstName, lastName } = splitDisplayName(data.name)
			if (enpRow) {
				await db
					.update(enpProfiles)
					.set({ firstName, lastName, updatedAt: now })
					.where(eq(enpProfiles.userId, userId))
			}
			if (clientRow) {
				await db
					.update(clientProfiles)
					.set({ firstName, lastName, updatedAt: now })
					.where(eq(clientProfiles.userId, userId))
			}
		}

		if (data.phone !== undefined) {
			if (enpRow) {
				await db
					.update(enpProfiles)
					.set({ phoneE164: data.phone || null, updatedAt: now })
					.where(eq(enpProfiles.userId, userId))
			}
			if (clientRow) {
				await db
					.update(clientProfiles)
					.set({ phoneE164: data.phone || null, updatedAt: now })
					.where(eq(clientProfiles.userId, userId))
			}
		}

		if (data.governmentIdExpiry !== undefined && (enpRow || clientRow)) {
			throw new BadRequestException(
				"Government ID expiration is set from identity verification and cannot be edited manually."
			)
		}

		if (clientRow) {
			const clientPatch: Partial<typeof clientProfiles.$inferInsert> = { updatedAt: now }
			let clientDirty = false
			if (data.organization !== undefined) {
				clientPatch.organization = data.organization || null
				clientDirty = true
			}
			if (data.position !== undefined) {
				clientPatch.position = data.position || null
				clientDirty = true
			}
			if (data.residentialAddress !== undefined) {
				clientPatch.homeStreet = data.residentialAddress || null
				clientDirty = true
			}
			if (clientDirty) {
				await db.update(clientProfiles).set(clientPatch).where(eq(clientProfiles.userId, userId))
			}
		}

		if (enpRow) {
			const enpPatch: Partial<typeof enpProfiles.$inferInsert> = { updatedAt: now }
			let dirty = false
			if (data.namePrefix !== undefined) {
				enpPatch.prefix = data.namePrefix || null
				dirty = true
			}
			if (data.rollNumber !== undefined) {
				enpPatch.rollNo = data.rollNumber || null
				dirty = true
			}
			if (data.commissionNumber !== undefined) {
				enpPatch.npnCommissionNo = data.commissionNumber || null
				dirty = true
			}
			if (data.regionProvinceCity !== undefined) {
				enpPatch.cityProvince = data.regionProvinceCity || null
				dirty = true
			}
			if (data.commissionArea !== undefined) {
				enpPatch.cityProvince = data.commissionArea || null
				dirty = true
			}
			if (data.officeAddress !== undefined) {
				enpPatch.notaryAddress = data.officeAddress || null
				dirty = true
			}
			if (data.rollDate !== undefined) {
				enpPatch.rollDate = parseOptionalProfileDate(data.rollDate)
				dirty = true
			}
			if (data.ptrNumber !== undefined) {
				enpPatch.ptrNo = data.ptrNumber || null
				dirty = true
			}
			if (data.ptrLocation !== undefined) {
				enpPatch.ptrLocation = data.ptrLocation || null
				dirty = true
			}
			if (data.ptrDate !== undefined) {
				enpPatch.ptrDate = parseOptionalProfileDate(data.ptrDate)
				dirty = true
			}
			if (data.ibpNumber !== undefined) {
				enpPatch.ibpNo = data.ibpNumber || null
				dirty = true
			}
			if (data.ibpDate !== undefined) {
				enpPatch.ibpDate = data.ibpDate?.trim() || null
				dirty = true
			}
			if (data.mclePeriod !== undefined) {
				enpPatch.mclePeriod = data.mclePeriod || null
				dirty = true
			}
			if (data.mcleNumber !== undefined) {
				enpPatch.mcleNo = data.mcleNumber || null
				dirty = true
			}
			if (data.mcleDate !== undefined) {
				enpPatch.mcleDate = parseOptionalProfileDate(data.mcleDate)
				dirty = true
			}
			if (data.residentialAddress !== undefined) {
				enpPatch.homeStreet = data.residentialAddress || null
				dirty = true
			}
			if (data.commissionExpiry !== undefined) {
				const nextUntil = data.commissionExpiry
					? new Date(`${data.commissionExpiry}T12:00:00.000Z`)
					: null
				const prevYmd = calendarYmdFromDate(enpRow?.commissionValidUntil ?? undefined)
				if (prevYmd !== (data.commissionExpiry || null)) {
					enpPatch.commissionExpiryNoticeDismissals = []
					enpPatch.commissionExpiryNoticeSnoozeUntil = null
				}
				enpPatch.commissionValidUntil = nextUntil
				dirty = true
			}
			if (dirty) {
				await db.update(enpProfiles).set(enpPatch).where(eq(enpProfiles.userId, userId))
			}
		}

		const [enpAfter] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, userId))
			.limit(1)
		const [clientAfter] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		const [uAfter] = await db
			.select({ platformRole: users.platformRole })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)

		return this.getProfile(
			userId,
			qlegalRoleFromProfiles(uAfter?.platformRole ?? "none", enpAfter, clientAfter)
		)
	}

	async dismissIdentityExpiryNotice(userId: string): Promise<{ ok: true }> {
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		const [client] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		const now = new Date()
		if (enp) {
			await db
				.update(enpProfiles)
				.set({ identityLastExpiredAt: null, updatedAt: now })
				.where(eq(enpProfiles.userId, userId))
			return { ok: true as const }
		}
		if (client) {
			await db
				.update(clientProfiles)
				.set({ identityLastExpiredAt: null, updatedAt: now })
				.where(eq(clientProfiles.userId, userId))
			return { ok: true as const }
		}
		throw new NotFoundException("Profile not found")
	}

	async dismissCommissionExpiryWarning(
		userId: string,
		input: DismissCommissionExpiryWarningInput
	): Promise<UserProfileDto> {
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		if (!enp) throw new NotFoundException("ENP profile not found")

		const validation = deriveEnpCommissionValidation({
			certificateStatus: enp.certificateStatus,
			commissionValidUntil: enp.commissionValidUntil,
			commissionExpiryNoticeDismissals: enp.commissionExpiryNoticeDismissals ?? [],
			commissionExpiryNoticeSnoozeUntil: enp.commissionExpiryNoticeSnoozeUntil ?? null,
			scCommissionStatus: enp.scCommissionStatus ?? null,
		})

		if (!validation.commissionExpiry || validation.warningTier !== input.warningDay) {
			throw new BadRequestException("No commission expiry warning is active for this tier.")
		}

		const key = commissionWarningDismissKey(validation.commissionExpiry, input.warningDay)
		const dismissals = enp.commissionExpiryNoticeDismissals ?? []
		if (!dismissals.includes(key)) {
			const now = new Date()
			await db
				.update(enpProfiles)
				.set({
					commissionExpiryNoticeDismissals: [...dismissals, key],
					updatedAt: now,
				})
				.where(eq(enpProfiles.userId, userId))
		}

		const [u] = await db
			.select({ platformRole: users.platformRole })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)
		const [enpAfter] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, userId))
			.limit(1)
		const [clientAfter] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		return this.getProfile(
			userId,
			qlegalRoleFromProfiles(u?.platformRole ?? "none", enpAfter, clientAfter)
		)
	}

	async snoozeCommissionExpiryWarning(
		userId: string,
		input?: { hours?: number }
	): Promise<UserProfileDto> {
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		if (!enp) throw new NotFoundException("ENP profile not found")

		const validation = deriveEnpCommissionValidation({
			certificateStatus: enp.certificateStatus,
			commissionValidUntil: enp.commissionValidUntil,
			commissionExpiryNoticeDismissals: enp.commissionExpiryNoticeDismissals ?? [],
			commissionExpiryNoticeSnoozeUntil: enp.commissionExpiryNoticeSnoozeUntil ?? null,
			scCommissionStatus: enp.scCommissionStatus ?? null,
		})

		if (validation.warningTier === null || validation.blocked) {
			throw new BadRequestException("No commission expiry warning is active to snooze.")
		}

		const hours = input?.hours ?? COMMISSION_EXPIRY_REMIND_SNOOZE_HOURS
		if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 14) {
			throw new BadRequestException("Snooze hours must be between 1 and 336.")
		}

		const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000)
		await db
			.update(enpProfiles)
			.set({
				commissionExpiryNoticeSnoozeUntil: snoozeUntil,
				updatedAt: new Date(),
			})
			.where(eq(enpProfiles.userId, userId))

		const [u] = await db
			.select({ platformRole: users.platformRole })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)
		const [enpAfter] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, userId))
			.limit(1)
		const [clientAfter] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		return this.getProfile(
			userId,
			qlegalRoleFromProfiles(u?.platformRole ?? "none", enpAfter, clientAfter)
		)
	}

	async dismissGovernmentIdExpiryWarning(
		userId: string,
		input: V1Inputs["authProfile"]["dismissGovernmentIdExpiryWarning"]
	): Promise<UserProfileDto> {
		const profile = await this.loadGovernmentIdProfileRow(userId)
		const validation = deriveGovernmentIdValidation({
			governmentIdValidUntil: profile.row.governmentIdValidUntil,
			governmentIdExpiryNoticeDismissals: profile.row.governmentIdExpiryNoticeDismissals ?? [],
			governmentIdExpiryNoticeSnoozeUntil: profile.row.governmentIdExpiryNoticeSnoozeUntil ?? null,
		})

		if (!validation.governmentIdExpiry || validation.warningTier !== input.warningDay) {
			throw new BadRequestException("No government ID expiry warning is active for this tier.")
		}

		const key = governmentIdWarningDismissKey(validation.governmentIdExpiry, input.warningDay)
		const dismissals = profile.row.governmentIdExpiryNoticeDismissals ?? []
		if (!dismissals.includes(key)) {
			const now = new Date()
			const patch = {
				governmentIdExpiryNoticeDismissals: [...dismissals, key],
				updatedAt: now,
			}
			if (profile.kind === "enp") {
				await db.update(enpProfiles).set(patch).where(eq(enpProfiles.userId, userId))
			} else {
				await db.update(clientProfiles).set(patch).where(eq(clientProfiles.userId, userId))
			}
		}

		return this.reloadProfileAfterGovIdMutation(userId)
	}

	async snoozeGovernmentIdExpiryWarning(
		userId: string,
		input?: V1Inputs["authProfile"]["snoozeGovernmentIdExpiryWarning"]
	): Promise<UserProfileDto> {
		const profile = await this.loadGovernmentIdProfileRow(userId)
		const validation = deriveGovernmentIdValidation({
			governmentIdValidUntil: profile.row.governmentIdValidUntil,
			governmentIdExpiryNoticeDismissals: profile.row.governmentIdExpiryNoticeDismissals ?? [],
			governmentIdExpiryNoticeSnoozeUntil: profile.row.governmentIdExpiryNoticeSnoozeUntil ?? null,
		})

		if (validation.warningTier === null || validation.blocked) {
			throw new BadRequestException("No government ID expiry warning is active to snooze.")
		}

		const hours = input?.hours ?? GOVERNMENT_ID_EXPIRY_REMIND_SNOOZE_HOURS
		if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 14) {
			throw new BadRequestException("Snooze hours must be between 1 and 336.")
		}

		const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000)
		const patch = {
			governmentIdExpiryNoticeSnoozeUntil: snoozeUntil,
			updatedAt: new Date(),
		}
		if (profile.kind === "enp") {
			await db.update(enpProfiles).set(patch).where(eq(enpProfiles.userId, userId))
		} else {
			await db.update(clientProfiles).set(patch).where(eq(clientProfiles.userId, userId))
		}

		return this.reloadProfileAfterGovIdMutation(userId)
	}

	private async loadGovernmentIdProfileRow(userId: string): Promise<
		| {
				kind: "enp"
				row: Pick<
					typeof enpProfiles.$inferSelect,
					| "governmentIdValidUntil"
					| "governmentIdExpiryNoticeDismissals"
					| "governmentIdExpiryNoticeSnoozeUntil"
				>
		  }
		| {
				kind: "client"
				row: Pick<
					typeof clientProfiles.$inferSelect,
					| "governmentIdValidUntil"
					| "governmentIdExpiryNoticeDismissals"
					| "governmentIdExpiryNoticeSnoozeUntil"
				>
		  }
	> {
		const [enp] = await db
			.select({
				governmentIdValidUntil: enpProfiles.governmentIdValidUntil,
				governmentIdExpiryNoticeDismissals: enpProfiles.governmentIdExpiryNoticeDismissals,
				governmentIdExpiryNoticeSnoozeUntil: enpProfiles.governmentIdExpiryNoticeSnoozeUntil,
			})
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, userId))
			.limit(1)
		if (enp) return { kind: "enp", row: enp }

		const [client] = await db
			.select({
				governmentIdValidUntil: clientProfiles.governmentIdValidUntil,
				governmentIdExpiryNoticeDismissals: clientProfiles.governmentIdExpiryNoticeDismissals,
				governmentIdExpiryNoticeSnoozeUntil: clientProfiles.governmentIdExpiryNoticeSnoozeUntil,
			})
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		if (client) return { kind: "client", row: client }

		throw new NotFoundException("Profile not found")
	}

	private async reloadProfileAfterGovIdMutation(userId: string): Promise<UserProfileDto> {
		const [u] = await db
			.select({ platformRole: users.platformRole })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)
		const [enpAfter] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, userId))
			.limit(1)
		const [clientAfter] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		return this.getProfile(
			userId,
			qlegalRoleFromProfiles(u?.platformRole ?? "none", enpAfter, clientAfter)
		)
	}

	async getIdentityHistory(userId: string): Promise<HypervergeTransactionDto[]> {
		const rows = await db
			.select()
			.from(hypervergeTransactions)
			.where(
				and(eq(hypervergeTransactions.userId, userId), isNull(hypervergeTransactions.deletedAt))
			)
			.orderBy(desc(hypervergeTransactions.createdAt))

		return rows.map(row => {
			const meta = readTxnMeta(row.rawResponseJson)
			return {
				id: row.id,
				userId: row.userId,
				status: mapHypervergeStatus(row.status),
				transactionId: row.hvTransactionId ?? row.id,
				documentType: meta.documentType ?? "Identity verification",
				confidence: meta.confidence ?? null,
				reason: meta.reason ?? null,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			}
		})
	}
}
