import { Injectable } from "@nestjs/common"
import { createHash } from "node:crypto"
import { asc, desc, eq, sql } from "drizzle-orm"

import { complianceAccessLog } from "@repo/db/schema"

import { db } from "@/common/database/database.client"

export type AccessAction =
	| "view_commission"
	| "view_enb"
	| "request_enb_copy"
	| "view_document"
	| "view_recording"
	| "download_recording"
	| "list_query"
	| "export"
	| "verify_chain"

export interface AppendInput {
	actorUserId: string
	actorRole?: string | null
	action: AccessAction
	targetType?: string | null
	targetId?: string | null
	context?: Record<string, unknown> | null
}

/** Deterministic canonical JSON (stable key order) for hashing. */
export function canonical(obj: unknown): string {
	if (obj === null || typeof obj !== "object") return JSON.stringify(obj)
	if (Array.isArray(obj)) return `[${obj.map(canonical).join(",")}]`
	const record = obj as Record<string, unknown>
	const keys = Object.keys(record).sort()
	return `{${keys.map(k => `${JSON.stringify(k)}:${canonical(record[k])}`).join(",")}}`
}

function hashRow(prevHash: string | null, core: Record<string, unknown>): string {
	return createHash("sha256")
		.update((prevHash ?? "") + canonical(core))
		.digest("hex")
}

@Injectable()
export class ComplianceAccessLogService {
	async append(input: AppendInput): Promise<{ rowHash: string; prevHash: string | null }> {
		return db.transaction(async tx => {
			await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('compliance_access_log'))`)
			const [head] = await tx
				.select({ rowHash: complianceAccessLog.rowHash })
				.from(complianceAccessLog)
				.orderBy(desc(complianceAccessLog.occurredAt), desc(complianceAccessLog.id))
				.limit(1)

			const prevHash = head?.rowHash ?? null
			const occurredAt = new Date()
			const core = {
				actorUserId: input.actorUserId,
				actorRole: input.actorRole ?? null,
				action: input.action,
				targetType: input.targetType ?? null,
				targetId: input.targetId ?? null,
				context: input.context ?? null,
				occurredAt: occurredAt.toISOString(),
			}
			const rowHash = hashRow(prevHash, core)
			await tx.insert(complianceAccessLog).values({ ...core, prevHash, rowHash, occurredAt })
			return { rowHash, prevHash }
		})
	}

	async verify(): Promise<{
		intact: boolean
		checkedRows: number
		firstBrokenRowId: string | null
	}> {
		const rows = await db
			.select()
			.from(complianceAccessLog)
			.orderBy(asc(complianceAccessLog.occurredAt), asc(complianceAccessLog.id))
		let prev: string | null = null
		for (const r of rows) {
			const core = {
				actorUserId: r.actorUserId,
				actorRole: r.actorRole,
				action: r.action,
				targetType: r.targetType,
				targetId: r.targetId,
				context: r.context,
				occurredAt: r.occurredAt.toISOString(),
			}
			const expected = hashRow(prev, core)
			if (r.prevHash !== prev || r.rowHash !== expected) {
				return { intact: false, checkedRows: rows.length, firstBrokenRowId: r.id }
			}
			prev = r.rowHash
		}
		return { intact: true, checkedRows: rows.length, firstBrokenRowId: null }
	}

	async listForActor(actorUserId: string, limit: number, offset: number) {
		return db
			.select()
			.from(complianceAccessLog)
			.where(eq(complianceAccessLog.actorUserId, actorUserId))
			.orderBy(desc(complianceAccessLog.occurredAt))
			.limit(limit)
			.offset(offset)
	}

	/** Current chain head rowHash for binding exports. */
	async headHash(): Promise<string | null> {
		const [head] = await db
			.select({ rowHash: complianceAccessLog.rowHash })
			.from(complianceAccessLog)
			.orderBy(desc(complianceAccessLog.occurredAt), desc(complianceAccessLog.id))
			.limit(1)
		return head?.rowHash ?? null
	}
}
