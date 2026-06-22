import { Injectable, NotFoundException } from "@nestjs/common"
import { ORPCError } from "@orpc/server"
import { and, count, desc, eq, inArray, isNull, notInArray, or } from "drizzle-orm"

import {
	auditEvents,
	clientProfiles,
	enpProfiles,
	hypervergeTransactions,
	paymentIntents,
	registryActs,
	subOrgs,
	users,
} from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import { deriveEnpCommissionRecordStatus } from "@/modules/v1/auth-profile/lib/derive-enp-commission-record-status"
import { normalizeScCommissionStatus } from "@/modules/v1/auth-profile/lib/enp-commission-validation"
import {
	persistEnpScCommissionStatus,
	syncEnpScCommissionStatusFromSc,
} from "@/modules/v1/auth-profile/lib/sync-enp-sc-commission-status"
import { softDeleteUserById } from "@/utils/user-soft-delete"

import { PaymentsService } from "../payments/payments.service"

function readTxnMeta(raw: unknown): { documentType?: string; reason?: string | null } {
	if (!raw || typeof raw !== "object") return {}
	const o = raw as Record<string, unknown>
	const documentType = typeof o.documentType === "string" ? o.documentType : undefined
	const reason = typeof o.reason === "string" ? o.reason : null
	return { documentType, reason }
}

type HypervergeApiStatus =
	| "not_started"
	| "pending"
	| "in_progress"
	| "approved"
	| "rejected"
	| "needs_review"
	| "expired"

function mapHypervergeToApi(
	db: "started" | "success" | "fail" | "needs_review"
): HypervergeApiStatus {
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

function slugify(name: string, id: string): string {
	const base = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40)
	const suffix = id.replace(/[^a-z0-9]/gi, "").slice(0, 8)
	return base.length > 0 ? `${base}-${suffix}` : `org-${suffix}`
}

const terminalSc: Array<(typeof registryActs.$inferSelect)["scStatus"]> = ["synced", "rejected"]

function mapAdminScCommissionStatus(
	value: string | null | undefined
):
	| "active"
	| "inactive"
	| "cancelled"
	| "revoked"
	| "disqualified"
	| "suspended"
	| "unknown"
	| null {
	if (!value?.trim()) return null
	const normalized = normalizeScCommissionStatus(value)
	if (normalized === "canceled") return "cancelled"
	return normalized as ReturnType<typeof mapAdminScCommissionStatus>
}

@Injectable()
export class AdminService {
	constructor(private readonly payments: PaymentsService) {}

	private async insertAudit(
		actorUserId: string,
		eventType: string,
		targetTable: string | null,
		targetId: string | null,
		payload?: Record<string, unknown>
	) {
		await db.insert(auditEvents).values({
			actorUserId,
			subOrgId: null,
			eventType,
			targetTable,
			targetId,
			payload: payload ?? null,
		})
	}

	private async subOrgMemberCount(org: typeof subOrgs.$inferSelect): Promise<number> {
		const enpIds = await db
			.select({ userId: enpProfiles.userId })
			.from(enpProfiles)
			.where(eq(enpProfiles.subOrgId, org.id))
		const clientIds = await db
			.select({ userId: clientProfiles.userId })
			.from(clientProfiles)
			.where(eq(clientProfiles.subOrgId, org.id))
		const ids = new Set([...enpIds.map(r => r.userId), ...clientIds.map(r => r.userId)])
		ids.add(org.ownerId)
		return ids.size
	}

	private async ownerDisplayName(ownerId: string): Promise<string> {
		const [owner] = await db
			.select({ name: users.name })
			.from(users)
			.where(eq(users.id, ownerId))
			.limit(1)
		return owner?.name ?? "Unknown"
	}

	private async toSubOrgDto(row: typeof subOrgs.$inferSelect) {
		const memberCount = await this.subOrgMemberCount(row)
		const ownerName = await this.ownerDisplayName(row.ownerId)
		return {
			id: row.id,
			name: row.name,
			slug: slugify(row.name, row.id),
			description: null as string | null,
			logoUrl: null as string | null,
			kind: row.kind,
			ownerName,
			memberCount,
			isActive: row.deletedAt === null,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		}
	}

