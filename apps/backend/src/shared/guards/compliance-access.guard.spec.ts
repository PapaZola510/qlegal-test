import { ForbiddenException } from "@nestjs/common"

import { ComplianceAccessGuard } from "./compliance-access.guard"

describe("ComplianceAccessGuard", () => {
	function context(qlegalSessionContext: unknown) {
		return {
			switchToHttp: () => ({
				getRequest: () => ({ qlegalSessionContext }),
			}),
		} as Parameters<ComplianceAccessGuard["canActivate"]>[0]
	}

	it("rejects missing session context", () => {
		const guard = new ComplianceAccessGuard()
		expect(() => guard.canActivate(context(null))).toThrow(ForbiddenException)
	})

	it("allows platform admins without the grant flag", () => {
		const guard = new ComplianceAccessGuard()
		expect(
			guard.canActivate(context({ userId: "admin", role: "admin", complianceAuditAccess: false }))
		).toBe(true)
	})

	it("allows non-admin users with the grant flag", () => {
		const guard = new ComplianceAccessGuard()
		expect(
			guard.canActivate(context({ userId: "auditor", role: "client", complianceAuditAccess: true }))
		).toBe(true)
	})

	it.each(["client", "enp", "sub_org_admin", "none"] as const)(
		"rejects %s without the grant flag",
		role => {
			const guard = new ComplianceAccessGuard()
			expect(() =>
				guard.canActivate(context({ userId: "plain", role, complianceAuditAccess: false }))
			).toThrow(ForbiddenException)
		}
	)
})
