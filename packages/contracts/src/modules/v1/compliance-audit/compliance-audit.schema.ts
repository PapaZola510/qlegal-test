import { z } from "zod"

import { ActTypeEnum, ScCommissionStatusEnum, ScStatusEnum } from "../shared/enums.js"

export const ComplianceDateRangeSchema = z.object({
	from: z.string().optional(),
	to: z.string().optional(),
})

export const CommissionRecordSchema = z.object({
	enpUserId: z.string(),
	enpName: z.string(),
	email: z.string(),
	npnCommissionNo: z.string().nullable(),
	commissionValidUntil: z.string().nullable(),
	ptrNo: z.string().nullable(),
	ibpNo: z.string().nullable(),
	notaryAddress: z.string().nullable(),
	scCommissionStatus: ScCommissionStatusEnum.nullable(),
	commissionStatus: z.enum(["active", "expired", "suspended"]),
})

export const EnbSummarySchema = z.object({
	enpUserId: z.string(),
	enpName: z.string(),
	bookNo: z.string(),
	actCount: z.number().int(),
	firstActAt: z.string().nullable(),
	lastActAt: z.string().nullable(),
})

/** Filter for virtual ENB inspect / copy request (ENF admin, read-only). */
export const EnbInspectFilterSchema = z.object({
	enpUserId: z.string().min(1),
	bookNo: z.string().min(1),
	dateRange: ComplianceDateRangeSchema.optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50),
	offset: z.coerce.number().int().min(0).default(0),
})

export const EnbEntrySchema = z.object({
	id: z.string(),
	actNumber: z.string(),
	actType: ActTypeEnum,
	title: z.string(),
	parties: z.array(z.object({ name: z.string(), role: z.string() })),
	executedAt: z.string(),
	bookNo: z.string().nullable(),
	pageNo: z.string().nullable(),
	feePhp: z.number().int().nullable(),
	scStatus: ScStatusEnum,
	hasDocument: z.boolean(),
})

export const EnbInspectResultSchema = z.object({
	enpUserId: z.string(),
	enpName: z.string(),
	bookNo: z.string(),
	actCount: z.number().int(),
	firstActAt: z.string().nullable(),
	lastActAt: z.string().nullable(),
	entries: z.array(EnbEntrySchema),
})

export const RequestEnbCopyInputSchema = EnbInspectFilterSchema.extend({
	note: z.string().max(500).optional(),
})

export const RequestEnbCopyResultSchema = EnbInspectResultSchema.extend({
	requestId: z.string(),
	requestedAt: z.string(),
	virtualCopy: z.literal(true),
})

export const NotarizedDocumentSchema = z.object({
	id: z.string(),
	enpUserId: z.string(),
	enpName: z.string(),
	actNumber: z.string(),
	actType: ActTypeEnum,
	title: z.string(),
	bookNo: z.string().nullable(),
	pageNo: z.string().nullable(),
	executedAt: z.string(),
	scStatus: ScStatusEnum,
	hasDocument: z.boolean(),
	/** Meeting document linked from registry act description (`qlegal-file:{id}`). */
	documentFileObjectId: z.string().nullable(),
})

export const AvRecordingSchema = z.object({
	id: z.string(),
	sessionId: z.string().nullable(),
	appointmentId: z.string().nullable(),
	enpUserId: z.string().nullable(),
	enpName: z.string().nullable(),
	sha256: z.string(),
	sizeBytes: z.number(),
	mime: z.string(),
	createdAt: z.string(),
})

export const ComplianceListFilterSchema = z.object({
	enpUserId: z.string().optional(),
	bookNo: z.string().optional(),
	scStatus: ScStatusEnum.optional(),
	dateRange: ComplianceDateRangeSchema.optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50),
	offset: z.coerce.number().int().min(0).default(0),
})

export const IdParamSchema = z.object({ id: z.string().min(1) })

export const ComplianceExportRequestSchema = z.object({
	dataset: z.enum(["commission_records", "enb", "notarized_documents", "av_recordings"]),
	format: z.enum(["csv", "json"]),
	filter: ComplianceListFilterSchema.omit({ limit: true, offset: true }).optional(),
})

export const ComplianceExportResultSchema = z.object({
	exportId: z.string(),
	fileObjectId: z.string().nullable(),
	downloadUrl: z.string().nullable(),
	exportSha256: z.string(),
	chainHeadHash: z.string().nullable(),
	manifestSignature: z.string().nullable(),
	rowCount: z.number().int(),
})

export const AccessLogEntrySchema = z.object({
	id: z.string(),
	actorUserId: z.string(),
	actorRole: z.string().nullable(),
	action: z.string(),
	targetType: z.string().nullable(),
	targetId: z.string().nullable(),
	prevHash: z.string().nullable(),
	rowHash: z.string(),
	occurredAt: z.string(),
})

export const ChainVerifyResultSchema = z.object({
	intact: z.boolean(),
	checkedRows: z.number().int(),
	firstBrokenRowId: z.string().nullable(),
})

export type ComplianceDateRange = z.infer<typeof ComplianceDateRangeSchema>
export type CommissionRecord = z.infer<typeof CommissionRecordSchema>
export type EnbSummary = z.infer<typeof EnbSummarySchema>
export type EnbInspectFilter = z.infer<typeof EnbInspectFilterSchema>
export type EnbEntry = z.infer<typeof EnbEntrySchema>
export type EnbInspectResult = z.infer<typeof EnbInspectResultSchema>
export type RequestEnbCopyInput = z.infer<typeof RequestEnbCopyInputSchema>
export type RequestEnbCopyResult = z.infer<typeof RequestEnbCopyResultSchema>
export type NotarizedDocument = z.infer<typeof NotarizedDocumentSchema>
export type AvRecording = z.infer<typeof AvRecordingSchema>
export type ComplianceListFilter = z.infer<typeof ComplianceListFilterSchema>
export type ComplianceExportRequest = z.infer<typeof ComplianceExportRequestSchema>
export type ComplianceExportResult = z.infer<typeof ComplianceExportResultSchema>
export type AccessLogEntry = z.infer<typeof AccessLogEntrySchema>
export type ChainVerifyResult = z.infer<typeof ChainVerifyResultSchema>
