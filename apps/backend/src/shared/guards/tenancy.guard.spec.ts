import { ForbiddenException } from "@nestjs/common"
import { type Reflector } from "@nestjs/core"

import { TENANT_SUB_ORG_INPUT_PATH_KEY } from "../decorators/tenant-sub-org.decorator"
import { TenancyGuard } from "./tenancy.guard"

describe("TenancyGuard", () => {
	const makeGuard = (
		path: string | undefined,
		body: unknown,
		params: Record<string, string>,
		query: Record<string, unknown> = {}
	) => {
		const reflector = {
			getAllAndOverride: jest.fn((key: string) =>
				key === TENANT_SUB_ORG_INPUT_PATH_KEY ? path : undefined
			),
		} as unknown as Reflector
		const guard = new TenancyGuard(reflector)
		const context = {
			switchToHttp: () => ({
				getRequest: () => ({
					body,
					params,
					query,
					qlegalSessionContext: {
						userId: "u1",
						role: "client" as const,
						subOrgIds: ["org-a"],
						complianceAuditAccess: false,
					},
				}),
			}),
			getHandler: () => ({}),
			getClass: () => ({}),
		}
		return { guard, context: context as Parameters<TenancyGuard["canActivate"]>[0] }
	}

	it("allows when decorator path is absent", () => {
		const { guard, context } = makeGuard(undefined, {}, {})
		expect(guard.canActivate(context)).toBe(true)
	})

	it("rejects when sub_org_id is not in session list", () => {
		const { guard, context } = makeGuard("subOrgId", { subOrgId: "org-b" }, {})
		expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
	})

	it("allows when sub_org_id matches session", () => {
		const { guard, context } = makeGuard("subOrgId", { subOrgId: "org-a" }, {})
		expect(guard.canActivate(context)).toBe(true)
	})

	it("reads nested json path used by oRPC clients", () => {
		const { guard, context } = makeGuard("subOrgId", { json: { subOrgId: "org-a" } }, {})
		expect(guard.canActivate(context)).toBe(true)
	})

	it("reads sub_org_id from query string (multipart-friendly)", () => {
		const { guard, context } = makeGuard("sub_org_id", {}, {}, { sub_org_id: "org-a" })
		expect(guard.canActivate(context)).toBe(true)
	})

	it("reads sub-org id from route params", () => {
		const reflector = {
			getAllAndOverride: jest.fn((key: string) =>
				key === TENANT_SUB_ORG_INPUT_PATH_KEY ? "id" : undefined
			),
		} as unknown as Reflector
		const guard = new TenancyGuard(reflector)
		const context = {
			switchToHttp: () => ({
				getRequest: () => ({
					body: {},
					params: { id: "org-a" },
					query: {},
					qlegalSessionContext: {
						userId: "u1",
						role: "enp" as const,
						subOrgIds: ["org-a"],
						complianceAuditAccess: false,
					},
				}),
			}),
			getHandler: () => ({}),
			getClass: () => ({}),
		} as Parameters<TenancyGuard["canActivate"]>[0]
		expect(guard.canActivate(context)).toBe(true)
	})
})
