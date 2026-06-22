import { z } from "zod"

import {
	CertificateStatusEnum,
	HypervergeStatusEnum,
	IdentityStatusEnum,
	ScCommissionStatusEnum,
	ScStatusEnum,
	UserRoleEnum,
} from "../shared/enums.js"

export const AdminUserSchema = z.object({
	id: z.string(),
	email: z.string(),
	name: z.string(),
	role: UserRoleEnum,
	complianceAuditAccess: z.boolean(),
	identityStatus: IdentityStatusEnum,
	certificateStatus: CertificateStatusEnum,
	/** ENP only — last known SC commission status (synced or admin override). */
	scCommissionStatus: ScCommissionStatusEnum.nullable().optional(),
	/** ENP only — true when `scCommissionStatus` was set manually by admin. */
	scCommissionStatusAdminOverride: z.boolean().optional(),
	isActive: z.boolean(),
	createdAt: z.string(),
})

export const AdminSetEnpScCommissionStatusSchema = z.object({
	userId: z.string().min(1),
	status: ScCommissionStatusEnum,
})

export const AdminDashboardStatsSchema = z.object({
	totalUsers: z.number(),
	totalEnps: z.number(),
	totalClients: z.number(),
	pendingVerifications: z.number(),
	activeSubOrgs: z.number(),
	totalPayments: z.number(),
	revenueThisMonth: z.number(),
})

export const AdminIdentityAuditSchema = z.object({
	id: z.string(),
	userId: z.string(),
	userName: z.string(),
	userEmail: z.string(),
	status: HypervergeStatusEnum,
	documentType: z.string(),
	submittedAt: z.string(),
	reviewedAt: z.string().nullable(),
	reviewerNotes: z.string().nullable(),
})

export const AdminScSyncStatusSchema = z.object({
	id: z.string(),
	actNumber: z.string(),
	enpName: z.string(),
	scStatus: ScStatusEnum,
	lastAttemptAt: z.string().nullable(),
	errorMessage: z.string().nullable(),
})

export const AdminUpdateUserRoleSchema = z.object({
	userId: z.string(),
	role: UserRoleEnum,
})

export const AdminSetComplianceAccessSchema = z.object({
	userId: z.string().min(1),
	granted: z.boolean(),
})

export const AdminReviewIdentitySchema = z.object({
	auditId: z.string(),
	decision: z.enum(["approve", "reject"]),
	notes: z.string().optional(),
})

export const AdminGrantExamRetakeSchema = z.object({
	userId: z.string(),
})

export const AdminGrantExamRetakeResultSchema = z.object({
	paymentIntentId: z.string(),
})

export const AdminUserIdParamSchema = z.object({
	userId: z.string().min(1),
})

export const AdminAuditEventSchema = z.object({
	id: z.string(),
	actorUserId: z.string().nullable(),
	eventType: z.string(),
	targetTable: z.string().nullable(),
	targetId: z.string().nullable(),
	occurredAt: z.string(),
	payload: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const AdminMarkPaymentPaidSchema = z.object({
	paymentIntentId: z.string().min(1),
})

export const AdminSubOrgCreateSchema = z.object({
	ownerUserId: z.string().min(1),
	name: z.string().min(1).max(255),
	kind: z.enum(["personal", "firm"]),
})

export const AdminSubOrgUpdateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(255).optional(),
})

export const AdminCommissionStatusEnum = z.enum(["active", "expired", "suspended"])

export const AdminRegistryOversightEntrySchema = z.object({
	enpUserId: z.string(),
	enpName: z.string(),
	totalActs: z.number().int(),
	pendingScActs: z.number().int(),
	failedScActs: z.number().int(),
	lastActivityAt: z.string().nullable(),
	commissionStatus: AdminCommissionStatusEnum,
})

export type AdminRegistryOversightEntry = z.infer<typeof AdminRegistryOversightEntrySchema>

export type AdminUser = z.infer<typeof AdminUserSchema>
export type AdminDashboardStats = z.infer<typeof AdminDashboardStatsSchema>
export type AdminIdentityAudit = z.infer<typeof AdminIdentityAuditSchema>
export type AdminScSyncStatus = z.infer<typeof AdminScSyncStatusSchema>