	private deriveAppRole(
		platformRole: "none" | "admin" | "super_admin" | "sub_org_admin",
		hasEnp: boolean,
		hasClient: boolean
	): "enp" | "client" | "admin" | "super_admin" | "sub_org_admin" {
		if (platformRole === "super_admin") return "super_admin"
		if (platformRole === "admin") return "admin"
		if (platformRole === "sub_org_admin") return "sub_org_admin"
		if (hasEnp) return "enp"
		if (hasClient) return "client"
		return "client"
	}

	async getDashboardStats() {
		const now = new Date()
		const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

		const [userTotal] = await db.select({ n: count() }).from(users).where(isNull(users.deletedAt))
		const [enpTotal] = await db.select({ n: count() }).from(enpProfiles)
		const [clientTotal] = await db.select({ n: count() }).from(clientProfiles)
		const [hvPending] = await db
			.select({ n: count() })
			.from(hypervergeTransactions)
			.where(
				and(
					isNull(hypervergeTransactions.deletedAt),
					inArray(hypervergeTransactions.status, ["started", "needs_review"])
				)
			)
		const [orgActive] = await db
			.select({ n: count() })
			.from(subOrgs)
			.where(isNull(subOrgs.deletedAt))
		const [payTotal] = await db.select({ n: count() }).from(paymentIntents)
		const succeededPayments = await db
			.select()
			.from(paymentIntents)
			.where(eq(paymentIntents.status, "succeeded"))
		let revenueThisMonth = 0
		for (const p of succeededPayments) {
			const d = p.paidAt ?? p.createdAt
			if (d >= monthStart) revenueThisMonth += p.amount
		}

		return {
			totalUsers: Number(userTotal?.n ?? 0),
			totalEnps: Number(enpTotal?.n ?? 0),
			totalClients: Number(clientTotal?.n ?? 0),
			pendingVerifications: Number(hvPending?.n ?? 0),
			activeSubOrgs: Number(orgActive?.n ?? 0),
			totalPayments: Number(payTotal?.n ?? 0),
			revenueThisMonth,
		}
	}

	async listUsers() {
		const rows = await db.select().from(users).orderBy(desc(users.createdAt))
		const out: Array<{
			id: string
			email: string
			name: string
			role: "enp" | "client" | "admin" | "super_admin" | "sub_org_admin"
			complianceAuditAccess: boolean
			identityStatus: "unverified" | "pending" | "verified" | "rejected" | "expired"
			certificateStatus:
				| "none"
				| "studying"
				| "scheduled"
				| "failed"
				| "passed"
				| "active"
				| "expired"
				| "revoked"
			scCommissionStatus?:
				| "active"
				| "inactive"
				| "cancelled"
				| "revoked"
				| "disqualified"
				| "suspended"
				| "unknown"
				| null
			scCommissionStatusAdminOverride?: boolean
			isActive: boolean
			createdAt: string
		}> = []

		for (const u of rows) {
			const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, u.id)).limit(1)
			const [client] = await db
				.select()
				.from(clientProfiles)
				.where(eq(clientProfiles.userId, u.id))
				.limit(1)
			const role = this.deriveAppRole(u.platformRole ?? "none", Boolean(enp), Boolean(client))

			let identityStatus: (typeof out)[number]["identityStatus"] = "unverified"
			let certificateStatus: (typeof out)[number]["certificateStatus"] = "none"
			if (enp) {
				if (enp.identityStatus === "pending") identityStatus = "pending"
				else if (enp.identityStatus === "verified") identityStatus = "verified"
				else if (enp.identityStatus === "failed") identityStatus = "rejected"

				if (enp.certificateStatus === "none") certificateStatus = "none"
				else if (enp.certificateStatus === "certified") certificateStatus = "active"
				else if (enp.certificateStatus === "revoked") certificateStatus = "revoked"
			}

