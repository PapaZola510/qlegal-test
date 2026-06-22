import { oc } from "@orpc/contract"
import { z } from "zod"

import {
	AccessLogEntrySchema,
	AvRecordingSchema,
	ChainVerifyResultSchema,
	CommissionRecordSchema,
	ComplianceExportRequestSchema,
	ComplianceExportResultSchema,
	ComplianceListFilterSchema,
	EnbInspectFilterSchema,
	EnbInspectResultSchema,
	EnbSummarySchema,
	IdParamSchema,
	NotarizedDocumentSchema,
	RequestEnbCopyInputSchema,
	RequestEnbCopyResultSchema,
} from "./compliance-audit.schema.js"

const tags = ["Compliance Audit"]

export const complianceAuditContract = {
	listCommissionRecords: oc
		.route({
			method: "GET",
			path: "/compliance/commission-records",
			tags,
			summary: "List ENP commission records (read-only, GF-26)",
		})
		.input(ComplianceListFilterSchema)
		.output(z.array(CommissionRecordSchema)),

	listEnbs: oc
		.route({
			method: "GET",
			path: "/compliance/enbs",
			tags,
			summary: "List Electronic Notarial Books",
		})
		.input(ComplianceListFilterSchema)
		.output(z.array(EnbSummarySchema)),

	inspectEnb: oc
		.route({
			method: "GET",
			path: "/compliance/enbs/entries",
			tags,
			summary: "Virtually inspect ENB entries (read-only copy through ENF)",
		})
		.input(EnbInspectFilterSchema)
		.output(EnbInspectResultSchema),

	requestEnbCopy: oc
		.route({
			method: "POST",
			path: "/compliance/enbs/request-copy",
			tags,
			summary: "Virtually request a copy of ENB entries (logged, read-only)",
		})
		.input(RequestEnbCopyInputSchema)
		.output(RequestEnbCopyResultSchema),

	listNotarizedDocuments: oc
		.route({
			method: "GET",
			path: "/compliance/documents",
			tags,
			summary: "List notarized documents",
		})
		.input(ComplianceListFilterSchema)
		.output(z.array(NotarizedDocumentSchema)),

	getNotarizedDocument: oc
		.route({
			method: "GET",
			path: "/compliance/documents/{id}",
			tags,
			summary: "View a notarized document (logged)",
		})
		.input(IdParamSchema)
		.output(NotarizedDocumentSchema),

	listAvRecordings: oc
		.route({
			method: "GET",
			path: "/compliance/recordings",
			tags,
			summary: "List AV recordings",
		})
		.input(ComplianceListFilterSchema)
		.output(z.array(AvRecordingSchema)),

	getAvRecordingUrl: oc
		.route({
			method: "GET",
			path: "/compliance/recordings/{id}/url",
			tags,
			summary: "Signed URL for an AV recording (logged)",
		})
		.input(IdParamSchema)
		.output(z.object({ url: z.string(), expiresAt: z.string() })),

	createExport: oc
		.route({
			method: "POST",
			path: "/compliance/exports",
			tags,
			summary: "Export audit records (tamper-evident, GF-16)",
		})
		.input(ComplianceExportRequestSchema)
		.output(ComplianceExportResultSchema),

	listMyAccessLog: oc
		.route({
			method: "GET",
			path: "/compliance/access-log",
			tags,
			summary: "My own access trail",
		})
		.input(
			z.object({
				limit: z.coerce.number().int().min(1).max(200).default(50),
				offset: z.coerce.number().int().min(0).default(0),
			})
		)
		.output(z.array(AccessLogEntrySchema)),

	verifyChain: oc
		.route({
			method: "GET",
			path: "/compliance/access-log/verify",
			tags,
			summary: "Verify access-log hash-chain integrity",
		})
		.output(ChainVerifyResultSchema),
}
