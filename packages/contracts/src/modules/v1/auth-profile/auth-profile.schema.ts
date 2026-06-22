import { z } from "zod"

import { AppointmentNotarizationTypeEnum } from "../appointments/appointments.schema.js"
import {
	CertificateStatusEnum,
	HypervergeStatusEnum,
	IdentityStatusEnum,
	OnboardingStepEnum,
	UserRoleEnum,
} from "../shared/enums.js"
import { TimestampFields } from "../shared/schemas.js"

export const UserProfileSchema = z.object({
	id: z.string(),
	email: z.string().email(),
	emailVerified: z.boolean(),
	name: z.string(),
	role: UserRoleEnum,
	complianceAuditAccess: z.boolean(),
	avatarUrl: z.string().nullable(),
	phone: z.string().nullable(),
	/** Client-only; null when not a client or unset */
	organization: z.string().nullable(),
	position: z.string().nullable(),
	/** ENP name prefix (Atty., etc.); null for clients */
	namePrefix: z.string().nullable(),
	/** IBP roll number (ENP onboarding) */
	rollNumber: z.string().nullable(),
	/** Roll of Attorneys admission date (`YYYY-MM-DD`) for notarial seal */
	rollDate: z.string().nullable(),
	/** Region / province / city (ENP) */
	regionProvinceCity: z.string().nullable(),
	/** Full office address for notarial practice (ENP) */
	officeAddress: z.string().nullable(),
	identityStatus: IdentityStatusEnum,
	certificateStatus: CertificateStatusEnum,
	onboardingStep: OnboardingStepEnum,
	commissionNumber: z.string().nullable(),
	commissionExpiry: z.string().nullable(),
	/** Professional Tax Receipt number (ENP) */
	ptrNumber: z.string().nullable(),
	/** PTR place of issuance (ENP notarial seal) */
	ptrLocation: z.string().nullable(),
	/** PTR date of issuance (`YYYY-MM-DD`) */
	ptrDate: z.string().nullable(),
	/** Integrated Bar of the Philippines membership number (ENP) */
	ibpNumber: z.string().nullable(),
	/** IBP membership date or validity note for notarial seal */
	ibpDate: z.string().nullable(),
	/** MCLE compliance note for notarial seal (e.g. `Valid until 12/30/2026`) */
	mclePeriod: z.string().nullable(),
	/** MCLE compliance number (ENP) */
	mcleNumber: z.string().nullable(),
	/** MCLE compliance date (`YYYY-MM-DD`) */
	mcleDate: z.string().nullable(),
	/** Home / residential address (client principals and ENP) */
	residentialAddress: z.string().nullable(),
	/** Notarial commission jurisdiction (ENP); stored with region/city */
	commissionArea: z.string().nullable(),
	/** Issued ENP certificate public id (e.g. QL-ENP-…); null until certified */
	certificateId: z.string().nullable(),
	subOrgId: z.string().nullable(),
	/** ISO timestamp when identity last lapsed (post-expiry notice); cleared on dismiss or new verification */
	identityLastExpiredAt: z.string().nullable(),
	/** Configured validity window for identity checks (days); same semantics as quanby `kycVerificationValidityDays` */
	identityVerificationValidityDays: z.number().int().positive(),
	/** True when `enp_profiles` exists (ENP setup started or complete) */
	hasEnpProfile: z.boolean(),
	/** Acts this ENP offers in the directory; empty means all SC acts. ENP-only. */
	directorySpecializations: z.array(AppointmentNotarizationTypeEnum).optional(),
	/** True when backend QLearn LMS integration is configured (`LMS_INTEGRATION_BASE_URL`). */
	lmsCertificationEnabled: z.boolean(),
	/** ISO timestamp when the user accepted the T&C / Data Privacy Act consent. Null = not yet accepted. */
	termsAcceptedAt: z.string().datetime().nullable(),
	/** ENP commission validation for expiry warnings and notarial-act blocking; null for clients. */
	commissionValidation: z
		.object({
			status: z.enum(["active", "expiring", "blocked"]),
			blockCategory: z
				.enum(["expired", "revoked", "cancelled", "disqualified", "inactive", "unknown"])
				.nullable(),
			daysRemaining: z.number().int().nullable(),
			warningTier: z
				.union([
					z.literal(30),
					z.literal(20),
					z.literal(10),
					z.literal(5),
					z.literal(3),
					z.literal(1),
				])
				.nullable(),
			blocked: z.boolean(),
			blockReason: z.string().nullable(),
			commissionExpiry: z.string().nullable(),
		})
		.nullable(),
	/** Government-issued ID expiration (`YYYY-MM-DD`); ENP and client (principal/witness) profiles. */
	governmentIdExpiry: z.string().nullable(),
	/** Proactive government ID expiry warnings and notarial-act blocking; null when no expiry on file. */
	governmentIdValidation: z
		.object({
			status: z.enum(["active", "expiring", "blocked"]),
			daysRemaining: z.number().int().nullable(),
			warningTier: z
				.union([
					z.literal(30),
					z.literal(20),
					z.literal(10),
					z.literal(5),
					z.literal(3),
					z.literal(1),
				])
				.nullable(),
			blocked: z.boolean(),
			blockReason: z.string().nullable(),
			governmentIdExpiry: z.string().nullable(),
		})
		.nullable(),
	...TimestampFields,
})

