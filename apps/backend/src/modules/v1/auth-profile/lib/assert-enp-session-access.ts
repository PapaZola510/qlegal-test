import { ORPCError } from "@orpc/server"
import { eq } from "drizzle-orm"

import { enpProfiles } from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"

/**
 * QuickSign and similar ENP APIs must not rely solely on `ctx.role === "enp"`.
 * OpenAPI/oRPC handlers sometimes hydrate `role: "none"`, and dual client+ENP accounts
 * may stay `client` until onboarding flags catch up — even when `enp_profiles` exists.
 */
export async function assertEnpSessionAccess(
	ctx: QlegalSessionContext | null
): Promise<QlegalSessionContext> {
	if (!ctx?.userId) {
		throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
	}
	if (ctx.role === "enp") return ctx

	const [enp] = await db
		.select({ userId: enpProfiles.userId })
		.from(enpProfiles)
		.where(eq(enpProfiles.userId, ctx.userId))
		.limit(1)
	if (enp) return ctx

	throw new ORPCError("FORBIDDEN", { message: "Only ENPs can use QuickSign" })
}
