import { ORPCError } from "@orpc/server"

import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"

export function assertCommissionHearingAdminRole(ctx: QlegalSessionContext): void {
	if (ctx.role !== "admin" && ctx.role !== "super_admin" && ctx.role !== "sub_org_admin") {
		throw new ORPCError("FORBIDDEN", {
			message: "Admin access required",
		})
	}
}