export const DismissCommissionExpiryWarningSchema = z.object({
	warningDay: z.union([
		z.literal(30),
		z.literal(20),
		z.literal(10),
		z.literal(5),
		z.literal(3),
		z.literal(1),
	]),
})

export type DismissCommissionExpiryWarning = z.infer<typeof DismissCommissionExpiryWarningSchema>

export const SnoozeCommissionExpiryWarningSchema = z.object({
	/** Hours to hide the pop-up (default 24). */
	hours: z.number().int().min(1).max(336).optional(),
})

export type SnoozeCommissionExpiryWarning = z.infer<typeof SnoozeCommissionExpiryWarningSchema>

export const DismissGovernmentIdExpiryWarningSchema = z.object({
	warningDay: z.union([
		z.literal(30),
		z.literal(20),
		z.literal(10),
		z.literal(5),
		z.literal(3),
		z.literal(1),
	]),
})
export type DismissGovernmentIdExpiryWarning = z.infer<
	typeof DismissGovernmentIdExpiryWarningSchema
>

export const SnoozeGovernmentIdExpiryWarningSchema = SnoozeCommissionExpiryWarningSchema
export type SnoozeGovernmentIdExpiryWarning = z.infer<typeof SnoozeGovernmentIdExpiryWarningSchema>

export const UpdateProfileSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	phone: z.string().optional(),
	avatarUrl: z.string().url().optional(),
	organization: z.string().max(500).optional(),
	position: z.string().max(255).optional(),
	namePrefix: z.string().max(64).optional(),
	rollNumber: z.string().max(128).optional(),
	rollDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
	commissionNumber: z.string().max(128).optional(),
	commissionExpiry: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
	regionProvinceCity: z.string().max(500).optional(),
	officeAddress: z.string().max(2000).optional(),
	ptrNumber: z.string().max(128).optional(),
	ptrLocation: z.string().max(255).optional(),
	ptrDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
	ibpNumber: z.string().max(128).optional(),
	ibpDate: z.string().max(128).optional(),
	mclePeriod: z.string().max(255).optional(),
	mcleNumber: z.string().max(128).optional(),
	mcleDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
	residentialAddress: z.string().max(2000).optional(),
	commissionArea: z.string().max(500).optional(),
	governmentIdExpiry: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
})

/** First-time OAuth: create ENP or client profile when none exists yet. */
export const BootstrapRoleSchema = z.object({
	role: z.enum(["enp", "client"]),
})

export const HypervergeTransactionSchema = z.object({
	id: z.string(),
	userId: z.string(),
	status: HypervergeStatusEnum,
	transactionId: z.string(),
	documentType: z.string(),
	confidence: z.number().min(0).max(100).nullable(),
	reason: z.string().nullable(),
	...TimestampFields,
})

export type UserProfile = z.infer<typeof UserProfileSchema>
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>
export type BootstrapRole = z.infer<typeof BootstrapRoleSchema>
export type HypervergeTransaction = z.infer<typeof HypervergeTransactionSchema>
