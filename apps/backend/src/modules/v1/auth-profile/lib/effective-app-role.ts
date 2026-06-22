import type { clientProfiles, enpProfiles, users } from "@repo/db/schema"

import type { QlegalRole } from "@/common/session/qlegal-session.types"
import { isEnpOnboardingComplete } from "@/modules/v1/onboarding/derive-onboarding-step"

type PlatformRole = (typeof users.$inferSelect)["platformRole"]
type EnpRow = typeof enpProfiles.$inferSelect
type ClientRow = typeof clientProfiles.$inferSelect

export type EffectiveAppRole = "admin" | "super_admin" | "sub_org_admin" | "enp" | "client"

/**
 * API/session role: clients stay `client` until ENP certification onboarding is complete,
 * even when `enp_profiles` exists.
 */
export function effectiveAppRole(
	platformRole: PlatformRole,
	enp: EnpRow | undefined,
	client: ClientRow | undefined
): EffectiveAppRole {
	if (platformRole === "super_admin") return "super_admin"
	if (platformRole === "admin") return "admin"
	if (platformRole === "sub_org_admin") return "sub_org_admin"
	if (enp && isEnpOnboardingComplete(enp)) return "enp"
	if (client) return "client"
	return "client"
}

export function qlegalRoleFromProfiles(
	platformRole: PlatformRole,
	enp: EnpRow | undefined,
	client: ClientRow | undefined
): QlegalRole {
	const app = effectiveAppRole(platformRole, enp, client)
	if (app === "super_admin") return "super_admin"
	if (app === "admin") return "admin"
	if (app === "sub_org_admin") return "sub_org_admin"
	if (app === "enp") return "enp"
	if (client) return "client"
	return "none"
}
