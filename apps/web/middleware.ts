import { NextResponse, type NextRequest } from "next/server"

import { env } from "@/env"

function nestApiBase(): string {
	const internal = env.INTERNAL_API_BASE_URL?.replace(/\/$/, "")
	if (internal) return internal
	if (env.NODE_ENV === "development") {
		const proxyOrigin = env.BACKEND_PROXY_ORIGIN?.replace(/\/$/, "") ?? "http://127.0.0.1:3000"
		return `${proxyOrigin}/api`
	}
	return env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
}

function isAllowedPath(pathname: string): boolean {
	// Static/Next internals
	if (pathname.startsWith("/_next/")) return true
	if (pathname === "/favicon.ico") return true

	// Always allow API routes (backend guard handles MFA for API access).
	if (pathname.startsWith("/api/")) return true

	// Auth/public entry points
	if (pathname === "/") return true
	if (pathname.startsWith("/login")) return true
	if (pathname.startsWith("/register")) return true
	if (pathname.startsWith("/oauth/callback")) return true

	// MFA step itself (and optional email-verify page, if still reachable)
	if (pathname.startsWith("/mfa")) return true
	if (pathname.startsWith("/verify-email")) return true

	return false
}

/**
 * URL prefixes that stay reachable while maintenance mode is on, so an admin
 * can sign in (and pass MFA) and reach `/admin` to toggle the switch off.
 * `/admin/*` is gated server-side by `(admin)/layout.tsx`.
 */
const MAINTENANCE_BYPASS_PREFIXES = [
	"/maintenance",
	"/admin",
	"/login",
	"/register",
	"/mfa",
	"/verify-email",
	"/oauth",
	"/sso",
	"/session",
	"/onboarding",
]

function isMaintenanceBypass(pathname: string): boolean {
	if (pathname.startsWith("/_next/")) return true
	if (pathname === "/favicon.ico") return true
	if (pathname.startsWith("/api/")) return true
	return MAINTENANCE_BYPASS_PREFIXES.some(
		p => pathname === p || pathname.startsWith(`${p}/`)
	)
}

const MAINTENANCE_STATUS_TTL_MS = 15_000
let maintenanceStatusCache: { enabled: boolean; at: number } | null = null

async function isDbMaintenanceOn(): Promise<boolean> {
	const now = Date.now()
	if (maintenanceStatusCache && now - maintenanceStatusCache.at < MAINTENANCE_STATUS_TTL_MS) {
		return maintenanceStatusCache.enabled
	}
	const base = nestApiBase()
	const version = env.NEXT_PUBLIC_API_VERSION.replace(/^\//, "")
	try {
		const res = await fetch(`${base}/${version}/maintenance/status`, {
			headers: { accept: "application/json" },
			cache: "no-store",
		})
		if (!res.ok) {
			// Fail open — never lock the site on a transient API error.
			maintenanceStatusCache = { enabled: false, at: now }
			return false
		}
		const data = (await res.json()) as { enabled?: boolean } | null
		const enabled = data?.enabled === true
		maintenanceStatusCache = { enabled, at: now }
		return enabled
	} catch {
		maintenanceStatusCache = { enabled: false, at: now }
		return false
	}
}

function hasLikelyAuthCookie(req: NextRequest): boolean {
	// Better Auth cookie name is typically `better-auth.session_token` (but can vary).
	// We keep it permissive and just check for any cookie named `session_token` or containing `better-auth`.
	for (const c of req.cookies.getAll()) {
		const name = c.name.toLowerCase()
		if (name.includes("better-auth")) return true
		if (name.includes("session_token")) return true
	}
	return false
}

export async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl

	// Maintenance-mode gate (runs before MFA gating).
	if (!isMaintenanceBypass(pathname)) {
		const envOn = process.env.MAINTENANCE_MODE?.toLowerCase() === "true"
		if (envOn || (await isDbMaintenanceOn())) {
			const next = req.nextUrl.clone()
			next.pathname = "/maintenance"
			next.search = ""
			return NextResponse.rewrite(next)
		}
	}

	if (isAllowedPath(pathname)) return NextResponse.next()

	// If there's clearly no auth cookie, don't attempt MFA gating (public visitor).
	if (!hasLikelyAuthCookie(req)) return NextResponse.next()

	const base = nestApiBase()
	const version = env.NEXT_PUBLIC_API_VERSION.replace(/^\//, "")
	const url = `${base}/${version}/email/mfa/status`

	try {
		const cookie = req.headers.get("cookie") ?? ""
		const res = await fetch(url, {
			headers: cookie ? { cookie } : undefined,
			cache: "no-store",
		})
		if (!res.ok) return NextResponse.next()
		const data = (await res.json()) as { mfaVerified?: boolean } | null
		if (data && data.mfaVerified === false) {
			const next = req.nextUrl.clone()
			next.pathname = "/mfa"
			next.search = ""
			return NextResponse.redirect(next)
		}
	} catch {
		// If backend is restarting / unreachable, fall through to avoid trapping users in dev.
	}

	return NextResponse.next()
}

export const config = {
	matcher: [
		// Run on all pages except Next internals and common static assets.
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff|woff2|ttf)$).*)",
	],
}
