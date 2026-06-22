import { Injectable } from "@nestjs/common"
import { ORPCError } from "@orpc/server"
import { and, desc, eq, inArray, sql } from "drizzle-orm"

import type {
	CreateCtcPaymentResult,
	CtcPaymentStatus,
	EnbAccessRequest,
	MeetingPaymentBrands,
	RequestCertifiedTrueCopy,
	SignedDocument,
} from "@repo/contracts"
import {
	appointmentDocuments,
	appointments,
	clientProfiles,
	enbAccessRequests,
	enpProfiles,
	fileObjects,
	meetingSignatureRequests,
	paymentIntents,
	quicksignProjects,
} from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { RegistryService } from "@/modules/v1/registry/registry.service"
import { dateToIsoOrEpoch } from "@/utils/safe-timestamp"

import { CtcPaymentService } from "./ctc-payment.service"

function formatEnpName(row: {
	prefix: string | null
	firstName: string
	lastName: string
	suffix: string | null
}): string {
	const parts = [row.prefix, row.firstName, row.lastName, row.suffix].filter(Boolean)
	return parts.join(" ").trim() || "ENP"
}

function fileNameFromS3Key(key: string): string {
	const parts = key.split("/")
	return parts[parts.length - 1] ?? key
}

@Injectable()
export class SignedService {
	constructor(
		private readonly registry: RegistryService,
		private readonly ctcPayment: CtcPaymentService
	) {}

