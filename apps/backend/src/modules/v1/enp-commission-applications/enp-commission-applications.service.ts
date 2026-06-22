import { Injectable } from "@nestjs/common"
import { ORPCError } from "@orpc/server"
import { and, desc, eq, inArray, isNull } from "drizzle-orm"

import type {
	DenyEnpCommissionApplication,
	EnpCommission,
	EnpCommissionApplication,
	GrantEnpCommissionApplication,
	ScheduleEnpCommissionSummaryHearing,
	SubmitEnpCommissionApplication,
} from "@repo/contracts"
import {
	commissionHearingRooms,
	enpCommissionApplicationDocuments,
	enpCommissionApplicationRequirementEnum,
	enpCommissionApplications,
	enpCommissions,
	enpProfiles,
	fileObjects,
	subOrgs,
	users,
} from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { CommissionHearingsService } from "@/modules/v1/commission-hearings/commission-hearings.service"
import { EventsService } from "@/modules/v1/events/events.service"
import { dateToIsoOrEpoch } from "@/utils/safe-timestamp"

import { computeCommissionTermEnd } from "./lib/commission-term"

const REQUIRED_KEYS = enpCommissionApplicationRequirementEnum

function formatApplicantName(row: {
	prefix: string | null
	firstName: string
	lastName: string
	suffix: string | null
}): string {
	const parts = [row.prefix, row.firstName, row.lastName, row.suffix].filter(Boolean)
	return parts.join(" ").trim() || "ENP"
}

function isReviewerRole(role: QlegalSessionContext["role"]): boolean {
	return role === "admin" || role === "super_admin" || role === "sub_org_admin"
}

@Injectable()
export class EnpCommissionApplicationsService {
	constructor(
		private readonly commissionHearings: CommissionHearingsService,
		private readonly events: EventsService
	) {}

