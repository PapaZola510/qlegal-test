import { Inject, Injectable, Logger } from "@nestjs/common"
import { ORPCError } from "@orpc/server"
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm"

import type {
	AdvanceDocumentReviewQuicksignResponse,
	ApproveDocumentReviewQuicksignBootstrap,
	ApproveDocumentReviewRequest,
	ApproveDocumentReviewRequestResponse,
	CreateDocumentReviewRequest,
	DocumentReviewQuicksignQueue,
	DocumentReviewRequest,
} from "@repo/contracts"
import {
	appointmentDocuments,
	appointments,
	clientProfiles,
	documentReviewRequestDocumentTypes,
	documentReviewRequestFiles,
	documentReviewRequests,
	enpProfiles,
	fileObjects,
	quicksignProjects,
	users,
} from "@repo/db/schema"

import { EMAIL_ADAPTER, type EmailAdapter } from "@/services/email/email-adapter"
import { buildQuicksignSessionInviteEmail } from "@/services/email/quicksign-session-invite-email"
import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { publicAppUrl } from "@/config/env.config"
import { dateToIsoOrEpoch, dateToIsoOrNull } from "@/utils/safe-timestamp"

import { assertEnpCommissionAllowsNotarialActs } from "../auth-profile/lib/assert-enp-commission-active"
import { assertGovernmentIdAllowsNotarialActs } from "../auth-profile/lib/assert-government-id-allows-notarial-acts"
import { assertProfileKycVerified } from "../auth-profile/lib/assert-profile-kyc-verified"
import { EnpDocumentTypesService } from "../enp-document-types/enp-document-types.service"
import { EventsService } from "../events/events.service"
import { FilesService } from "../files/files.service"
import { QuicksignService } from "../quicksign/quicksign.service"

function splitDisplayName(name: string): { firstName: string; lastName: string } {
	const trimmed = name.trim()
	const parts = trimmed.split(/\s+/).filter(Boolean)
	if (parts.length === 0) return { firstName: "Client", lastName: "." }
	if (parts.length === 1) return { firstName: parts[0]!, lastName: "." }
	return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") }
}

function formatEnpName(row: {
	prefix: string | null
	firstName: string
	lastName: string
	suffix: string | null
}): string {
	const parts = [row.prefix, row.firstName, row.lastName, row.suffix].filter(Boolean)
	return parts.join(" ").trim() || "ENP"
}

