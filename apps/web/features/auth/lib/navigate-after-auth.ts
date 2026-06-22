import type { Route } from "next"
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"

import type { UserProfile } from "@repo/contracts"

import { orpcClient } from "@/services/orpc/client"

import { consumePostLoginRedirect } from "./post-login-redirect"
import { shouldRedirectToOnboarding } from "./should-redirect-to-onboarding"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- NestedClient inference gap vs OpenAPI link
const rpc = orpcClient as any

interface NavigateAfterAuthOptions {
	documentReload?: boolean
}

function replaceRoute(
	router: AppRouterInstance,
	path: string,
	options?: NavigateAfterAuthOptions
): void {
	if (options?.documentReload && typeof window !== "undefined") {
		window.location.replace(path)
		return
	}
	router.replace(path as Route)
}

function safeAppPath(path: string | null): string | null {
	if (!path) return null
	if (!path.startsWith("/") || path.startsWith("//")) return null
	return path
}

/**
 * Email/password auth must always complete `/mfa` before protected app routes.
 * Do not consume the stored post-login redirect here; MFA success will use it.
 */
export async function navigateToMfa(router: AppRouterInstance): Promise<void> {
	router.replace("/mfa")
}

/**
 * After OAuth or successful MFA, resolve the next route. Calling `authProfile.me()`
 * ensures a client profile exists and triggers DocOnChain organization auto-join
 * when configured.
 */
export async function navigateAfterAuth(
	router: AppRouterInstance,
	postAuthRedirectPath?: string | null,
	options?: NavigateAfterAuthOptions
): Promise<void> {
	const storedRedirect = safeAppPath(
		consumePostLoginRedirect() ?? postAuthRedirectPath?.trim() ?? null
	)
	if (storedRedirect) {
		replaceRoute(router, storedRedirect, options)
		return
	}

	let nextPath: Route = "/dashboard"
	try {
		const me = (await rpc.authProfile.me()) as UserProfile | undefined

		if (me && shouldRedirectToOnboarding(me)) {
			nextPath = "/onboarding"
		}
	} catch (error) {
		console.error("[Auth] profile/me after sign-in (redirect decision)", error)
	}

	replaceRoute(router, nextPath, options)
}
