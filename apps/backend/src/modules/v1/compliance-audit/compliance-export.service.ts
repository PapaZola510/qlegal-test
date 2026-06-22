import { Injectable } from "@nestjs/common"
import { createHash, createHmac } from "node:crypto"

import { complianceExports } from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import type { V1Inputs, V1Outputs } from "@/config/contract-types"
import { env } from "@/config/env.config"

import { canonical, ComplianceAccessLogService } from "./access-log.service"
import { ComplianceAuditService } from "./compliance-audit.service"

type ExportInput = V1Inputs["complianceAudit"]["createExport"]
type ExportResult = V1Outputs["complianceAudit"]["createExport"]

type ExportRow = Record<string, unknown>

function escapeCsvValue(value: unknown): string {
	if (value === null || value === undefined) return ""
	const raw = value instanceof Date ? value.toISOString() : String(value)
	if (!/[",\r\n]/.test(raw)) return raw
	return `"${raw.replace(/"/g, '""')}"`
}

export function toCsv(rows: ExportRow[]): string {
	if (rows.length === 0) return ""
	const headers = Array.from(new Set(rows.flatMap(row => Object.keys(row))))
	const lines = [headers.map(escapeCsvValue).join(",")]
	for (const row of rows) {
		lines.push(headers.map(header => escapeCsvValue(row[header])).join(","))
	}
	return `${lines.join("\r\n")}\r\n`
}

function dataUrlFor(bytes: Buffer, mime: string): string {
	return `data:${mime};base64,${bytes.toString("base64")}`
}

@Injectable()
export class ComplianceExportService {
	constructor(
		private readonly audit: ComplianceAuditService,
		private readonly accessLog: ComplianceAccessLogService
	) {}

	private async collectRows(input: ExportInput): Promise<ExportRow[]> {
		const filter = input.filter ?? {}
		const pageSize = 200
		const rows: ExportRow[] = []
		for (let offset = 0; ; offset += pageSize) {
			const pageFilter = { ...filter, limit: pageSize, offset }
			let page: unknown[]
			switch (input.dataset) {
				case "commission_records":
					page = await this.audit.listCommissionRecords(pageFilter)
					break
				case "enb":
					page = await this.audit.listEnbs(pageFilter)
					break
				case "notarized_documents":
					page = await this.audit.listNotarizedDocuments(pageFilter)
					break
				case "av_recordings":
					page = await this.audit.listAvRecordings(pageFilter)
					break
			}
			rows.push(...(page as ExportRow[]))
			if (page.length < pageSize) break
		}
		return rows
	}

	async createExport(input: ExportInput, ctx: QlegalSessionContext): Promise<ExportResult> {
		const rows = await this.collectRows(input)
		const mime = input.format === "csv" ? "text/csv" : "application/json"
		const body = input.format === "csv" ? toCsv(rows) : `${JSON.stringify(rows, null, 2)}\n`
		const bytes = Buffer.from(body, "utf8")
		const exportSha256 = createHash("sha256").update(bytes).digest("hex")
		const chainHeadHash = await this.accessLog.headHash()
		const generatedAt = new Date().toISOString()
		const manifest = {
			actorUserId: ctx.userId,
			dataset: input.dataset,
			format: input.format,
			generatedAt,
			rowCount: rows.length,
			filter: input.filter ?? null,
			exportSha256,
			chainHeadHash,
		}
		const signingKey = env.COMPLIANCE_EXPORT_SIGNING_KEY?.trim()
		const manifestSignature = signingKey
			? createHmac("sha256", signingKey).update(canonical(manifest)).digest("hex")
			: null

		const [row] = await db
			.insert(complianceExports)
			.values({
				actorUserId: ctx.userId,
				dataset: input.dataset,
				format: input.format,
				filter: input.filter ?? null,
				rowCount: rows.length,
				fileObjectId: null,
				exportSha256,
				chainHeadHash,
				manifestSignature,
				manifest,
			})
			.returning({ id: complianceExports.id })
		const exportId = row!.id

		await this.accessLog.append({
			actorUserId: ctx.userId,
			actorRole: ctx.role,
			action: "export",
			targetType: "compliance_export",
			targetId: exportId,
			context: {
				dataset: input.dataset,
				format: input.format,
				rowCount: rows.length,
				exportSha256,
			},
		})

		return {
			exportId,
			fileObjectId: null,
			downloadUrl: dataUrlFor(bytes, mime),
			exportSha256,
			chainHeadHash,
			manifestSignature,
			rowCount: rows.length,
		}
	}
}
