import { readFileSync } from "node:fs"
import { join } from "node:path"

describe("ComplianceAuditService ENB inspect", () => {
	const source = readFileSync(join(__dirname, "compliance-audit.service.ts"), "utf8")

	it("implements virtual ENB inspect and copy request", () => {
		expect(source).toContain("async inspectEnb")
		expect(source).toContain("async requestEnbCopy")
		expect(source).toContain("virtualCopy: true")
	})
})
