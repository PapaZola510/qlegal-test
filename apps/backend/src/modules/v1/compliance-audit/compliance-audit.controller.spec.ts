import { readFileSync } from "node:fs"
import { join } from "node:path"

describe("ComplianceAuditController source contract", () => {
	const source = readFileSync(join(__dirname, "compliance-audit.controller.ts"), "utf8")

	it("logs each read route through the access-log service", () => {
		for (const action of [
			"list_query",
			"view_enb",
			"request_enb_copy",
			"view_document",
			"view_recording",
		]) {
			expect(source).toContain(`action: "${action}"`)
		}
		expect(source.match(/this\.accessLog\.append/g)?.length ?? 0).toBeGreaterThanOrEqual(9)
	})

	it("allows only read-side mutations (export and virtual ENB copy request)", () => {
		expect(source).toContain("createExport")
		expect(source).toContain("requestEnbCopy")
		expect(source).not.toMatch(/update[A-Z]|delete[A-Z]|revoke[A-Z]|grant[A-Z]/)
	})

	it("records actor role from request session context", () => {
		expect(source).toContain("req.qlegalSessionContext?.role ?? null")
	})
})
