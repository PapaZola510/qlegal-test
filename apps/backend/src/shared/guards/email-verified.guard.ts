import {
	ForbiddenException,
	Injectable,
	type CanActivate,
	type ExecutionContext,
} from "@nestjs/common"
import { eq } from "drizzle-orm"
import type { Request } from "express"

import { sessions, users } from "@repo/db/schema"

import { db } from "@/common/database/database.client"

function isAllowedPath(url: string): boolean {
	// Only applies to versioned API routes; auth routes are excluded by SessionContextMiddleware.
	if (!url.startsWith("/api/")) return true

	// Allow verification endpoints.
	if (/^\/api\/v\d+\/email\/verification\//.test(url)) return true
	// Allow MFA endpoints.
	if (/^\/api\/v\d+\/email\/mfa\//.test(url)) return true

	// Allow profile/me so the frontend can decide redirects.
	if (/^\/api\/v\d+\/profile\/me\b/.test(url)) return true

	// Dev utilities (controller enforces NODE_ENV !== production).
	if (/^\/api\/v\d+\/dev\b/.test(url)) return true

	return false
}

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req = context.switchToHttp().getRequest<Request>()
		const url = req.originalUrl ?? req.url ?? ""

		if (isAllowedPath(url)) return true

		const userId = req.qlegalSessionContext?.userId
		if (!userId) return true

		// Enforce MFA (per-session).
		const sessionId = req.qlegalSessionContext?.sessionId
		if (sessionId) {
			const [srow] = await db
				.select({
					mfaRequiredAt: sessions.mfaRequiredAt,
					mfaVerifiedAt: sessions.mfaVerifiedAt,
				})
				.from(sessions)
				.where(eq(sessions.id, sessionId))
				.limit(1)
			if (srow?.mfaRequiredAt && !srow.mfaVerifiedAt) {
				throw new ForbiddenException("MFA required")
			}
		}

		const [row] = await db
			.select({ emailVerified: users.emailVerified })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)

		if (!row) return true
		if (row.emailVerified === true) return true

		throw new ForbiddenException("Email verification required")
	}
}
