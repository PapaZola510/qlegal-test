import { oc } from "@orpc/contract"
import { z } from "zod"

import { PaymentIntentSchema } from "../payments/payments.schema.js"
import { SubOrgIdSchema, SubOrgSchema } from "../sub-orgs/sub-orgs.schema.js"
import {
	AdminAuditEventSchema,
	AdminDashboardStatsSchema,
	AdminGrantExamRetakeResultSchema,
	AdminGrantExamRetakeSchema,
	AdminIdentityAuditSchema,
	AdminMarkPaymentPaidSchema,
	AdminRegistryOversightEntrySchema,
	AdminReviewIdentitySchema,
	AdminScSyncStatusSchema,
	AdminSetComplianceAccessSchema,
	AdminSetEnpScCommissionStatusSchema,
	AdminSubOrgCreateSchema,
	AdminSubOrgUpdateSchema,
	AdminUpdateUserRoleSchema,
	AdminUserIdParamSchema,
	AdminUserSchema,
} from "./admin.schema.js"

export const adminContract = {
	dashboard: oc
		.route({
			method: "GET",
			path: "/admin/dashboard",
			summary: "Get admin dashboard stats",
			tags: ["Admin"],
		})
		.output(AdminDashboardStatsSchema),

	listUsers: oc
		.route({
			method: "GET",
			path: "/admin/users",
			summary: "List all users (admin)",
			tags: ["Admin"],
		})
		.output(z.array(AdminUserSchema)),

	updateUserRole: oc
		.route({
			method: "PUT",
			path: "/admin/users/role",
			summary: "Update user role",
			tags: ["Admin"],
		})
		.input(AdminUpdateUserRoleSchema)
		.output(AdminUserSchema),

	setComplianceAccess: oc
		.route({
			method: "POST",
			path: "/admin/users/compliance-access",
			summary: "Grant or revoke compliance audit access (audited)",
			tags: ["Admin"],
		})
		.input(AdminSetComplianceAccessSchema)
		.output(AdminUserSchema),

	identityAudits: oc
		.route({
			method: "GET",
			path: "/admin/identity-audits",
			summary: "List identity verification audits",
			tags: ["Admin"],
		})
		.output(z.array(AdminIdentityAuditSchema)),

	reviewIdentity: oc
		.route({
			method: "POST",
			path: "/admin/identity-audits/review",
			summary: "Review identity verification",
			tags: ["Admin"],
		})
		.input(AdminReviewIdentitySchema)
		.output(AdminIdentityAuditSchema),

	scSyncStatus: oc
		.route({
			method: "GET",
			path: "/admin/sc-sync",
			summary: "Get SC sync statuses",
			tags: ["Admin"],
		})
		.output(z.array(AdminScSyncStatusSchema)),

	grantExamRetake: oc
		.route({
			method: "POST",
			path: "/admin/exam-retake-grant",
			summary: "Grant a paid exam retake via admin override (audited)",
			tags: ["Admin"],
		})
		.input(AdminGrantExamRetakeSchema)
		.output(AdminGrantExamRetakeResultSchema),

	softDeleteUser: oc
		.route({
			method: "POST",
			path: "/admin/users/soft-delete",
			summary: "Soft-delete a user (sets deleted_at)",
			tags: ["Admin"],
		})
		.input(AdminUserIdParamSchema)
		.output(z.object({ ok: z.literal(true) })),

	listUserAudits: oc
		.route({
			method: "GET",
			path: "/admin/users/{userId}/audits",
			summary: "Audit events related to a user",
			tags: ["Admin"],
		})
		.input(AdminUserIdParamSchema)
		.output(z.array(AdminAuditEventSchema)),

	revokeCertificate: oc
		.route({
			method: "POST",
			path: "/admin/users/revoke-certificate",
			summary: "Revoke ENP certificate (audited)",
			tags: ["Admin"],
		})
		.input(AdminUserIdParamSchema)
		.output(z.object({ ok: z.literal(true) })),

	reinstateCertificate: oc
		.route({
			method: "POST",
			path: "/admin/users/reinstate-certificate",
			summary: "Reinstate a previously revoked ENP certificate (audited)",
			tags: ["Admin"],
		})
		.input(AdminUserIdParamSchema)
		.output(z.object({ ok: z.literal(true) })),

	setEnpScCommissionStatus: oc
		.route({
			method: "POST",
			path: "/admin/users/sc-commission-status",
			summary: "Admin override of ENP Supreme Court commission status (audited)",
			tags: ["Admin"],
		})
		.input(AdminSetEnpScCommissionStatusSchema)
		.output(AdminUserSchema),

	syncEnpScCommissionFromSc: oc
		.route({
			method: "POST",
			path: "/admin/users/sc-commission-sync",
			summary: "Force refresh ENP commission status from Supreme Court (clears admin override)",
			tags: ["Admin"],
		})
		.input(AdminUserIdParamSchema)
		.output(AdminUserSchema),

	listPayments: oc
		.route({
			method: "GET",
			path: "/admin/payments",
			summary: "List all payment intents",
			tags: ["Admin"],
		})
		.output(z.array(PaymentIntentSchema)),

	markPaymentPaid: oc
		.route({
			method: "POST",
			path: "/admin/payments/mark-paid",
			summary: "Mark a pending payment as succeeded (admin override, audited)",
			tags: ["Admin"],
		})
		.input(AdminMarkPaymentPaidSchema)
		.output(PaymentIntentSchema),

	listSubOrgs: oc
		.route({
			method: "GET",
			path: "/admin/sub-orgs",
			summary: "List all sub-organizations (admin)",
			tags: ["Admin"],
		})
		.output(z.array(SubOrgSchema)),

	createSubOrg: oc
		.route({
			method: "POST",
			path: "/admin/sub-orgs",
			summary: "Create a sub-organization for any owner (admin)",
			tags: ["Admin"],
		})
		.input(AdminSubOrgCreateSchema)
		.output(SubOrgSchema),

	updateSubOrg: oc
		.route({
			method: "PUT",
			path: "/admin/sub-orgs",
			summary: "Update a sub-organization (admin)",
			tags: ["Admin"],
		})
		.input(AdminSubOrgUpdateSchema)
		.output(SubOrgSchema),

	softDeleteSubOrg: oc
		.route({
			method: "POST",
			path: "/admin/sub-orgs/soft-delete",
			summary: "Soft-delete a sub-organization (admin)",
			tags: ["Admin"],
		})
		.input(SubOrgIdSchema)
		.output(z.object({ ok: z.literal(true) })),

	registryOversight: oc
		.route({
			method: "GET",
			path: "/admin/registry-oversight",
			summary: "Registry act counts per ENP (read-only)",
			tags: ["Admin"],
		})
		.output(z.array(AdminRegistryOversightEntrySchema)),
}
