import { Controller, ForbiddenException, Post, Req } from "@nestjs/common"
import { eq } from "drizzle-orm"
import type { Request } from "express"

import { sessions, users } from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import { SessionContextService } from "@/common/session/session-context.service"
import { env } from "@/config/env.config"

import { DEV_ADMIN_EMAIL, DEV_SUPER_ADMIN_EMAIL } from "./dev-admin.constants"

const DEV_OPERATOR_PLATFORM_ROLES: Record<string, "admin" | "super_admin"> = {
	[DEV_ADMIN_EMAIL]: "admin",
	[DEV_SUPER_ADMIN_EMAIL]: "super_admin",
}

/**
 * Development-only: promote seeded operator accounts after sign-up.
 */
@Controller({ path: "dev", version: "1" })
export class DevAdminController {
	constructor(private readonly sessionContext: SessionContextService) {}

	@Post("sync-admin-role")
	async syncAdminRole(@Req() req: Request): Promise<{ ok: true; role: "admin" | "super_admin" }> {
		return this.syncOperatorPlatformRole(req)
	}

	/** Alias for older clients; same behavior as sync-admin-role (role resolved from email). */
	@Post("sync-super-admin-role")
	async syncSuperAdminRole(
		@Req() req: Request
	): Promise<{ ok: true; role: "admin" | "super_admin" }> {
		return this.syncOperatorPlatformRole(req)
	}

	private async syncOperatorPlatformRole(
		req: Request
	): Promise<{ ok: true; role: "admin" | "super_admin" }> {
		if (env.NODE_ENV === "production") {
			throw new ForbiddenException("Not available in production")
		}

		const ctx = await this.sessionContext.resolveForRequest(req)
		if (!ctx?.userId) {
			throw new ForbiddenException("Sign in required")
		}

		const [userRow] = await db
			.select({ email: users.email })
			.from(users)
			.where(eq(users.id, ctx.userId))
			.limit(1)

		const role = userRow?.email ? DEV_OPERATOR_PLATFORM_ROLES[userRow.email] : undefined
		if (!role) {
			throw new ForbiddenException("Not an authorized operator account")
		}

		const now = new Date()
		await db
			.update(users)
			.set({ platformRole: role, updatedAt: now })
			.where(eq(users.id, ctx.userId))

		// Email/password sign-in marks MFA required; skip it for local operator bootstrap.
		if (ctx.sessionId) {
			await db
				.update(sessions)
				.set({ mfaVerifiedAt: now, updatedAt: now })
				.where(eq(sessions.id, ctx.sessionId))
		}

		return { ok: true, role }
	}
}