	private async assertClientAccess(ctx: QlegalSessionContext): Promise<void> {
		if (ctx.role === "client") return
		if (
			ctx.role === "enp" ||
			ctx.role === "admin" ||
			ctx.role === "super_admin" ||
			ctx.role === "sub_org_admin"
		) {
			throw new ORPCError("FORBIDDEN", {
				message: "Signed documents are available to clients only",
			})
		}

		const [clientRow] = await db
			.select({ userId: clientProfiles.userId })
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, ctx.userId))
			.limit(1)
		if (!clientRow) {
			throw new ORPCError("FORBIDDEN", {
				message: "Signed documents are available to clients only",
			})
		}
	}

	async listDocuments(ctx: QlegalSessionContext | null): Promise<SignedDocument[]> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		await this.assertClientAccess(ctx)

		const sigAgg = db
			.select({
				appointmentId: meetingSignatureRequests.appointmentId,
				documentFileObjectId: meetingSignatureRequests.documentFileObjectId,
				totalCount: sql<number>`count(*)::int`.as("total_count"),
				signedCount:
					sql<number>`count(*) filter (where ${meetingSignatureRequests.status} = 'signed')::int`.as(
						"signed_count"
					),
				lastSignedAt: sql<Date | null>`max(${meetingSignatureRequests.signedAt})`.as(
					"last_signed_at"
				),
			})
			.from(meetingSignatureRequests)
			.groupBy(
				meetingSignatureRequests.appointmentId,
				meetingSignatureRequests.documentFileObjectId
			)
			.as("sig_agg")

		const rows = await db
			.select({
				appointmentId: appointments.id,
				fileObjectId: appointmentDocuments.fileObjectId,
				displayName: appointmentDocuments.displayName,
				documentType: appointmentDocuments.documentType,
				enpUserId: appointments.enpUserId,
				kind: appointments.kind,
				appointmentStatus: appointments.status,
				notarizationType: appointments.notarizationType,
				docLinkedAt: appointmentDocuments.createdAt,
				totalCount: sigAgg.totalCount,
				signedCount: sigAgg.signedCount,
				lastSignedAt: sigAgg.lastSignedAt,
				s3Key: fileObjects.s3Key,
			})
			.from(appointments)
			.innerJoin(appointmentDocuments, eq(appointmentDocuments.appointmentId, appointments.id))
			.innerJoin(fileObjects, eq(fileObjects.id, appointmentDocuments.fileObjectId))
			.innerJoin(
				sigAgg,
				and(
					eq(sigAgg.appointmentId, appointments.id),
					eq(sigAgg.documentFileObjectId, appointmentDocuments.fileObjectId)
				)
			)
			.where(eq(appointments.clientUserId, ctx.userId))
			.orderBy(desc(appointments.createdAt), desc(appointmentDocuments.createdAt))

		const candidateRows = rows.filter(r => (r.totalCount ?? 0) >= 1)
		if (candidateRows.length === 0) return []

		const qsKeys = new Map<string, { status: string; completedAt: Date | null }>()
		const enpFilePairs = [
			...new Map(candidateRows.map(r => [`${r.enpUserId}:${r.fileObjectId}`, r] as const)).values(),
		]
		for (const chunk of chunkArray(enpFilePairs, 40)) {
			const enpIds = [...new Set(chunk.map(r => r.enpUserId))]
			const fileIds = [...new Set(chunk.map(r => r.fileObjectId))]
			const qsRows = await db
				.select({
					enpUserId: quicksignProjects.enpUserId,
					documentFileObjectId: quicksignProjects.documentFileObjectId,
					status: quicksignProjects.status,
					completedAt: quicksignProjects.completedAt,
				})
				.from(quicksignProjects)
				.where(
					and(
						inArray(quicksignProjects.enpUserId, enpIds),
						inArray(quicksignProjects.documentFileObjectId, fileIds)
					)
				)
				.orderBy(desc(quicksignProjects.createdAt))

			for (const q of qsRows) {
				const key = `${q.enpUserId}:${q.documentFileObjectId}`
				if (!qsKeys.has(key)) {
					qsKeys.set(key, { status: q.status, completedAt: q.completedAt })
				}
			}
		}

		const completedRows = candidateRows.filter(r => {
			const qs = qsKeys.get(`${r.enpUserId}:${r.fileObjectId}`)
			const allSigned = (r.signedCount ?? 0) >= (r.totalCount ?? 0)
			const qsDone = qs?.status === "completed"
			if (!allSigned && !qsDone) return false

			const isQuickSign = r.kind === "quicksign"
			if (isQuickSign) {
				return qsDone || allSigned || r.appointmentStatus === "ended"
			}
			return r.appointmentStatus === "ended" && (allSigned || qsDone)
		})

		if (completedRows.length === 0) return []

		const ctcRows = await db
			.select({
				id: enbAccessRequests.id,
				appointmentId: enbAccessRequests.appointmentId,
				documentFileObjectId: enbAccessRequests.documentFileObjectId,
				outcome: enbAccessRequests.outcome,
				refusalReason: enbAccessRequests.refusalReason,
				requestedAt: enbAccessRequests.requestedAt,
				decidedAt: enbAccessRequests.decidedAt,
				requesterPaymentMethod: enbAccessRequests.requesterPaymentMethod,
				paymentIntentId: enbAccessRequests.paymentIntentId,
				paymentStatus: paymentIntents.status,
			})
			.from(enbAccessRequests)
			.leftJoin(paymentIntents, eq(enbAccessRequests.paymentIntentId, paymentIntents.id))
			.where(
				and(
					eq(enbAccessRequests.requesterUserId, ctx.userId),
					eq(enbAccessRequests.certifiedTrueCopy, true)
				)
			)
			.orderBy(desc(enbAccessRequests.requestedAt))

		const ctcByDocKey = new Map<string, (typeof ctcRows)[number]>()
		for (const row of ctcRows) {
			if (!row.appointmentId || !row.documentFileObjectId) continue
			const key = `${row.appointmentId}:${row.documentFileObjectId}`
			if (!ctcByDocKey.has(key)) ctcByDocKey.set(key, row)
		}

		const enpIds = [...new Set(completedRows.map(r => r.enpUserId))]
		const enpRows = await db
			.select({
				userId: enpProfiles.userId,
				prefix: enpProfiles.prefix,
				firstName: enpProfiles.firstName,
				lastName: enpProfiles.lastName,
				suffix: enpProfiles.suffix,
			})
			.from(enpProfiles)
			.where(inArray(enpProfiles.userId, enpIds))

		const enpNames = new Map(enpRows.map(e => [e.userId, formatEnpName(e)]))

		const seen = new Set<string>()
		const out: SignedDocument[] = []

		for (const r of completedRows) {
			const dedupeKey = `${r.appointmentId}:${r.fileObjectId}`
			if (seen.has(dedupeKey)) continue
			seen.add(dedupeKey)

			const title =
				r.displayName?.trim() || (r.s3Key ? fileNameFromS3Key(r.s3Key) : null) || "Document"
			const qs = qsKeys.get(`${r.enpUserId}:${r.fileObjectId}`)
			const completedAt = qs?.completedAt ?? r.lastSignedAt ?? r.docLinkedAt ?? new Date()
			const ctc = ctcByDocKey.get(dedupeKey)

			out.push({
				id: dedupeKey,
				appointmentId: r.appointmentId,
				documentFileId: r.fileObjectId,
				documentTitle: title,
				documentType: r.documentType?.trim() || null,
				enpId: r.enpUserId,
				enpName: enpNames.get(r.enpUserId) ?? "ENP",
				appointmentKind: r.kind === "quicksign" ? "quicksign" : "standard",
				notarizationType: r.notarizationType,
				completedAt: dateToIsoOrEpoch(completedAt),
				ctcRequest: ctc
					? {
							id: ctc.id,
							outcome: ctc.outcome,
							refusalReason: ctc.refusalReason ?? null,
							requestedAt: ctc.requestedAt.toISOString(),
							decidedAt: ctc.decidedAt?.toISOString() ?? null,
							requesterPaymentMethod: ctc.requesterPaymentMethod ?? null,
							paymentRequired: ctc.requesterPaymentMethod === "online",
							paymentPaid:
								ctc.requesterPaymentMethod !== "online" ||
								ctc.paymentStatus === "succeeded",
							paymentStatus: ctc.paymentStatus ?? null,
						}
					: null,
			})
		}

		out.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
		return out
	}

	async requestCertifiedTrueCopy(
		ctx: QlegalSessionContext | null,
		input: RequestCertifiedTrueCopy
	): Promise<EnbAccessRequest> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		await this.assertClientAccess(ctx)
		return this.registry.createPrincipalCertifiedTrueCopyRequest(ctx.userId, input)
	}

	async getCtcPaymentStatus(
		ctx: QlegalSessionContext | null,
		requestId: string
	): Promise<CtcPaymentStatus> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		await this.assertClientAccess(ctx)
		return this.ctcPayment.getPaymentStatus(ctx, requestId)
	}

	async listCtcPaymentBrands(
		ctx: QlegalSessionContext | null,
		requestId: string
	): Promise<MeetingPaymentBrands> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		await this.assertClientAccess(ctx)
		return this.ctcPayment.listPaymentBrands(ctx, requestId)
	}

	async createCtcPayment(
		ctx: QlegalSessionContext | null,
		requestId: string,
		paymentOptionCode?: string
	): Promise<CreateCtcPaymentResult> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		await this.assertClientAccess(ctx)
		return this.ctcPayment.createPayment(ctx, requestId, paymentOptionCode)
	}

	async simulateCtcPayment(
		ctx: QlegalSessionContext | null,
		requestId: string
	): Promise<CtcPaymentStatus> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		await this.assertClientAccess(ctx)
		return this.ctcPayment.simulatePayment(ctx, requestId)
	}
}

function chunkArray<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = []
	for (let i = 0; i < items.length; i += size) {
		chunks.push(items.slice(i, i + size))
	}
	return chunks
}
