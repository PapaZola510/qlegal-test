import type { Route } from "next"

import type { UserProfile } from "@repo/contracts"

import type { SiteRole } from "@/features/navigation/nav-config"

type ProfileFocus = "kyc" | "notarial"

/** Platform admins manage commission work from `/admin/*` and should stay in that shell for profile/KYC too. */
export function usesAdminProfileShell(role: UserProfile["role"] | null | undefined): boolean {
	return role === "admin" || role === "super_admin"
}

function usesAdminProfileShellForSiteRole(role: SiteRole | null | undefined): boolean {
	return role === "admin" || role === "super_admin"
}

export function profilePath(
	role: UserProfile["role"] | null | undefined,
	options?: { focus?: ProfileFocus; hashKyc?: boolean }
): Route {
	const base = usesAdminProfileShell(role) ? "/admin/profile" : "/profile"
	const params = new URLSearchParams()
	if (options?.focus) {
		params.set("focus", options.focus)
	}
	const query = params.toString()
	const withQuery = query ? `${base}?${query}` : base
	if (options?.hashKyc) {
		return `${withQuery}#profile-kyc-verification` as Route
	}
	return withQuery as Route
}

export function profilePathForSiteRole(
	role: SiteRole | null | undefined,
	options?: { focus?: ProfileFocus; hashKyc?: boolean }
): Route {
	const base = usesAdminProfileShellForSiteRole(role) ? "/admin/profile" : "/profile"
	const params = new URLSearchParams()
	if (options?.focus) {
		params.set("focus", options.focus)
	}
	const query = params.toString()
	const withQuery = query ? `${base}?${query}` : base
	if (options?.hashKyc) {
		return `${withQuery}#profile-kyc-verification` as Route
	}
	return withQuery as Route
}