	async submit(
		ctx: QlegalSessionContext,
		input: SubmitEnpCommissionApplication
	): Promise<EnpCommissionApplication> {
		if (ctx.role !== "enp") {
			throw new ORPCError("FORBIDDEN", { message: "Only ENP accounts may submit applications" })
		}

		const [enp] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, ctx.userId))
			.limit(1)

		if (!enp) {
			throw new ORPCError("FORBIDDEN", { message: "ENP profile is required" })
		}

		if (enp.certificateStatus !== "certified") {
			throw new ORPCError("FORBIDDEN", {
				message: "Complete ENP certification before applying for commission",
			})
		}

		if (!enp.subOrgId) {
			throw new ORPCError("BAD_REQUEST", { message: "Complete your ENP profile before submitting" })
		}

		const missing = [
			!enp.rollNo?.trim() && "Roll of Attorneys number",
			!enp.ptrNo?.trim() && "PTR number",
			!enp.ibpNo?.trim() && "IBP membership number",
			!enp.mcleNo?.trim() && "MCLE compliance number",
			!enp.phoneE164?.trim() && "phone number",
			!enp.homeStreet?.trim() && "residential address",
			!enp.notaryAddress?.trim() && "office address",
		].filter(Boolean)

		if (missing.length > 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Complete profile fields: ${missing.join(", ")}`,
			})
		}

		const fileIds = REQUIRED_KEYS.map(key => input.documents[key])
		const fileRows = await db
			.select()
			.from(fileObjects)
			.where(and(inArray(fileObjects.id, fileIds), isNull(fileObjects.deletedAt)))

		if (fileRows.length !== fileIds.length) {
			throw new ORPCError("BAD_REQUEST", {
				message: "One or more uploaded documents were not found",
			})
		}

		for (const file of fileRows) {
			if (file.ownerUserId !== ctx.userId) {
				throw new ORPCError("FORBIDDEN", { message: "Document ownership mismatch" })
			}
			if (file.subOrgId !== enp.subOrgId) {
				throw new ORPCError("FORBIDDEN", { message: "Document organization mismatch" })
			}
			if (file.purpose !== "commission_application" && file.purpose !== "appointment_attachment") {
				throw new ORPCError("BAD_REQUEST", {
					message: "Documents must be uploaded for commission application",
				})
			}
		}

		const now = new Date()
		const [application] = await db
			.insert(enpCommissionApplications)
			.values({
				applicantUserId: ctx.userId,
				subOrgId: enp.subOrgId,
				citizenship: input.citizenship.trim(),
				ulasComplianceNumber: input.ulasComplianceNumber?.trim() || null,
				qualificationsStatement: input.qualificationsStatement.trim(),
				undertakingRules: input.undertakingRules,
				undertakingDataSharing: input.undertakingDataSharing,
				status: "submitted",
				submittedAt: now,
				updatedAt: now,
			})
			.returning()

		if (!application) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not create application" })
		}

		await db.insert(enpCommissionApplicationDocuments).values(
			REQUIRED_KEYS.map(key => ({
				applicationId: application.id,
				requirementKey: key,
				fileObjectId: input.documents[key],
			}))
		)

		return (await this.shapeMany([application]))[0]!
	}

	async listMine(ctx: QlegalSessionContext): Promise<EnpCommissionApplication[]> {
		if (ctx.role !== "enp") {
			throw new ORPCError("FORBIDDEN", { message: "Only ENP accounts may list their applications" })
		}

		const rows = await db
			.select()
			.from(enpCommissionApplications)
			.where(eq(enpCommissionApplications.applicantUserId, ctx.userId))
			.orderBy(desc(enpCommissionApplications.submittedAt))

		return this.shapeMany(rows)
	}

	async listForReview(ctx: QlegalSessionContext): Promise<EnpCommissionApplication[]> {
		if (!isReviewerRole(ctx.role)) {
			throw new ORPCError("FORBIDDEN", { message: "ENA access required" })
		}

		let rows: Array<typeof enpCommissionApplications.$inferSelect>
		if (ctx.role === "admin" || ctx.role === "super_admin") {
			rows = await db
				.select()
				.from(enpCommissionApplications)
				.orderBy(desc(enpCommissionApplications.submittedAt))
		} else {
			if (ctx.subOrgIds.length === 0) {
				return []
			}
			rows = await db
				.select()
				.from(enpCommissionApplications)
				.where(inArray(enpCommissionApplications.subOrgId, ctx.subOrgIds))
				.orderBy(desc(enpCommissionApplications.submittedAt))
		}

		return this.shapeMany(rows)
	}

	async scheduleSummaryHearing(
		ctx: QlegalSessionContext,
		input: ScheduleEnpCommissionSummaryHearing
	): Promise<EnpCommissionApplication> {
		if (!isReviewerRole(ctx.role)) {
			throw new ORPCError("FORBIDDEN", { message: "ENA access required" })
		}

		const [row] = await db
			.select()
			.from(enpCommissionApplications)
			.where(eq(enpCommissionApplications.id, input.id))
			.limit(1)

		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: `Application ${input.id} not found` })
		}

		this.assertCanReview(ctx, row)

		if (row.status === "approved" || row.status === "rejected") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Cannot schedule a hearing for a finalized application",
			})
		}

		const scheduledAt = new Date(input.scheduledAt)
		if (Number.isNaN(scheduledAt.getTime())) {
			throw new ORPCError("BAD_REQUEST", { message: "Invalid hearing date and time" })
		}
		if (scheduledAt.getTime() <= Date.now()) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Virtual summary hearing must be scheduled in the future",
			})
		}

		const hearingRoom = await this.commissionHearings.createRoomForApplication(
			row.id,
			scheduledAt,
			input.instructions?.trim() || undefined,
			ctx.userId
		)

		const now = new Date()
		const [updated] = await db
			.update(enpCommissionApplications)
			.set({
				status: "hearing_scheduled",
				summaryHearingScheduledAt: scheduledAt,
				summaryHearingRoomId: hearingRoom.id,
				summaryHearingMeetingUrl: null,
				summaryHearingInstructions: input.instructions?.trim() || null,
				summaryHearingScheduledByUserId: ctx.userId,
				updatedAt: now,
			})
			.where(eq(enpCommissionApplications.id, input.id))
			.returning()

		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not schedule hearing" })
		}

		return (await this.shapeMany([updated]))[0]!
	}

	async getOne(ctx: QlegalSessionContext, id: string): Promise<EnpCommissionApplication> {
		const [row] = await db
			.select()
			.from(enpCommissionApplications)
			.where(eq(enpCommissionApplications.id, id))
			.limit(1)

		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: `Application ${id} not found` })
		}

		this.assertCanView(ctx, row)
		return (await this.shapeMany([row]))[0]!
	}

	async grant(
		ctx: QlegalSessionContext,
		input: GrantEnpCommissionApplication
	): Promise<EnpCommissionApplication> {
		const row = await this.getApplicationRow(input.id)
		this.assertCanReview(ctx, row)
		this.assertNotFinalized(row)

		if (!row.summaryHearingRoomId) {
			throw new ORPCError("BAD_REQUEST", { message: "Summary hearing is required before granting" })
		}

		const [hearing] = await db
			.select()
			.from(commissionHearingRooms)
			.where(eq(commissionHearingRooms.id, row.summaryHearingRoomId))
			.limit(1)

		if (!hearing) {
			throw new ORPCError("BAD_REQUEST", { message: "Summary hearing was not found" })
		}
		if (hearing.status !== "ended") {
			throw new ORPCError("BAD_REQUEST", { message: "Hearing must be ended before granting" })
		}

		const commissionDate = input.commissionDate ? new Date(input.commissionDate) : new Date()
		if (Number.isNaN(commissionDate.getTime())) {
			throw new ORPCError("BAD_REQUEST", { message: "Invalid commission date" })
		}
		const now = new Date()
		const termEndDate = computeCommissionTermEnd(commissionDate)

		const updated = await db.transaction(async tx => {
			await tx.insert(enpCommissions).values({
				applicationId: row.id,
				enpUserId: row.applicantUserId,
				commissionedName: input.commissionedName.trim(),
				placeOfWork: input.placeOfWork.trim(),
				commissionDate,
				termEndDate,
				status: "active",
				certificateFileObjectId: input.certificateFileObjectId ?? null,
				issuedByUserId: ctx.userId,
				updatedAt: now,
			})

			const [application] = await tx
				.update(enpCommissionApplications)
				.set({
					status: "approved",
					decisionReason: null,
					updatedAt: now,
				})
				.where(eq(enpCommissionApplications.id, row.id))
				.returning()

			return application
		})

		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not grant application" })
		}

		this.emitDecision(updated, ctx.userId)
		return (await this.shapeMany([updated]))[0]!
	}

	async deny(
		ctx: QlegalSessionContext,
		input: DenyEnpCommissionApplication
	): Promise<EnpCommissionApplication> {
		const row = await this.getApplicationRow(input.id)
		this.assertCanReview(ctx, row)
		this.assertNotFinalized(row)

		const now = new Date()
		const [updated] = await db
			.update(enpCommissionApplications)
			.set({
				status: "rejected",
				decisionReason: input.reason?.trim() || null,
				updatedAt: now,
			})
			.where(eq(enpCommissionApplications.id, row.id))
			.returning()

		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not deny application" })
		}

		this.emitDecision(updated, ctx.userId)
		return (await this.shapeMany([updated]))[0]!
	}

	async getCommission(ctx: QlegalSessionContext, input: { id: string }): Promise<EnpCommission> {
		const row = await this.getApplicationRow(input.id)
		this.assertCanView(ctx, row)

		const [commission] = await db
			.select()
			.from(enpCommissions)
			.where(eq(enpCommissions.applicationId, row.id))
			.limit(1)

		if (!commission) {
			throw new ORPCError("NOT_FOUND", {
				message: `Commission for application ${row.id} not found`,
			})
		}

		return this.shapeCommission(commission)
	}

	private async getApplicationRow(
		id: string
	): Promise<typeof enpCommissionApplications.$inferSelect> {
		const [row] = await db
			.select()
			.from(enpCommissionApplications)
			.where(eq(enpCommissionApplications.id, id))
			.limit(1)

		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: `Application ${id} not found` })
		}

		return row
	}

	private assertNotFinalized(row: typeof enpCommissionApplications.$inferSelect): void {
		if (row.status === "approved" || row.status === "rejected") {
			throw new ORPCError("BAD_REQUEST", { message: "Application already has a final decision" })
		}
	}

	private emitDecision(
		row: typeof enpCommissionApplications.$inferSelect,
		actorUserId: string
	): void {
		const payload = { applicationId: row.id, status: row.status }
		this.events.emitToUser(row.applicantUserId, "commission-hearing:decided", payload)
		this.events.emitToUser(row.applicantUserId, "enp-commission-applications:updated", payload)
		this.events.emitToUser(actorUserId, "commission-hearing:decided", payload)
		this.events.emitToUser(actorUserId, "enp-commission-applications:updated", payload)
	}

	private assertCanView(
		ctx: QlegalSessionContext,
		row: typeof enpCommissionApplications.$inferSelect
	): void {
		if (row.applicantUserId === ctx.userId) return
		this.assertCanReview(ctx, row)
	}

	private assertCanReview(
		ctx: QlegalSessionContext,
		row: typeof enpCommissionApplications.$inferSelect
	): void {
		if (ctx.role === "admin" || ctx.role === "super_admin") return
		if (ctx.role === "sub_org_admin" && ctx.subOrgIds.includes(row.subOrgId)) return
		throw new ORPCError("FORBIDDEN", { message: "Access denied" })
	}

	private async shapeMany(
		rows: Array<typeof enpCommissionApplications.$inferSelect>
	): Promise<EnpCommissionApplication[]> {
		if (rows.length === 0) return []

		const applicationIds = rows.map(r => r.id)
		const applicantIds = [...new Set(rows.map(r => r.applicantUserId))]
		const subOrgIds = [...new Set(rows.map(r => r.subOrgId))]
		const roomIds = [
			...new Set(rows.map(r => r.summaryHearingRoomId).filter((id): id is string => !!id)),
		]

		const [applicants, subOrgRows, docRows, commissionRows, hearingRows] = await Promise.all([
			db
				.select({
					id: users.id,
					email: users.email,
					prefix: enpProfiles.prefix,
					firstName: enpProfiles.firstName,
					lastName: enpProfiles.lastName,
					suffix: enpProfiles.suffix,
				})
				.from(users)
				.innerJoin(enpProfiles, eq(enpProfiles.userId, users.id))
				.where(inArray(users.id, applicantIds)),
			db
				.select({ id: subOrgs.id, name: subOrgs.name })
				.from(subOrgs)
				.where(inArray(subOrgs.id, subOrgIds)),
			db
				.select({
					applicationId: enpCommissionApplicationDocuments.applicationId,
					requirementKey: enpCommissionApplicationDocuments.requirementKey,
					fileObjectId: enpCommissionApplicationDocuments.fileObjectId,
					mime: fileObjects.mime,
					sizeBytes: fileObjects.sizeBytes,
				})
				.from(enpCommissionApplicationDocuments)
				.innerJoin(fileObjects, eq(fileObjects.id, enpCommissionApplicationDocuments.fileObjectId))
				.where(inArray(enpCommissionApplicationDocuments.applicationId, applicationIds)),
			db.select().from(enpCommissions).where(inArray(enpCommissions.applicationId, applicationIds)),
			roomIds.length > 0
				? db
						.select({
							id: commissionHearingRooms.id,
							status: commissionHearingRooms.status,
						})
						.from(commissionHearingRooms)
						.where(inArray(commissionHearingRooms.id, roomIds))
				: Promise.resolve([]),
		])

		const applicantById = new Map(applicants.map(a => [a.id, a]))
		const subOrgById = new Map(subOrgRows.map(s => [s.id, s.name]))
		const docsByApp = new Map<string, EnpCommissionApplication["documents"]>()
		const commissionByApp = new Map(
			commissionRows.map(commission => [commission.applicationId, commission])
		)
		const hearingStatusByRoom = new Map(hearingRows.map(room => [room.id, room.status]))

		for (const doc of docRows) {
			const list = docsByApp.get(doc.applicationId) ?? []
			list.push({
				requirementKey: doc.requirementKey,
				fileObjectId: doc.fileObjectId,
				mimeType: doc.mime,
				sizeBytes: doc.sizeBytes,
			})
			docsByApp.set(doc.applicationId, list)
		}

		return rows.map(row => {
			const applicant = applicantById.get(row.applicantUserId)
			return {
				id: row.id,
				applicantUserId: row.applicantUserId,
				applicantName: applicant ? formatApplicantName(applicant) : row.applicantUserId.slice(0, 8),
				applicantEmail: applicant?.email ?? "",
				subOrgId: row.subOrgId,
				subOrgName: subOrgById.get(row.subOrgId) ?? null,
				citizenship: row.citizenship,
				ulasComplianceNumber: row.ulasComplianceNumber,
				qualificationsStatement: row.qualificationsStatement,
				undertakingRules: row.undertakingRules,
				undertakingDataSharing: row.undertakingDataSharing,
				status: row.status,
				decisionReason: row.decisionReason,
				hearingStatus: row.summaryHearingRoomId
					? (hearingStatusByRoom.get(row.summaryHearingRoomId) ?? null)
					: null,
				commission: commissionByApp.has(row.id)
					? this.shapeCommission(commissionByApp.get(row.id)!)
					: null,
				submittedAt: dateToIsoOrEpoch(row.submittedAt),
				summaryHearing: {
					scheduledAt: row.summaryHearingScheduledAt
						? dateToIsoOrEpoch(row.summaryHearingScheduledAt)
						: null,
					roomId: row.summaryHearingRoomId,
					appointmentId: row.summaryHearingAppointmentId,
					lobbyPath: row.summaryHearingRoomId
						? `/commission-hearings/${row.summaryHearingRoomId}/lobby`
						: row.summaryHearingAppointmentId
							? `/appointments/${row.summaryHearingAppointmentId}/lobby`
							: null,
					instructions: row.summaryHearingInstructions,
					scheduledByUserId: row.summaryHearingScheduledByUserId,
				},
				documents: docsByApp.get(row.id) ?? [],
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			}
		})
	}

	private shapeCommission(row: typeof enpCommissions.$inferSelect): EnpCommission {
		return {
			id: row.id,
			applicationId: row.applicationId,
			commissionedName: row.commissionedName,
			placeOfWork: row.placeOfWork,
			commissionDate: dateToIsoOrEpoch(row.commissionDate),
			termEndDate: dateToIsoOrEpoch(row.termEndDate),
			status: row.status,
			amNumber: row.amNumber,
			certificateFileObjectId: row.certificateFileObjectId,
			issuedByUserId: row.issuedByUserId,
			createdAt: dateToIsoOrEpoch(row.createdAt),
		}
	}
}
