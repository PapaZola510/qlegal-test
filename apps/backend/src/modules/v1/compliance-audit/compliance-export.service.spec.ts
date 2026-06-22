import { createHash } from "node:crypto"

import { ComplianceExportService, toCsv } from "./compliance-export.service"

const insertValues = jest.fn()

jest.mock("@/config/env.config", () => ({
	env: { COMPLIANCE_EXPORT_SIGNING_KEY: "test-secret" },
}))

jest.mock("@/common/database/database.client", () => ({
	db: {
		insert: jest.fn(() => ({
			values: insertValues.mockReturnValue({
				returning: jest.fn(async () => [{ id: "export-1" }]),
			}),
		})),
	},
}))

jest.mock("@repo/db/schema", () => ({
	complianceExports: {
		id: "id",
	},
}))

describe("ComplianceExportService", () => {
	beforeEach(() => {
		insertValues.mockClear()
	})

	it("escapes CSV values using RFC 4180 quoting rules", () => {
		expect(toCsv([{ a: "plain", b: "comma,value", c: 'quote " value', d: "line\nbreak" }])).toBe(
			'a,b,c,d\r\nplain,"comma,value","quote "" value","line\nbreak"\r\n'
		)
	})

	it("hashes export bytes, signs the manifest, and appends an export action", async () => {
		const rows = [
			{
				enpUserId: "u1",
				enpName: "Atty. One",
				email: "one@example.com",
				npnCommissionNo: null,
				commissionValidUntil: null,
				ptrNo: null,
				ibpNo: null,
				notaryAddress: null,
				scCommissionStatus: null,
				commissionStatus: "active",
			},
		]
		const audit = {
			listCommissionRecords: jest.fn(async () => rows),
		}
		const accessLog = {
			headHash: jest.fn(async () => "chain-head"),
			append: jest.fn(async () => ({ rowHash: "row", prevHash: "chain-head" })),
		}
		const service = new ComplianceExportService(audit as never, accessLog as never)

		const result = await service.createExport(
			{ dataset: "commission_records", format: "json" },
			{
				userId: "actor-1",
				sessionId: "s1",
				role: "client",
				subOrgIds: [],
				complianceAuditAccess: true,
			}
		)

		const expectedSha = createHash("sha256")
			.update(`${JSON.stringify(rows, null, 2)}\n`)
			.digest("hex")
		expect(result.exportSha256).toBe(expectedSha)
		expect(result.manifestSignature).toEqual(expect.any(String))
		expect(result.chainHeadHash).toBe("chain-head")
		expect(insertValues).toHaveBeenCalledWith(
			expect.objectContaining({ exportSha256: expectedSha, chainHeadHash: "chain-head" })
		)
		expect(accessLog.append).toHaveBeenCalledWith(
			expect.objectContaining({ action: "export", targetId: "export-1" })
		)
	})
})