			out.push({
				id: u.id,
				email: u.email,
				name: u.name,
				role,
				complianceAuditAccess: u.complianceAuditAccess ?? false,
				identityStatus,
				certificateStatus,
				...(enp
					? {
							scCommissionStatus: mapAdminScCommissionStatus(enp.scCommissionStatus),
							scCommissionStatusAdminOverride: enp.scCommissionStatusAdminOverride ?? false,
						}
					: {}),
				isActive: u.deletedAt === null,
				createdAt: u.createdAt.toISOString(),
			})
		}
		return out
	}

	async updateUserRole(
		userId: string,
		role: "enp" | "client" | "admin" | "super_admin" | "sub_org_admin",
		actorUserId: string
	) {
		const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
		if (!u) throw new NotFoundException(`User ${userId} not found`)

		let platform: "none" | "admin" | "super_admin" | "sub_org_admin" = "none"
		if (role === "admin" || role === "super_admin" || role === "sub_org_admin") {
			platform = role
		}

		await db
			.update(users)
			.set({ platformRole: platform, updatedAt: new Date() })
			.where(eq(users.id, userId))

		await this.insertAudit(actorUserId, "admin_user_role_updated", "users", userId, { role })

		const [after] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		const [client] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		const r = this.deriveAppRole(after!.platformRole ?? "none", Boolean(enp), Boolean(client))

		let identityStatus: "unverified" | "pending" | "verified" | "rejected" | "expired" =
			"unverified"
		let certificateStatus:
			| "none"
			| "studying"
			| "scheduled"
			| "failed"
			| "passed"
			| "active"
			| "expired"
			| "revoked" = "none"
		if (enp) {
			if (enp.identityStatus === "pending") identityStatus = "pending"
			else if (enp.identityStatus === "verified") identityStatus = "verified"
			else if (enp.identityStatus === "failed") identityStatus = "rejected"
			if (enp.certificateStatus === "none") certificateStatus = "none"
			else if (enp.certificateStatus === "certified") certificateStatus = "active"
			else if (enp.certificateStatus === "revoked") certificateStatus = "revoked"
		}

		return {
			id: after!.id,
			email: after!.email,
			name: after!.name,
			role: r,
			complianceAuditAccess: after!.complianceAuditAccess ?? false,
			identityStatus,
			certificateStatus,
			isActive: after!.deletedAt === null,
			createdAt: after!.createdAt.toISOString(),
		}
	}

	async setComplianceAccess(userId: string, granted: boolean, actorUserId: string) {
		const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
		if (!u) throw new NotFoundException(`User ${userId} not found`)

		await db
			.update(users)
			.set({ complianceAuditAccess: granted, updatedAt: new Date() })
			.where(eq(users.id, userId))

		await this.insertAudit(actorUserId, "admin_compliance_access_changed", "users", userId, {
			granted,
			actorId: actorUserId,
		})

		const [after] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		const [client] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		const r = this.deriveAppRole(after!.platformRole ?? "none", Boolean(enp), Boolean(client))

		let identityStatus: "unverified" | "pending" | "verified" | "rejected" | "expired" =
			"unverified"
		let certificateStatus:
			| "none"
			| "studying"
			| "scheduled"
			| "failed"
			| "passed"
			| "active"
			| "expired"
			| "revoked" = "none"
		if (enp) {
			if (enp.identityStatus === "pending") identityStatus = "pending"
			else if (enp.identityStatus === "verified") identityStatus = "verified"
			else if (enp.identityStatus === "failed") identityStatus = "rejected"
			if (enp.certificateStatus === "none") certificateStatus = "none"
			else if (enp.certificateStatus === "certified") certificateStatus = "active"
			else if (enp.certificateStatus === "revoked") certificateStatus = "revoked"
		}

		return {
			id: after!.id,
			email: after!.email,
			name: after!.name,
			role: r,
			complianceAuditAccess: after!.complianceAuditAccess ?? false,
			identityStatus,
			certificateStatus,
			isActive: after!.deletedAt === null,
			createdAt: after!.createdAt.toISOString(),
		}
	}

	async listIdentityAudits() {
		const rows = await db
			.select()
			.from(hypervergeTransactions)
			.where(isNull(hypervergeTransactions.deletedAt))
			.orderBy(desc(hypervergeTransactions.createdAt))

		const out = []
		for (const t of rows) {
			const [u] = await db
				.select({ name: users.name, email: users.email })
				.from(users)
				.where(eq(users.id, t.userId))
				.limit(1)
			const meta = readTxnMeta(t.rawResponseJson)
			const apiStatus = mapHypervergeToApi(t.status)
			const reviewed = t.status === "success" || t.status === "fail"
			out.push({
				id: t.id,
				userId: t.userId,
				userName: u?.name ?? "Unknown",
				userEmail: u?.email ?? "unknown@example.com",
				status: apiStatus,
				documentType: meta.documentType ?? "Identity verification",
				submittedAt: t.createdAt.toISOString(),
				reviewedAt: reviewed ? t.updatedAt.toISOString() : null,
				reviewerNotes: meta.reason ?? null,
			})
		}
		return out
	}

	async reviewIdentity(
		auditId: string,
		decision: "approve" | "reject",
		notes: string | undefined,
		actorUserId: string
	) {
		const [txn] = await db
			.select()
			.from(hypervergeTransactions)
			.where(eq(hypervergeTransactions.id, auditId))
			.limit(1)
		if (!txn) throw new NotFoundException(`Audit ${auditId} not found`)

		const now = new Date()
		const hvStatus = decision === "approve" ? ("success" as const) : ("fail" as const)
		await db
			.update(hypervergeTransactions)
			.set({
				status: hvStatus,
				updatedAt: now,
				rawResponseJson: {
					...(typeof txn.rawResponseJson === "object" && txn.rawResponseJson !== null
						? txn.rawResponseJson
						: {}),
					reason: notes ?? null,
					adminReviewedAt: now.toISOString(),
				},
			})
			.where(eq(hypervergeTransactions.id, auditId))

		const [enp] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, txn.userId))
			.limit(1)
		if (enp) {
			await db
				.update(enpProfiles)
				.set({
					identityStatus: decision === "approve" ? "verified" : "failed",
					updatedAt: now,
				})
				.where(eq(enpProfiles.userId, txn.userId))
		}

		await this.insertAudit(
			actorUserId,
			"admin_identity_reviewed",
			"hyperverge_transactions",
			auditId,
			{
				decision,
				targetUserId: txn.userId,
			}
		)

		const [u] = await db
			.select({ name: users.name, email: users.email })
			.from(users)
			.where(eq(users.id, txn.userId))
			.limit(1)
		const meta = readTxnMeta(txn.rawResponseJson)
		return {
			id: txn.id,
			userId: txn.userId,
			userName: u?.name ?? "Unknown",
			userEmail: u?.email ?? "unknown@example.com",
			status: decision === "approve" ? ("approved" as const) : ("rejected" as const),
			documentType: meta.documentType ?? "Identity verification",
			submittedAt: txn.createdAt.toISOString(),
			reviewedAt: now.toISOString(),
			reviewerNotes: notes ?? null,
		}
	}

	async grantExamRetake(targetUserId: string, adminActorId: string) {
		const { id } = await this.payments.createAdminRetakeGrant(targetUserId, adminActorId)
		await this.insertAudit(adminActorId, "admin_exam_retake_granted", "payment_intents", id, {
			targetUserId,
		})
		return { paymentIntentId: id }
	}

	async getScSyncStatuses() {
		const rows = await db
			.select()
			.from(registryActs)
			.where(notInArray(registryActs.scStatus, ["synced", "rejected"]))
			.orderBy(desc(registryActs.updatedAt))

		const out = []
		for (const act of rows) {
			const [u] = await db
				.select({ name: users.name })
				.from(users)
				.where(eq(users.id, act.enpUserId))
				.limit(1)
			out.push({
				id: act.id,
				actNumber: act.actNumber,
				enpName: u?.name ?? "Unknown",
				scStatus: act.scStatus,
				lastAttemptAt: act.scSubmittedAt?.toISOString() ?? act.updatedAt.toISOString(),
				errorMessage: act.scRejectionReason ?? null,
			})
		}
		return out
	}

	async softDeleteUser(targetUserId: string, actorUserId: string) {
		const [u] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1)
		if (!u) throw new NotFoundException(`User ${targetUserId} not found`)
		await softDeleteUserById(targetUserId)
		await this.insertAudit(actorUserId, "admin_user_soft_deleted", "users", targetUserId, {})
		return { ok: true as const }
	}

	async listUserAudits(targetUserId: string) {
		const rows = await db
			.select()
			.from(auditEvents)
			.where(
				or(
					eq(auditEvents.actorUserId, targetUserId),
					and(eq(auditEvents.targetTable, "users"), eq(auditEvents.targetId, targetUserId))
				)
			)
			.orderBy(desc(auditEvents.occurredAt))

		return rows.map(r => ({
			id: r.id,
			actorUserId: r.actorUserId,
			eventType: r.eventType,
			targetTable: r.targetTable,
			targetId: r.targetId,
			occurredAt: r.occurredAt.toISOString(),
			payload: (r.payload as Record<string, unknown> | null) ?? null,
		}))
	}

	async revokeCertificate(targetUserId: string, actorUserId: string) {
		const [enp] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, targetUserId))
			.limit(1)
		if (!enp) throw new NotFoundException("ENP profile not found for user")
		if (enp.certificateStatus !== "certified") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only an active ENP certificate can be revoked.",
			})
		}
		const now = new Date()
		await db
			.update(enpProfiles)
			.set({ certificateStatus: "revoked", updatedAt: now })
			.where(eq(enpProfiles.userId, targetUserId))
		await this.insertAudit(
			actorUserId,
			"admin_certificate_revoked",
			"enp_profiles",
			targetUserId,
			{}
		)
		return { ok: true as const }
	}

	async reinstateCertificate(targetUserId: string, actorUserId: string) {
		const [enp] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, targetUserId))
			.limit(1)
		if (!enp) throw new NotFoundException("ENP profile not found for user")
		if (enp.certificateStatus !== "revoked") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only a revoked ENP certificate can be reinstated.",
			})
		}
		if (!enp.certificateId?.trim()) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot reinstate — no certificate is on file for this ENP.",
			})
		}
		const now = new Date()
		await db
			.update(enpProfiles)
			.set({ certificateStatus: "certified", updatedAt: now })
			.where(eq(enpProfiles.userId, targetUserId))
		await this.insertAudit(
			actorUserId,
			"admin_certificate_reinstated",
			"enp_profiles",
			targetUserId,
			{}
		)
		return { ok: true as const }
	}

	async setEnpScCommissionStatus(
		targetUserId: string,
		status:
			| "active"
			| "inactive"
			| "cancelled"
			| "revoked"
			| "disqualified"
			| "suspended"
			| "unknown",
		actorUserId: string
	) {
		const [enp] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, targetUserId))
			.limit(1)
		if (!enp) throw new NotFoundException("ENP profile not found for user")
		const normalized = normalizeScCommissionStatus(status)
		await persistEnpScCommissionStatus(targetUserId, normalized, { adminOverride: true })
		await this.insertAudit(
			actorUserId,
			"admin_sc_commission_status_set",
			"enp_profiles",
			targetUserId,
			{ status: normalized }
		)
		return this.getAdminUserDto(targetUserId)
	}

	async syncEnpScCommissionFromSc(targetUserId: string, actorUserId: string) {
		const [enp] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, targetUserId))
			.limit(1)
		if (!enp) throw new NotFoundException("ENP profile not found for user")
		const result = await syncEnpScCommissionStatusFromSc(targetUserId, { force: true })
		if (!result.synced) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Could not refresh commission status from the Supreme Court. Check ENP NPN/RN and SC API configuration.",
			})
		}
		await this.insertAudit(
			actorUserId,
			"admin_sc_commission_status_synced",
			"enp_profiles",
			targetUserId,
			{ status: result.status }
		)
		return this.getAdminUserDto(targetUserId)
	}

	private async getAdminUserDto(userId: string) {
		const usersList = await this.listUsers()
		const user = usersList.find(entry => entry.id === userId)
		if (!user) throw new NotFoundException(`User ${userId} not found`)
		return user
	}

	async listPayments() {
		return this.payments.findAllForAdmin()
	}

	async markPaymentPaid(paymentIntentId: string, actorUserId: string) {
		const dto = await this.payments.markSucceededByAdmin(paymentIntentId, actorUserId)
		await this.insertAudit(
			actorUserId,
			"admin_payment_marked_paid",
			"payment_intents",
			paymentIntentId,
			{}
		)
		return dto
	}

	async listSubOrgs() {
		const rows = await db
			.select()
			.from(subOrgs)
			.where(isNull(subOrgs.deletedAt))
			.orderBy(subOrgs.name)
		return Promise.all(rows.map(r => this.toSubOrgDto(r)))
	}

	async createSubOrg(
		input: { ownerUserId: string; name: string; kind: "personal" | "firm" },
		actorUserId: string
	) {
		const [owner] = await db.select().from(users).where(eq(users.id, input.ownerUserId)).limit(1)
		if (!owner || owner.deletedAt) throw new NotFoundException("Owner user not found")

		const now = new Date()
		const [row] = await db
			.insert(subOrgs)
			.values({
				ownerId: input.ownerUserId,
				name: input.name,
				kind: input.kind,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
		if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create sub-org" })
		await this.insertAudit(actorUserId, "admin_sub_org_created", "sub_orgs", row.id, {
			ownerId: input.ownerUserId,
		})
		return this.toSubOrgDto(row)
	}

	async updateSubOrg(input: { id: string; name?: string }, actorUserId: string) {
		const [existing] = await db.select().from(subOrgs).where(eq(subOrgs.id, input.id)).limit(1)
		if (!existing || existing.deletedAt) throw new NotFoundException("Sub-organization not found")
		const now = new Date()
		const patch: Partial<typeof subOrgs.$inferInsert> = { updatedAt: now }
		if (input.name !== undefined) patch.name = input.name
		const [row] = await db.update(subOrgs).set(patch).where(eq(subOrgs.id, input.id)).returning()
		if (!row) throw new NotFoundException("Sub-organization not found")
		await this.insertAudit(actorUserId, "admin_sub_org_updated", "sub_orgs", row.id, {
			name: input.name,
		})
		return this.toSubOrgDto(row)
	}

	async softDeleteSubOrg(subOrgId: string, actorUserId: string) {
		const [existing] = await db.select().from(subOrgs).where(eq(subOrgs.id, subOrgId)).limit(1)
		if (!existing || existing.deletedAt) throw new NotFoundException("Sub-organization not found")
		const now = new Date()
		await db.update(subOrgs).set({ deletedAt: now, updatedAt: now }).where(eq(subOrgs.id, subOrgId))
		await this.insertAudit(actorUserId, "admin_sub_org_soft_deleted", "sub_orgs", subOrgId, {})
		return { ok: true as const }
	}

	async registryOversight() {
		const acts = await db.select().from(registryActs)
		const byEnp = new Map<
			string,
			{ total: number; pending: number; failed: number; lastActivity: Date | null }
		>()
		for (const a of acts) {
			const cur = byEnp.get(a.enpUserId) ?? {
				total: 0,
				pending: 0,
				failed: 0,
				lastActivity: null,
			}
			cur.total++
			if (!terminalSc.includes(a.scStatus)) cur.pending++
			if (a.scStatus === "sync_failed" || a.scStatus === "rejected") cur.failed++
			const activityAt = a.updatedAt ?? a.executedAt
			if (!cur.lastActivity || activityAt > cur.lastActivity) {
				cur.lastActivity = activityAt
			}
			byEnp.set(a.enpUserId, cur)
		}

		const enpUserIds = [...byEnp.keys()]
		const enpByUserId = new Map<string, typeof enpProfiles.$inferSelect>()
		if (enpUserIds.length > 0) {
			const enpRows = await db
				.select()
				.from(enpProfiles)
				.where(inArray(enpProfiles.userId, enpUserIds))
			for (const row of enpRows) {
				enpByUserId.set(row.userId, row)
			}
		}

		const out = []
		for (const [enpUserId, stats] of byEnp) {
			const [u] = await db
				.select({ name: users.name })
				.from(users)
				.where(eq(users.id, enpUserId))
				.limit(1)
			const enp = enpByUserId.get(enpUserId)
			out.push({
				enpUserId,
				enpName: u?.name ?? "Unknown",
				totalActs: stats.total,
				pendingScActs: stats.pending,
				failedScActs: stats.failed,
				lastActivityAt: stats.lastActivity?.toISOString() ?? null,
				commissionStatus: deriveEnpCommissionRecordStatus(enp),
			})
		}
		return out.sort((a, b) => b.totalActs - a.totalActs)
	}
}
