import { Controller, Req, UseGuards } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import { v1 } from "@/config/api-versions.config"
import { ComplianceAccessGuard } from "@/shared/guards/compliance-access.guard"
import { QlegalSessionGuard } from "@/shared/guards/qlegal-session.guard"

import { ComplianceAccessLogService } from "./access-log.service"
import { ComplianceAuditService } from "./compliance-audit.service"
import { ComplianceExportService } from "./compliance-export.service"

function actorFrom(req: Request, session: UserSession) {
	const actorUserId = session.user?.id
	if (!actorUserId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
	return { actorUserId, actorRole: req.qlegalSessionContext?.role ?? null }
}

/**
 * Read-only compliance audit endpoints for Electronic Notarization Data Sharing
 * Guidelines GF-16 and GF-26. Every read is logged to the tamper-evident trail.
 */
@Controller()
@UseGuards(QlegalSessionGuard, ComplianceAccessGuard)
export class ComplianceAuditController {
	constructor(
		private readonly service: ComplianceAuditService,
		private readonly accessLog: ComplianceAccessLogService,
		private readonly exports: ComplianceExportService
	) {}

	@Implement(v1.complianceAudit.listCommissionRecords)
	async listCommissionRecords(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.complianceAudit.listCommissionRecords).handler(async ({ input }) => {
			const actor = actorFrom(req, session)
			await this.accessLog.append({
				...actor,
				action: "list_query",
				targetType: "enp_profile",
				context: { dataset: "commission_records", filter: input },
			})
			return this.service.listCommissionRecords(input)
		})
	}

	@Implement(v1.complianceAudit.listEnbs)
	async listEnbs(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.complianceAudit.listEnbs).handler(async ({ input }) => {
			const actor = actorFrom(req, session)
			await this.accessLog.append({
				...actor,
				action: "list_query",
				targetType: "enb",
				context: { dataset: "enb", filter: input },
			})
			return this.service.listEnbs(input)
		})
	}

	@Implement(v1.complianceAudit.inspectEnb)
	async inspectEnb(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.complianceAudit.inspectEnb).handler(async ({ input }) => {
			const actor = actorFrom(req, session)
			const result = await this.service.inspectEnb(input)
			const targetId = `${input.enpUserId}:${input.bookNo}`
			await this.accessLog.append({
				...actor,
				action: "view_enb",
				targetType: "enb",
				targetId,
				context: { filter: input, entryCount: result.entries.length },
			})
			if ((input.offset ?? 0) === 0) {
				await this.accessLog.append({
					...actor,
					action: "request_enb_copy",
					targetType: "enb",
					targetId,
					context: {
						requestId: randomUUID(),
						virtualCopy: true,
						viaInspect: true,
						entryCount: result.entries.length,
						actCount: result.actCount,
						filter: input,
					},
				})
			}
			return result
		})
	}

	@Implement(v1.complianceAudit.requestEnbCopy)
	async requestEnbCopy(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.complianceAudit.requestEnbCopy).handler(async ({ input }) => {
			const actor = actorFrom(req, session)
			const result = await this.service.requestEnbCopy(input)
			await this.accessLog.append({
				...actor,
				action: "request_enb_copy",
				targetType: "enb",
				targetId: `${input.enpUserId}:${input.bookNo}`,
				context: {
					requestId: result.requestId,
					note: input.note ?? null,
					entryCount: result.entries.length,
					filter: input,
				},
			})
			return result
		})
	}

	@Implement(v1.complianceAudit.listNotarizedDocuments)
	async listNotarizedDocuments(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.complianceAudit.listNotarizedDocuments).handler(async ({ input }) => {
			const actor = actorFrom(req, session)
			await this.accessLog.append({
				...actor,
				action: "list_query",
				targetType: "registry_act",
				context: { dataset: "notarized_documents", filter: input },
			})
			return this.service.listNotarizedDocuments(input)
		})
	}

	@Implement(v1.complianceAudit.getNotarizedDocument)
	async getNotarizedDocument(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.complianceAudit.getNotarizedDocument).handler(async ({ input }) => {
			const actor = actorFrom(req, session)
			await this.accessLog.append({
				...actor,
				action: "view_document",
				targetType: "registry_act",
				targetId: input.id,
			})
			return this.service.getNotarizedDocument(input.id)
		})
	}

	@Implement(v1.complianceAudit.listAvRecordings)
	async listAvRecordings(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.complianceAudit.listAvRecordings).handler(async ({ input }) => {
			const actor = actorFrom(req, session)
			await this.accessLog.append({
				...actor,
				action: "list_query",
				targetType: "file_object",
				context: { dataset: "av_recordings", filter: input },
			})
			return this.service.listAvRecordings(input)
		})
	}

	@Implement(v1.complianceAudit.getAvRecordingUrl)
	async getAvRecordingUrl(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.complianceAudit.getAvRecordingUrl).handler(async ({ input }) => {
			const actor = actorFrom(req, session)
			await this.accessLog.append({
				...actor,
				action: "view_recording",
				targetType: "file_object",
				targetId: input.id,
			})
			return this.service.getAvRecordingUrl(input.id)
		})
	}

	@Implement(v1.complianceAudit.createExport)
	async createExport(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.complianceAudit.createExport).handler(async ({ input }) => {
			actorFrom(req, session)
			const ctx = req.qlegalSessionContext
			if (!ctx) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.exports.createExport(input, ctx)
		})
	}

	@Implement(v1.complianceAudit.listMyAccessLog)
	async listMyAccessLog(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.complianceAudit.listMyAccessLog).handler(async ({ input }) => {
			const actor = actorFrom(req, session)
			const rows = await this.accessLog.listForActor(actor.actorUserId, input.limit, input.offset)
			return rows.map(row => ({
				id: row.id,
				actorUserId: row.actorUserId,
				actorRole: row.actorRole,
				action: row.action,
				targetType: row.targetType,
				targetId: row.targetId,
				prevHash: row.prevHash,
				rowHash: row.rowHash,
				occurredAt: row.occurredAt.toISOString(),
			}))
		})
	}

	@Implement(v1.complianceAudit.verifyChain)
	async verifyChain(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.complianceAudit.verifyChain).handler(async () => {
			const actor = actorFrom(req, session)
			const result = await this.accessLog.verify()
			await this.accessLog.append({
				...actor,
				action: "verify_chain",
				targetType: "compliance_access_log",
				context: result,
			})
			return result
		})
	}
}
