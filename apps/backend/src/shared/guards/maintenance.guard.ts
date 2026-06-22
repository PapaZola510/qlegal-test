import {
	Injectable,
	ServiceUnavailableException,
	type CanActivate,
	type ExecutionContext,
} from "@nestjs/common"
import { eq } from "drizzle-orm"
import type { Request } from "express"

import { maintenanceMode } from "@repo/db/schema"

import { db } from "@/common/database/database.client"

const MAINTENANCE_MODE_ROW_ID = "singleton"
const CACHE_TTL_MS = 15_000

type CachedMode = { enabled: boolean; message: string | null; at: number }
let cache: CachedMode | null = null

/** Roles allowed full access while maintenance mode is on. */
const BYPASS_ROLES = new Set(["admin", "super_admin", "sub_org_admin"])

/**
 * Paths that must stay reachable while maintenance mode is on so an admin can
 * authenticate, verify, read the kill switch, and toggle it back off.
 */
function isBypassPath(url: string): boolean {
	// Non-API (assets, etc.) — never gated here.
	if (!url.startsWith("/api/")) return true
	// Better Auth routes — admin must be able to sign in.
	if (/^\/api\/(v\d+\/)?auth\//.test(url)) return true
	// Email verification + MFA — required to reach an admin session.
	if (/^\/api\/v\d+\/email\/(verification|mfa)\//.test(url)) return true
	// The public kill-switch status endpoint (read by web middleware + mobile).
	if (/^\/api\/v\d+\/maintenance\/status\b/.test(url)) return true
	// Admin maintenance management (list/create/cancel/complete/mode toggle).
	if (/^\/api\/v\d+\/admin\/maintenance\b/.test(url)) return true
	// Profile/me so the frontend can resolve redirects.
	if (/^\/api\/v\d+\/profile\/me\b/.test(url)) return true
	// Health checks.
	if (/^\/api\/(v\d+\/)?health\b/.test(url)) return true
	return false
}

function isMissingMaintenanceModeTable(error: unknown): boolean {
	const cause = error instanceof Error && "cause" in error ? error.cause : error
	return (
		typeof cause === "object" &&
		cause !== null &&
		"code" in cause &&
		cause.code === "42P01"
	)
}

async function readMode(): Promise<{ enabled: boolean; message: string | null }> {
	const now = Date.now()
	if (cache && now - cache.at < CACHE_TTL_MS) {
		return { enabled: cache.enabled, message: cache.message }
	}

	try {
		const [row] = await db
			.select()
			.from(maintenanceMode)
			.where(eq(maintenanceMode.id, MAINTENANCE_MODE_ROW_ID))
			.limit(1)
		const value = { enabled: row?.enabled ?? false, message: row?.message ?? null }
		cache = { ...value, at: now }
		return value
	} catch (error) {
		// Schema ahead of DB (e.g. local dev before migrate/push) — treat as off.
		if (isMissingMaintenanceModeTable(error)) {
			const value = { enabled: false, message: null }
			cache = { ...value, at: now }
			return value
		}
		throw error
	}
}

/**
 * Global kill switch. When `MAINTENANCE_MODE=true` (env override) or the DB
 * singleton is enabled, returns 503 for all non-admin, non-bypass routes —
 * locking out the API and mobile clients. Web pages are gated separately by
 * `apps/web/middleware.ts`.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req = context.switchToHttp().getRequest<Request>()
		const url = req.originalUrl ?? req.url ?? ""

		if (isBypassPath(url)) return true

		const envOn = process.env.MAINTENANCE_MODE?.toLowerCase() === "true"
		const { enabled, message } = envOn
			? { enabled: true, message: null }
			: await readMode()

		if (!enabled) return true

		// Admins keep full access so they can operate during maintenance.
		const role = req.qlegalSessionContext?.role
		if (role && BYPASS_ROLES.has(role)) return true

		throw new ServiceUnavailableException(message ?? "The platform is under maintenance.")
	}
}
