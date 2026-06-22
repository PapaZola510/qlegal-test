import { canonical, ComplianceAccessLogService } from "./access-log.service"

const rows: Array<{
	id: string
	actorUserId: string
	actorRole: string | null
	action: string
	targetType: string | null
	targetId: string | null
	context: Record<string, unknown> | null
	prevHash: string | null
	rowHash: string
	occurredAt: Date
}> = []

jest.mock("@/common/database/database.client", () => ({
	db: {
		transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
			const tx = {
				execute: jest.fn(),
				select: jest.fn(() => ({
					from: jest.fn(() => ({
						orderBy: jest.fn(() => ({
							limit: jest.fn(async () => rows.slice(-1).map(r => ({ rowHash: r.rowHash }))),
						})),
					})),
				})),
				insert: jest.fn(() => ({
					values: jest.fn((value: (typeof rows)[number]) => {
						rows.push({ ...value, id: `row-${rows.length + 1}` })
					}),
				})),
			}
			return fn(tx)
		}),
		select: jest.fn(() => ({
			from: jest.fn(() => ({
				orderBy: jest.fn(async () => rows),
			})),
		})),
	},
}))

jest.mock("@repo/db/schema", () => ({
	complianceAccessLog: {
		id: "id",
		actorUserId: "actorUserId",
		actorRole: "actorRole",
		action: "action",
		targetType: "targetType",
		targetId: "targetId",
		context: "context",
		prevHash: "prevHash",
		rowHash: "rowHash",
		occurredAt: "occurredAt",
	},
}))

describe("ComplianceAccessLogService", () => {
	beforeEach(() => {
		rows.length = 0
	})

	it("canonicalizes JSON independent of key order", () => {
		expect(canonical({ b: 2, a: { z: 1, y: [3, 2] } })).toBe(
			canonical({ a: { y: [3, 2], z: 1 }, b: 2 })
		)
	})

	it("creates a linear hash chain and verifies clean rows", async () => {
		const service = new ComplianceAccessLogService()
		const first = await service.append({
			actorUserId: "u1",
			actorRole: "client",
			action: "list_query",
		})
		const second = await service.append({
			actorUserId: "u1",
			actorRole: "client",
			action: "view_document",
			targetId: "doc-1",
		})

		expect(first.prevHash).toBeNull()
		expect(second.prevHash).toBe(first.rowHash)
		await expect(service.verify()).resolves.toEqual({
			intact: true,
			checkedRows: 2,
			firstBrokenRowId: null,
		})
	})

	it("pinpoints a tampered row", async () => {
		const service = new ComplianceAccessLogService()
		await service.append({ actorUserId: "u1", action: "list_query" })
		await service.append({ actorUserId: "u1", action: "view_recording" })
		rows[1]!.context = { changed: true }

		await expect(service.verify()).resolves.toEqual({
			intact: false,
			checkedRows: 2,
			firstBrokenRowId: "row-2",
		})
	})
})
