import { Injectable } from "@nestjs/common"
import { fromNodeHeaders } from "better-auth/node"
import { and, eq, isNull } from "drizzle-orm"
import type { Request } from "express"

import { getAuth } from "@repo/auth"
import { clientProfiles, enpProfiles, subOrgs, users } from "@repo/db/schema"

import { qlegalRoleFromProfiles } from "@/modules/v1/auth-profile/lib/effective-app-role"

import { db } from "../database/database.client"
import type { QlegalRole, QlegalSessionContext } from "./qlegal-session.types"

const requestContextCache = new WeakMap<Request, QlegalSessionContext | null | undefined>()

/**
 * Resolves Better Auth session plus app role and sub-org membership for tenancy.
 * Implements the D1 “SessionContextInterceptor” responsibility (oRPC + HTTP guards share this).
 */
@Injectable()
export class SessionContextService {
	/**
	 * Returns cached context for this request, or builds it once per request.
	 */
	async resolveForRequest(req: Request): Promise<QlegalSessionContext | null> {
		if (requestContextCache.has(req)) {
			return requestContextCache.get(req) ?? null
		}
		const built = await this.build(req)
		requestContextCache.set(req, built)
		;(
			req as Request & { qlegalSessionContext?: QlegalSessionContext | null }
		).qlegalSessionContext = built
		return built
	}

	private async build(req: Request): Promise<QlegalSessionContext | null> {
		let session: Awaited<ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>> | null = null
		try {
			session = await getAuth().api.getSession({
				headers: fromNodeHeaders(req.headers),
			})
		} catch (error: unknown) {
			// Never fail the whole request because session resolution failed.
			// Controllers/guards can still enforce authentication as needed.
			console.error("SessionContextService.getSession failed", {
				message: (error as Error | undefined)?.message ?? String(error),
			})
			return null
		}
		const userId = session?.user?.id
		const sessionId = (session as { session?: { id?: string } } | null)?.session?.id
		if (!userId || !sessionId) {
			return null
		}

		let userRow:
			| {
					deletedAt: (typeof users.deletedAt)["_"]["data"] | null
					platformRole: (typeof users.platformRole)["_"]["data"]
					complianceAuditAccess: (typeof users.complianceAuditAccess)["_"]["data"]
			  }
			| undefined
		try {
			;[userRow] = await db
				.select({
					deletedAt: users.deletedAt,
					platformRole: users.platformRole,
					complianceAuditAccess: users.complianceAuditAccess,
				})
				.from(users)
				.where(eq(users.id, userId))
				.limit(1)
		} catch (error: unknown) {
			console.error("SessionContextService.user lookup failed", {
				userId,
				message: (error as Error | undefined)?.message ?? String(error),
			})
			return null
		}

		if (!userRow || (userRow.deletedAt !== null && userRow.deletedAt !== undefined)) {
			return null
		}

		let enpRows: Array<typeof enpProfiles.$inferSelect> = []
		let clientRows: Array<typeof clientProfiles.$inferSelect> = []
		let ownedRows: Array<{ id: string }> = []
		try {
			;[enpRows, clientRows, ownedRows] = await Promise.all([
				db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1),
				db.select().from(clientProfiles).where(eq(clientProfiles.userId, userId)).limit(1),
				db
					.select({ id: subOrgs.id })
					.from(subOrgs)
					.where(and(eq(subOrgs.ownerId, userId), isNull(subOrgs.deletedAt))),
			])
		} catch (error: unknown) {
			console.error("SessionContextService.profile/suborg lookup failed", {
				userId,
				message: (error as Error | undefined)?.message ?? String(error),
			})
			return null
		}
		const enpRow = enpRows[0]
		const clientRow = clientRows[0]

		const subOrgIdSet = new Set<string>()
		for (const r of ownedRows) {
			subOrgIdSet.add(r.id)
		}
		if (enpRow?.subOrgId) {
			subOrgIdSet.add(enpRow.subOrgId)
		}
		if (clientRow?.subOrgId) {
			subOrgIdSet.add(clientRow.subOrgId)
		}

		const role: QlegalRole = qlegalRoleFromProfiles(userRow.platformRole, enpRow, clientRow)

		return {
			userId,
			sessionId,
			role,
			subOrgIds: [...subOrgIdSet],
			complianceAuditAccess: userRow.complianceAuditAccess ?? false,
		}
	}
}