function formatNotarizationLabel(
	type:
		| "acknowledgment"
		| "jurat"
		| "oath_affirmation"
		| "copy_certification"
		| "signature_witnessing"
): string {
	return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

@Injectable()
export class DocumentReviewRequestsService {
	private readonly log = new Logger(DocumentReviewRequestsService.name)

	constructor(
		@Inject(EMAIL_ADAPTER) private readonly email: EmailAdapter,
		private readonly events: EventsService,
		private readonly enpDocTypes: EnpDocumentTypesService,
		private readonly files: FilesService,
		private readonly quicksign: QuicksignService
	) {}

	async list(ctx: QlegalSessionContext | null): Promise<DocumentReviewRequest[]> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const rows = await db
			.select()
			.from(documentReviewRequests)
			.where(
				or(
					eq(documentReviewRequests.clientUserId, ctx.userId),
					eq(documentReviewRequests.enpUserId, ctx.userId)
				)
			)
			.orderBy(desc(documentReviewRequests.createdAt))

		return this.shapeMany(rows)
	}

	async getOne(ctx: QlegalSessionContext | null, id: string): Promise<DocumentReviewRequest> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select()
			.from(documentReviewRequests)
			.where(eq(documentReviewRequests.id, id))
			.limit(1)
		if (!row) throw new ORPCError("NOT_FOUND", { message: `Review request ${id} not found` })

		this.assertAccess(ctx, row)
		return (await this.shapeMany([row]))[0]!
	}

	async create(
		ctx: QlegalSessionContext | null,
		input: CreateDocumentReviewRequest
	): Promise<DocumentReviewRequest> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		// Bootstrap a client profile if missing (mirrors appointments.create logic)
		let canSendAsClient = ctx.role === "client"
		if (!canSendAsClient) {
			const [existingClient] = await db
				.select({ userId: clientProfiles.userId })
				.from(clientProfiles)
				.where(eq(clientProfiles.userId, ctx.userId))
				.limit(1)
			canSendAsClient = Boolean(existingClient)
		}
		if (!canSendAsClient && ctx.role === "none") {
			const [user] = await db
				.select({ name: users.name })
				.from(users)
				.where(eq(users.id, ctx.userId))
				.limit(1)
			if (user) {
				const { firstName, lastName } = splitDisplayName(user.name ?? "")
				await db
					.insert(clientProfiles)
					.values({ userId: ctx.userId, firstName, lastName, updatedAt: new Date() })
					.onConflictDoNothing({ target: clientProfiles.userId })
				canSendAsClient = true
			}
		}
		if (!canSendAsClient) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only clients can send document review requests",
			})
		}

		const kyc = await assertProfileKycVerified(ctx.userId, "client", "booking")
		if (!kyc.ok) {
			throw new ORPCError("FORBIDDEN", { message: kyc.detail })
		}
		const clientGovId = await assertGovernmentIdAllowsNotarialActs(ctx.userId)
		if (!clientGovId.ok) {
			throw new ORPCError("FORBIDDEN", { message: clientGovId.detail })
		}

		const [enp] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, input.enpId))
			.limit(1)
		if (!enp || enp.certificateStatus !== "certified") {
			throw new ORPCError("NOT_FOUND", { message: "ENP not found or not certified" })
		}

		const selectedDocTypes = await this.enpDocTypes.resolveAndValidateSelection({
			enpId: input.enpId,
			documentTypeIds: input.documentTypeIds,
		})

		await this.assertClientUploadFiles(ctx.userId, input.fileObjectIds)

		const proposedSlots = (input.proposedSlots ?? []).map(iso => {
			const d = new Date(iso)
			if (Number.isNaN(d.getTime())) {
				throw new ORPCError("BAD_REQUEST", { message: `Invalid proposed slot timestamp: ${iso}` })
			}
			return d.toISOString()
		})

		const now = new Date()
		const [inserted] = await db
			.insert(documentReviewRequests)
			.values({
				clientUserId: ctx.userId,
				enpUserId: input.enpId,
				title: input.title.trim(),
				note: input.note?.trim() || null,
				notarizationType: input.notarizationType ?? null,
				sessionMode: input.sessionMode,
				status: "pending",
				proposedSlots,
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		if (!inserted) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Create failed" })
		}

		const fileRows = input.fileObjectIds.map((fid, index) => ({
			reviewRequestId: inserted.id,
			fileObjectId: fid,
			sortOrder: index,
			createdAt: now,
		}))
		await db.insert(documentReviewRequestFiles).values(fileRows)

		await db.insert(documentReviewRequestDocumentTypes).values(
			selectedDocTypes.map(t => ({
				reviewRequestId: inserted.id,
				enpDocumentTypeId: t.id,
				pricePhpSnapshot: Math.floor(t.pricePhp),
				createdAt: now,
			}))
		)

		this.events.emitToUser(input.enpId, "document-review:pending", {
			reviewRequestId: inserted.id,
			clientId: ctx.userId,
		})

		return (await this.shapeMany([inserted]))[0]!
	}

	async approve(
		ctx: QlegalSessionContext | null,
		input: ApproveDocumentReviewRequest
	): Promise<ApproveDocumentReviewRequestResponse> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		await this.assertEnpCanRespondToReview(ctx, input.id)

		if (input.approvalPath === "quicksign") {
			return this.approveForQuicksign(ctx, input)
		}
		return this.approveForMeeting(ctx, input)
	}

	async advanceQuicksign(
		ctx: QlegalSessionContext | null,
		reviewId: string
	): Promise<AdvanceDocumentReviewQuicksignResponse> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select()
			.from(documentReviewRequests)
			.where(eq(documentReviewRequests.id, reviewId))
			.limit(1)
		if (!row) throw new ORPCError("NOT_FOUND", { message: `Review request ${reviewId} not found` })
		if (row.enpUserId !== ctx.userId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the assigned ENP can advance this QuickSign queue",
			})
		}
		if (row.status !== "approved" || row.approvedPath !== "quicksign") {
			throw new ORPCError("BAD_REQUEST", {
				message: "This review request is not an active IEN QuickSign queue",
			})
		}

		const fileLinks = await this.loadOrderedReviewFiles(row.id)
		if (!fileLinks.length) {
			throw new ORPCError("BAD_REQUEST", { message: "This review has no documents" })
		}

		await this.assertLatestQuicksignDocComplete(ctx, fileLinks)

		const nextFile = fileLinks.find(f => !f.quicksignProjectId)
		const notarizationType = row.notarizationType ?? ("acknowledgment" as const)

		if (!nextFile) {
			const shaped = (await this.shapeMany([row]))[0]!
			return { reviewRequest: shaped, quicksign: null }
		}

		const completedCount = fileLinks.filter(f => f.quicksignProjectId).length
		const bootstrap = await this.bootstrapQuicksignForReviewFile(ctx, {
			review: row,
			fileLink: nextFile,
			notarizationType,
			currentIndex: completedCount + 1,
			totalDocuments: fileLinks.length,
		})

		const [updated] = await db
			.select()
			.from(documentReviewRequests)
			.where(eq(documentReviewRequests.id, row.id))
			.limit(1)

		return {
			reviewRequest: (await this.shapeMany([updated!]))[0]!,
			quicksign: bootstrap,
		}
	}

	private async approveForMeeting(
		ctx: QlegalSessionContext,
		input: ApproveDocumentReviewRequest
	): Promise<ApproveDocumentReviewRequestResponse> {
		const [row] = await db
			.select()
			.from(documentReviewRequests)
			.where(eq(documentReviewRequests.id, input.id))
			.limit(1)
		if (!row) throw new ORPCError("NOT_FOUND", { message: `Review request ${input.id} not found` })

		const scheduledAt = new Date(input.scheduledAt!)
		if (Number.isNaN(scheduledAt.getTime())) {
			throw new ORPCError("BAD_REQUEST", { message: "Invalid scheduledAt timestamp" })
		}

		const fileLinks = await this.loadOrderedReviewFiles(row.id)
		const sessionMode = input.sessionMode ?? "remote"
		const now = new Date()

		const [createdAppt] = await db
			.insert(appointments)
			.values({
				clientUserId: row.clientUserId,
				enpUserId: row.enpUserId,
				title: row.title,
				description: row.note,
				status: "confirmed",
				kind: "standard",
				scheduledAt,
				durationMinutes: input.durationMinutes ?? 60,
				location: input.location ?? null,
				meetingUrl: input.meetingUrl ?? null,
				notes: input.notes ?? null,
				notarizationType: input.notarizationType,
				sessionMode,
				confirmedAt: now,
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		if (!createdAppt) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Appointment create failed" })
		}

		if (fileLinks.length) {
			await db.insert(appointmentDocuments).values(
				fileLinks.map(f => ({
					appointmentId: createdAppt.id,
					fileObjectId: f.fileObjectId,
					displayName: f.displayName,
					createdAt: now,
				}))
			)
		}

		const [updated] = await db
			.update(documentReviewRequests)
			.set({
				status: "approved",
				approvedPath: "meeting",
				approvedAppointmentId: createdAppt.id,
				activeQuicksignProjectId: null,
				respondedAt: now,
				updatedAt: now,
			})
			.where(eq(documentReviewRequests.id, row.id))
			.returning()

		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to update review request" })
		}

		this.events.emitToUser(row.clientUserId, "document-review:updated", {
			reviewRequestId: row.id,
			status: "approved",
			appointmentId: createdAppt.id,
		})

		const [clientUser] = await db
			.select({ email: users.email })
			.from(users)
			.where(eq(users.id, row.clientUserId))
			.limit(1)
		const enpName = await this.loadDisplayName(row.enpUserId)
		if (clientUser?.email) {
			try {
				const clientName = await this.loadDisplayName(row.clientUserId)
				const appBase = publicAppUrl()
				const lobbyUrl = `${appBase}/appointments/${createdAppt.id}/lobby`
				const primaryDocumentTitle = fileLinks[0]?.displayName?.trim() || row.title
				const invite = buildQuicksignSessionInviteEmail({
					recipientName: clientName,
					enpName,
					documentTitle: primaryDocumentTitle,
					notarizationTypeLabel: formatNotarizationLabel(createdAppt.notarizationType),
					joinSessionUrl: lobbyUrl,
					signDocumentUrl: lobbyUrl,
				})
				await this.email.sendQuicksignSessionInvite(clientUser.email, invite)
			} catch (e) {
				this.log.warn(
					`approval email failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 280)
				)
			}
		}

		const shapedReview = (await this.shapeMany([updated]))[0]!

		return {
			reviewRequest: shapedReview,
			appointment: {
				id: createdAppt.id,
				clientId: createdAppt.clientUserId,
				clientName: await this.loadDisplayName(createdAppt.clientUserId),
				enpId: createdAppt.enpUserId,
				enpName,
				title: createdAppt.title,
				description: createdAppt.description,
				status: createdAppt.status,
				scheduledAt: createdAppt.scheduledAt.toISOString(),
				durationMinutes: createdAppt.durationMinutes,
				location: createdAppt.location,
				isVirtual: createdAppt.sessionMode === "remote",
				meetingUrl: createdAppt.meetingUrl,
				notes: createdAppt.notes,
				notarizationType: createdAppt.notarizationType,
				sessionMode: createdAppt.sessionMode,
				kind: createdAppt.kind,
				declineReason: createdAppt.declineReason,
				documentsCount: fileLinks.length,
				canStart: false,
				canRejoin: false,
				enbSigningStatus: createdAppt.enbSigningStatus,
				enbSigningStartedAt: createdAppt.enbSigningStartedAt?.toISOString() ?? null,
				enbSigningCompletedAt: createdAppt.enbSigningCompletedAt?.toISOString() ?? null,
				createdAt: createdAppt.createdAt,
				updatedAt: createdAppt.updatedAt,
			},
			quicksign: null,
		}
	}

	private async approveForQuicksign(
		ctx: QlegalSessionContext,
		input: ApproveDocumentReviewRequest
	): Promise<ApproveDocumentReviewRequestResponse> {
		const [row] = await db
			.select()
			.from(documentReviewRequests)
			.where(eq(documentReviewRequests.id, input.id))
			.limit(1)
		if (!row) throw new ORPCError("NOT_FOUND", { message: `Review request ${input.id} not found` })

		const fileLinks = await this.loadOrderedReviewFiles(row.id)
		if (!fileLinks.length) {
			throw new ORPCError("BAD_REQUEST", { message: "This review has no documents to notarize" })
		}

		const notarizationType = input.notarizationType
		const firstFile = fileLinks[0]!
		const bootstrap = await this.bootstrapQuicksignForReviewFile(ctx, {
			review: row,
			fileLink: firstFile,
			notarizationType,
			currentIndex: 1,
			totalDocuments: fileLinks.length,
		})

		const now = new Date()
		const [updated] = await db
			.update(documentReviewRequests)
			.set({
				status: "approved",
				approvedPath: "quicksign",
				approvedAppointmentId: null,
				activeQuicksignProjectId: bootstrap.quicksignProjectId,
				respondedAt: now,
				updatedAt: now,
			})
			.where(eq(documentReviewRequests.id, row.id))
			.returning()

		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to update review request" })
		}

		this.events.emitToUser(row.clientUserId, "document-review:updated", {
			reviewRequestId: row.id,
			status: "approved",
			quicksignProjectId: bootstrap.quicksignProjectId,
		})

		return {
			reviewRequest: (await this.shapeMany([updated]))[0]!,
			appointment: null,
			quicksign: bootstrap,
		}
	}

	async reject(
		ctx: QlegalSessionContext | null,
		id: string,
		rejectionReason: string
	): Promise<DocumentReviewRequest> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select()
			.from(documentReviewRequests)
			.where(eq(documentReviewRequests.id, id))
			.limit(1)
		if (!row) throw new ORPCError("NOT_FOUND", { message: `Review request ${id} not found` })
		if (row.enpUserId !== ctx.userId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the assigned ENP can reject this request",
			})
		}
		if (row.status !== "pending") {
			throw new ORPCError("BAD_REQUEST", { message: "Only pending requests can be rejected" })
		}

		const enpKyc = await assertProfileKycVerified(ctx.userId, "enp")
		if (!enpKyc.ok) throw new ORPCError("FORBIDDEN", { message: enpKyc.detail })

		const now = new Date()
		const [updated] = await db
			.update(documentReviewRequests)
			.set({
				status: "rejected",
				rejectionReason: rejectionReason.trim(),
				respondedAt: now,
				updatedAt: now,
			})
			.where(eq(documentReviewRequests.id, id))
			.returning()

		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to update review request" })
		}

		this.events.emitToUser(row.clientUserId, "document-review:updated", {
			reviewRequestId: row.id,
			status: "rejected",
		})

		const [clientUser] = await db
			.select({ email: users.email })
			.from(users)
			.where(eq(users.id, row.clientUserId))
			.limit(1)
		const enpName = await this.loadDisplayName(row.enpUserId)
		if (clientUser?.email) {
			try {
				await this.email.sendTransactional(clientUser.email, "appointment_declined", {
					appointmentTitle: row.title,
					scheduledAt: new Date().toISOString(),
					enpName,
					declineReason: rejectionReason.trim(),
				})
			} catch (e) {
				this.log.warn(
					`rejection email failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 280)
				)
			}
		}

		return (await this.shapeMany([updated]))[0]!
	}

	async cancel(ctx: QlegalSessionContext | null, id: string): Promise<DocumentReviewRequest> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const [row] = await db
			.select()
			.from(documentReviewRequests)
			.where(eq(documentReviewRequests.id, id))
			.limit(1)
		if (!row) throw new ORPCError("NOT_FOUND", { message: `Review request ${id} not found` })
		if (row.clientUserId !== ctx.userId) {
			throw new ORPCError("FORBIDDEN", { message: "Only the client can cancel this request" })
		}
		if (row.status !== "pending") {
			throw new ORPCError("BAD_REQUEST", { message: "Only pending requests can be cancelled" })
		}

		const now = new Date()
		const [updated] = await db
			.update(documentReviewRequests)
			.set({ status: "cancelled", respondedAt: now, updatedAt: now })
			.where(eq(documentReviewRequests.id, id))
			.returning()

		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to cancel review request" })
		}

		this.events.emitToUser(row.enpUserId, "document-review:updated", {
			reviewRequestId: row.id,
			status: "cancelled",
		})

		return (await this.shapeMany([updated]))[0]!
	}

	private async assertEnpCanRespondToReview(
		ctx: QlegalSessionContext,
		reviewId: string
	): Promise<typeof documentReviewRequests.$inferSelect> {
		const [row] = await db
			.select()
			.from(documentReviewRequests)
			.where(eq(documentReviewRequests.id, reviewId))
			.limit(1)
		if (!row) throw new ORPCError("NOT_FOUND", { message: `Review request ${reviewId} not found` })
		if (row.enpUserId !== ctx.userId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the assigned ENP can approve this request",
			})
		}
		if (row.status !== "pending") {
			throw new ORPCError("BAD_REQUEST", { message: "Only pending requests can be approved" })
		}

		const enpKyc = await assertProfileKycVerified(ctx.userId, "enp")
		if (!enpKyc.ok) throw new ORPCError("FORBIDDEN", { message: enpKyc.detail })
		const enpGovId = await assertGovernmentIdAllowsNotarialActs(ctx.userId)
		if (!enpGovId.ok) throw new ORPCError("FORBIDDEN", { message: enpGovId.detail })
		const enpCommission = await assertEnpCommissionAllowsNotarialActs(ctx.userId)
		if (!enpCommission.ok) throw new ORPCError("FORBIDDEN", { message: enpCommission.detail })

		return row
	}

	private async loadOrderedReviewFiles(reviewId: string) {
		return db
			.select({
				fileObjectId: documentReviewRequestFiles.fileObjectId,
				displayName: documentReviewRequestFiles.displayName,
				sortOrder: documentReviewRequestFiles.sortOrder,
				quicksignProjectId: documentReviewRequestFiles.quicksignProjectId,
			})
			.from(documentReviewRequestFiles)
			.where(eq(documentReviewRequestFiles.reviewRequestId, reviewId))
			.orderBy(asc(documentReviewRequestFiles.sortOrder), asc(documentReviewRequestFiles.createdAt))
	}

	private async loadClientSignerInfo(clientUserId: string) {
		const [client] = await db
			.select({
				email: users.email,
				firstName: clientProfiles.firstName,
				lastName: clientProfiles.lastName,
				userName: users.name,
			})
			.from(users)
			.leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
			.where(eq(users.id, clientUserId))
			.limit(1)
		if (!client?.email) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Client account email is required for QuickSign",
			})
		}
		let firstName = client.firstName?.trim() ?? ""
		let lastName = client.lastName?.trim() ?? ""
		if (!firstName && !lastName && client.userName) {
			const split = splitDisplayName(client.userName)
			firstName = split.firstName
			lastName = split.lastName
		}
		return {
			email: client.email.trim(),
			firstName: firstName || "Client",
			lastName: lastName || ".",
		}
	}

	private buildQuicksignQueueMeta(
		reviewId: string,
		fileLinks: { quicksignProjectId: string | null }[],
		currentIndex: number
	): DocumentReviewQuicksignQueue {
		const totalDocuments = fileLinks.length
		const completedCount = fileLinks.filter(f => f.quicksignProjectId).length
		return {
			reviewRequestId: reviewId,
			totalDocuments,
			currentIndex,
			completedCount,
			hasMore: currentIndex < totalDocuments,
		}
	}

	private async resolveEnpSubOrgId(enpUserId: string): Promise<string> {
		const [enp] = await db
			.select({ subOrgId: enpProfiles.subOrgId })
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, enpUserId))
			.limit(1)
		if (!enp?.subOrgId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "ENP sub-organization is required for QuickSign",
			})
		}
		return enp.subOrgId
	}

	private async bootstrapQuicksignForReviewFile(
		ctx: QlegalSessionContext,
		args: {
			review: typeof documentReviewRequests.$inferSelect
			fileLink: {
				fileObjectId: string
				displayName: string | null
			}
			notarizationType: ApproveDocumentReviewRequest["notarizationType"]
			currentIndex: number
			totalDocuments: number
		}
	): Promise<ApproveDocumentReviewQuicksignBootstrap> {
		const subOrgId = await this.resolveEnpSubOrgId(ctx.userId)
		const documentTitle =
			args.fileLink.displayName?.trim() ||
			(args.totalDocuments > 1
				? `${args.review.title} (${args.currentIndex}/${args.totalDocuments})`
				: args.review.title)

		const { fileObjectId: qsFileId } = await this.files.copyReviewAttachmentToQsOriginal({
			sourceFileId: args.fileLink.fileObjectId,
			enpUserId: ctx.userId,
			subOrgId,
			displayName: documentTitle,
		})
		const clientSigner = await this.loadClientSignerInfo(args.review.clientUserId)

		const project = await this.quicksign.create(ctx, {
			title: documentTitle,
			description: `QuickSign · ${args.notarizationType}`,
			documentFileId: qsFileId,
			signer: clientSigner,
		})

		const now = new Date()
		await db
			.update(documentReviewRequestFiles)
			.set({ quicksignProjectId: project.id })
			.where(
				and(
					eq(documentReviewRequestFiles.reviewRequestId, args.review.id),
					eq(documentReviewRequestFiles.fileObjectId, args.fileLink.fileObjectId)
				)
			)

		await db
			.update(documentReviewRequests)
			.set({ activeQuicksignProjectId: project.id, updatedAt: now })
			.where(eq(documentReviewRequests.id, args.review.id))

		const fileLinks = await this.loadOrderedReviewFiles(args.review.id)

		return {
			quicksignProjectId: project.id,
			documentFileId: qsFileId,
			documentTitle,
			queue: this.buildQuicksignQueueMeta(args.review.id, fileLinks, args.currentIndex),
			clientEmail: clientSigner.email,
			clientFirstName: clientSigner.firstName,
			clientLastName: clientSigner.lastName,
			notarizationType: args.notarizationType,
		}
	}

	private async assertLatestQuicksignDocComplete(
		ctx: QlegalSessionContext,
		fileLinks: { quicksignProjectId: string | null }[]
	): Promise<void> {
		const withProject = fileLinks.filter((f): f is { quicksignProjectId: string } =>
			Boolean(f.quicksignProjectId)
		)
		if (!withProject.length) return

		const latestProjectId = withProject[withProject.length - 1]!.quicksignProjectId
		const project = await this.quicksign.getOne(ctx, latestProjectId)
		if (!project.signingComplete && project.status !== "completed") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Finish signing the current document before starting the next one",
			})
		}
	}

	private async buildQuicksignQueueForReview(
		row: typeof documentReviewRequests.$inferSelect,
		fileLinks: { quicksignProjectId: string | null; sortOrder: number }[]
	): Promise<DocumentReviewQuicksignQueue | null> {
		if (row.approvedPath !== "quicksign" || row.status !== "approved") return null
		if (!fileLinks.length) return null

		const withProject = fileLinks.filter(f => f.quicksignProjectId)
		const currentIndex = Math.max(1, withProject.length)
		const pending = fileLinks.some(f => !f.quicksignProjectId)
		const allHaveProjects = withProject.length === fileLinks.length

		let activeIndex = currentIndex
		if (allHaveProjects) {
			const statuses = await db
				.select({ id: quicksignProjects.id, status: quicksignProjects.status })
				.from(quicksignProjects)
				.where(
					inArray(
						quicksignProjects.id,
						withProject.map(f => f.quicksignProjectId!)
					)
				)
			const incomplete = statuses.find(s => s.status !== "completed")
			if (incomplete) {
				activeIndex = withProject.findIndex(f => f.quicksignProjectId === incomplete.id) + 1
			} else if (!pending) {
				return {
					reviewRequestId: row.id,
					totalDocuments: fileLinks.length,
					currentIndex: fileLinks.length,
					completedCount: fileLinks.length,
					hasMore: false,
				}
			}
		}

		return {
			reviewRequestId: row.id,
			totalDocuments: fileLinks.length,
			currentIndex: activeIndex,
			completedCount: withProject.length,
			hasMore: pending || activeIndex < fileLinks.length,
		}
	}

	private assertAccess(
		ctx: QlegalSessionContext,
		row: typeof documentReviewRequests.$inferSelect
	): void {
		const ok = ctx.userId === row.clientUserId || ctx.userId === row.enpUserId
		if (!ok) {
			throw new ORPCError("FORBIDDEN", { message: "You cannot access this review request" })
		}
	}

	private async assertClientUploadFiles(clientUserId: string, fileIds: string[]): Promise<void> {
		const rows = await db
			.select({ id: fileObjects.id })
			.from(fileObjects)
			.where(
				and(
					inArray(fileObjects.id, fileIds),
					eq(fileObjects.ownerUserId, clientUserId),
					eq(fileObjects.purpose, "appointment_attachment"),
					isNull(fileObjects.deletedAt)
				)
			)
		if (rows.length !== fileIds.length) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"One or more files are missing, not owned by you, or not marked as appointment attachments",
			})
		}
	}

	private async loadDisplayName(userId: string): Promise<string> {
		const names = await this.loadDisplayNames([userId])
		return names.get(userId) ?? "User"
	}

	private async loadDisplayNames(userIds: string[]): Promise<Map<string, string>> {
		const map = new Map<string, string>()
		if (!userIds.length) return map

		const [cRows, eRows, uRows] = await Promise.all([
			db
				.select({
					userId: clientProfiles.userId,
					firstName: clientProfiles.firstName,
					lastName: clientProfiles.lastName,
				})
				.from(clientProfiles)
				.where(inArray(clientProfiles.userId, userIds)),
			db
				.select({
					userId: enpProfiles.userId,
					prefix: enpProfiles.prefix,
					firstName: enpProfiles.firstName,
					lastName: enpProfiles.lastName,
					suffix: enpProfiles.suffix,
				})
				.from(enpProfiles)
				.where(inArray(enpProfiles.userId, userIds)),
			db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds)),
		])

		for (const c of cRows) {
			map.set(c.userId, `${c.firstName} ${c.lastName}`.trim())
		}
		for (const e of eRows) {
			map.set(e.userId, formatEnpName(e))
		}
		for (const u of uRows) {
			if (!map.has(u.id) && u.name) map.set(u.id, u.name)
		}
		for (const id of userIds) {
			if (!map.has(id)) map.set(id, "User")
		}
		return map
	}

	private async shapeMany(
		rows: (typeof documentReviewRequests.$inferSelect)[]
	): Promise<DocumentReviewRequest[]> {
		if (!rows.length) return []

		const userIds = [...new Set(rows.flatMap(r => [r.clientUserId, r.enpUserId]))]
		const names = await this.loadDisplayNames(userIds)

		const requestIds = rows.map(r => r.id)
		const fileRows = requestIds.length
			? await db
					.select({
						reviewRequestId: documentReviewRequestFiles.reviewRequestId,
						fileObjectId: documentReviewRequestFiles.fileObjectId,
						displayName: documentReviewRequestFiles.displayName,
						sortOrder: documentReviewRequestFiles.sortOrder,
						quicksignProjectId: documentReviewRequestFiles.quicksignProjectId,
						mime: fileObjects.mime,
						sizeBytes: fileObjects.sizeBytes,
						createdAt: documentReviewRequestFiles.createdAt,
					})
					.from(documentReviewRequestFiles)
					.innerJoin(fileObjects, eq(fileObjects.id, documentReviewRequestFiles.fileObjectId))
					.where(inArray(documentReviewRequestFiles.reviewRequestId, requestIds))
					.orderBy(
						asc(documentReviewRequestFiles.sortOrder),
						asc(documentReviewRequestFiles.createdAt)
					)
			: []

		const filesByRequest = new Map<string, DocumentReviewRequest["files"]>()
		const rawFilesByRequest = new Map<
			string,
			{ quicksignProjectId: string | null; sortOrder: number }[]
		>()
		for (const f of fileRows) {
			const arr = filesByRequest.get(f.reviewRequestId) ?? []
			const sizeBytesNum =
				typeof f.sizeBytes === "number" && Number.isFinite(f.sizeBytes) && f.sizeBytes >= 0
					? Math.floor(f.sizeBytes)
					: 0
			arr.push({
				fileObjectId: f.fileObjectId,
				displayName: f.displayName ?? null,
				mimeType: f.mime ?? "application/octet-stream",
				sizeBytes: sizeBytesNum,
				sortOrder: f.sortOrder ?? 0,
				quicksignProjectId: f.quicksignProjectId ?? null,
				createdAt: dateToIsoOrEpoch(f.createdAt),
			})
			filesByRequest.set(f.reviewRequestId, arr)

			const rawArr = rawFilesByRequest.get(f.reviewRequestId) ?? []
			rawArr.push({
				quicksignProjectId: f.quicksignProjectId ?? null,
				sortOrder: f.sortOrder ?? 0,
			})
			rawFilesByRequest.set(f.reviewRequestId, rawArr)
		}

		const shaped: DocumentReviewRequest[] = []
		for (const row of rows) {
			const rawFiles = rawFilesByRequest.get(row.id) ?? []
			shaped.push({
				id: row.id,
				clientId: row.clientUserId,
				clientName: names.get(row.clientUserId) ?? "Client",
				enpId: row.enpUserId,
				enpName: names.get(row.enpUserId) ?? "ENP",
				title: row.title,
				note: row.note,
				notarizationType: row.notarizationType,
				sessionMode: row.sessionMode,
				status: row.status,
				proposedSlots: Array.isArray(row.proposedSlots) ? row.proposedSlots : [],
				rejectionReason: row.rejectionReason,
				approvedAppointmentId: row.approvedAppointmentId,
				approvedPath: row.approvedPath ?? null,
				activeQuicksignProjectId: row.activeQuicksignProjectId ?? null,
				quicksignQueue: await this.buildQuicksignQueueForReview(row, rawFiles),
				respondedAt: dateToIsoOrNull(row.respondedAt),
				files: filesByRequest.get(row.id) ?? [],
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			})
		}
		return shaped
	}
}
