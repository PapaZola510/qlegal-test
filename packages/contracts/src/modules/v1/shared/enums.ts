import { z } from "zod"

export const IdentityStatusEnum = z.enum([
	"unverified",
	"pending",
	"verified",
	"rejected",
	"expired",
])

export const CertificateStatusEnum = z.enum([
	"none",
	"studying",
	"scheduled",
	"failed",
	"passed",
	"active",
	"expired",
	"revoked",
])

export const QuicksignStatusEnum = z.enum([
	"draft",
	"pending_signatures",
	"partially_signed",
	"completed",
	"expired",
	"cancelled",
])

export const PaymentIntentStatusEnum = z.enum([
	"pending",
	"processing",
	"succeeded",
	"failed",
	"refunded",
	"cancelled",
])

export const ActTypeEnum = z.enum([
	"deed_of_sale",
	"affidavit",
	"special_power_of_attorney",
	"general_power_of_attorney",
	"acknowledgment",
	"jurat",
	"oath",
	"certification",
	"protest",
	"deposition",
	"other",
])

export const ScStatusEnum = z.enum([
	"draft",
	"pending_upload",
	"uploaded",
	"pending_review",
	"approved",
	"rejected",
	"synced",
	"sync_failed",
])

/** Aligns with Tech Plan: appointment lifecycle for ENP inbox + sessions */
export const AppointmentStatusEnum = z.enum([
	"pending",
	"quote_sent",
	"confirmed",
	"in_session",
	"ended",
	"declined",
	"cancelled",
])

export const SessionStatusEnum = z.enum(["scheduled", "active", "completed", "cancelled"])

/** Supreme Court `/cs` commission status values stored on `enp_profiles.sc_commission_status`. */
export const ScCommissionStatusEnum = z.enum([
	"active",
	"inactive",
	"cancelled",
	"revoked",
	"disqualified",
	"suspended",
	"unknown",
])

export const UserRoleEnum = z.enum(["enp", "client", "admin", "super_admin", "sub_org_admin"])

export type UserRole = z.infer<typeof UserRoleEnum>

export const OnboardingStepEnum = z.enum([
	"profile",
	"client_profile",
	"professional_profile",
	"identity_verification",
	"certification_course",
	"certificate_upload",
	"commission_details",
	"review",
	"complete",
])

/** Aligns with Tech Plan: exam_attempts.status */
export const ExamAttemptStatusEnum = z.enum(["in_progress", "submitted", "expired", "abandoned"])

export const MessageTypeEnum = z.enum(["text", "file", "system", "notification"])

export const HypervergeStatusEnum = z.enum([
	"not_started",
	"pending",
	"in_progress",
	"approved",
	"rejected",
	"needs_review",
	"expired",
])
