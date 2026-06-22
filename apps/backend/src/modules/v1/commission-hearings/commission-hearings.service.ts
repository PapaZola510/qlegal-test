import { Injectable, Logger } from "@nestjs/common"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import { ORPCError } from "@orpc/server"
import { and, desc, eq, inArray, or } from "drizzle-orm"

import {
	appointments,
	commissionHearingMessages,
	commissionHearingOppositions,
	commissionHearingRoomParticipants,
	commissionHearingRooms,
	enpCommissionApplications,
	fileObjects,
	livenessValidations,
	paymentIntents,
	users,
} from "@repo/db/schema"

import { isHitpayPaymentRequestCompleted } from "@/services/hitpay/hitpay-get-payment-request"
import { hitpayDevSandboxTestEnabled } from "@/services/hitpay/hitpay.client"
import { HitpayService } from "@/services/hitpay/hitpay.service"
import { LiveKitEgressService } from "@/services/livekit/livekit-egress.service"
import { LiveKitTokenService } from "@/services/livekit/livekit-token.service"
import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import type { V1Outputs } from "@/config/contract-types"
import { EventsService } from "@/modules/v1/events/events.service"
import { hasRecentAllowedLocationAudit } from "@/modules/v1/sessions/location-verification.service"

import { assertCommissionHearingAdminRole } from "./lib/assert-commission-hearing-admin"
import { assertHearingPaymentSettled } from "./lib/commission-hearing-payment-gate"

type CommissionHearingDto = V1Outputs["commissionHearing"]["get"]
type ChatMessageDto = V1Outputs["commissionHearing"]["listChat"][number]
type JoinTokenDto = V1Outputs["commissionHearing"]["issueJoinToken"]
type LobbyCheckResultDto = V1Outputs["commissionHearing"]["lobbyCheck"]
type HearingPaymentStatusDto = V1Outputs["commissionHearing"]["getPaymentStatus"]
type OppositionDto = V1Outputs["commissionHearing"]["listOppositions"][number]
interface InviteApplicantInput {
	id: string
	sendEmail: boolean
	recipientEmail?: string
}

interface JoinTokenInput {
	id: string
	oppositionToken?: string
}

interface LobbyCheckInput {
	id: string
	inviteToken?: string
	oppositionToken?: string
}

interface FileOppositionInput {
	applicationId: string
	oppositorName: string
	oppositorEmail: string
	grounds: string
	verifiedDocumentFileObjectId: string
	representativeDocumentFileObjectId?: string
}

interface OppositionIdInput {
	id: string
	oppositionId: string
}

interface DecideOppositionInput extends OppositionIdInput {
	outcome: "sustained" | "overruled" | "denied_no_show"
	excused?: boolean
}

interface RecordingStartedInput {
	id: string
	egressId?: string
	startedAt?: string
}

interface RecordingStoppedInput {
	id: string
	egressId?: string
	fileObjectId?: string
	stoppedAt?: string
}

type HearingRow = typeof commissionHearingRooms.$inferSelect
type OppositionRow = typeof commissionHearingOppositions.$inferSelect
type HearingPaymentIntent = typeof paymentIntents.$inferSelect
const HEARING_FEE_PHP = 50

@Injectable()
export class CommissionHearingsService {
	private readonly log = new Logger(CommissionHearingsService.name)

	constructor(
		private readonly livekit: LiveKitTokenService,
		private readonly egress: LiveKitEgressService,
		private readonly hitpay: HitpayService,
		private readonly events: EventsService
	) {}

	async getOne(ctx: QlegalSessionContext, id: string): Promise<CommissionHearingDto> {
		const row = await this.getVisibleRoom(ctx, id)
		return this.shapeOne(row)
	}

	async listMine(ctx: QlegalSessionContext): Promise<CommissionHearingDto[]> {
		if (!ctx.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		const rows = await db
			.select()
			.from(commissionHearingRooms)
			.where(eq(commissionHearingRooms.applicantUserId, ctx.userId))
			.orderBy(desc(commissionHearingRooms.scheduledAt), desc(commissionHearingRooms.createdAt))
		return this.shapeMany(rows)
	}

	async listForAdmin(ctx: QlegalSessionContext): Promise<CommissionHearingDto[]> {
		assertCommissionHearingAdminRole(ctx)
		const rows = await db
			.select()
			.from(commissionHearingRooms)
			.where(eq(commissionHearingRooms.enaUserId, ctx.userId))
			.orderBy(desc(commissionHearingRooms.scheduledAt), desc(commissionHearingRooms.createdAt))
		return this.shapeMany(rows)
	}

	async openSession(ctx: QlegalSessionContext, id: string): Promise<CommissionHearingDto> {
		assertCommissionHearingAdminRole(ctx)
		const row = await this.getRoomForEna(ctx, id)
		if (row.status === "ended" || row.status === "cancelled") {
			throw new ORPCError("BAD_REQUEST", { message: "Hearing is already closed" })
		}

		const now = new Date()
		let egressId = row.recordingEgressId
		let recordingStartedAt = row.recordingStartedAt
		if (!egressId && this.egress.isConfigured()) {
			const started = await this.egress.startRoomRecording(row.livekitRoomName)
			egressId = started.egressId
			recordingStartedAt = now
		}

		const [updated] = await db
			.update(commissionHearingRooms)
			.set({
				status: "in_session",
				startedAt: row.startedAt ?? now,
				recordingEgressId: egressId,
				recordingStartedAt,
				updatedAt: now,
			})
			.where(eq(commissionHearingRooms.id, id))
			.returning()

		this.events.emitToSession(id, "commission-hearing:opened", { hearingRoomId: id })
		if (egressId) {
			this.events.emitToSession(id, "commission-hearing:recording", {
				hearingRoomId: id,
				status: "started",
				startedAt: recordingStartedAt?.toISOString() ?? now.toISOString(),
			})
		}
		const verificationAppointmentId = await this.ensureVerificationAppointmentForRoom(updated!)
		await db
			.update(appointments)
			.set({ status: "in_session", canRejoin: true, updatedAt: now })
			.where(eq(appointments.id, verificationAppointmentId))
		return this.shapeOne(updated!)
	}

	async endSession(ctx: QlegalSessionContext, id: string): Promise<CommissionHearingDto> {
		assertCommissionHearingAdminRole(ctx)
		const row = await this.getRoomForEna(ctx, id)
		const now = new Date()
		let recordingFileObjectId = row.recordingFileObjectId
		let recordingStoppedAt = row.recordingStoppedAt

		if (row.recordingEgressId && !recordingFileObjectId) {
			const stopped = await this.egress.stopRoomRecording(row.recordingEgressId)
			const fileInfo = stopped.info.fileResults[0]
			const s3Key = stopped.s3Key ?? fileInfo?.filename ?? ""
			if (s3Key) {
				const [application] = await db
					.select({ subOrgId: enpCommissionApplications.subOrgId })
					.from(enpCommissionApplications)
					.where(eq(enpCommissionApplications.id, row.applicationId))
					.limit(1)
				const [file] = await db
					.insert(fileObjects)
					.values({
						subOrgId: application?.subOrgId ?? row.applicationId,
						ownerUserId: row.enaUserId,
						bucket: "qlegal-sessions",
						s3Key,
						mime: "video/mp4",
						sizeBytes: Number(fileInfo?.size ?? 0n),
						sha256: createHash("sha256").update(`${row.recordingEgressId}:${s3Key}`).digest("hex"),
						purpose: "session_recording",
						virusScanStatus: "skipped",
					})
					.returning({ id: fileObjects.id })
				recordingFileObjectId = file?.id ?? null
			}
			recordingStoppedAt = now
		}

		const [updated] = await db
			.update(commissionHearingRooms)
			.set({
				status: "ended",
				endedAt: now,
				recordingFileObjectId,
				recordingStoppedAt,
				updatedAt: now,
			})
			.where(eq(commissionHearingRooms.id, id))
			.returning()

		this.events.emitToSession(id, "commission-hearing:ended", { hearingRoomId: id })
		this.events.emitToSession(id, "commission-hearing:recording", {
			hearingRoomId: id,
			status: "stopped",
			stoppedAt: recordingStoppedAt?.toISOString() ?? now.toISOString(),
		})
		const verificationAppointmentId = await this.ensureVerificationAppointmentForRoom(updated!)
		await db
			.update(appointments)
			.set({ status: "ended", canRejoin: false, updatedAt: now })
			.where(eq(appointments.id, verificationAppointmentId))
		return this.shapeOne(updated!)
	}

	async issueJoinToken(ctx: QlegalSessionContext, input: JoinTokenInput): Promise<JoinTokenDto> {
		if (!ctx.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		const [row] = await db
			.select()
			.from(commissionHearingRooms)
			.where(eq(commissionHearingRooms.id, input.id))
			.limit(1)
		if (!row) throw new ORPCError("NOT_FOUND", { message: "Hearing not found" })
		if (row.status !== "in_session") {
			throw new ORPCError("BAD_REQUEST", { message: "Hearing is not open" })
		}

		const oppositorAccess =
			ctx.userId === row.enaUserId || ctx.userId === row.applicantUserId
				? null
				: await this.resolveOppositorAccess(row.id, ctx.userId, input.oppositionToken)
		const participantRole: "admin" | "applicant" | "hearing_oppositor" | null =
			ctx.userId === row.enaUserId
				? "admin"
				: ctx.userId === row.applicantUserId
					? "applicant"
					: oppositorAccess
						? "hearing_oppositor"
						: null
		if (!participantRole) throw new ORPCError("FORBIDDEN", { message: "Not a hearing party" })
		const verificationAppointmentId = await this.ensureVerificationAppointmentForRoom(row)
		await this.assertHearingLobbyChecksOk(ctx.userId, verificationAppointmentId)
		if (participantRole === "applicant") {
			await assertHearingPaymentSettled(db, row.id)
		}

		const ws = this.livekit.livekitWsUrl()
		if (!ws) throw new ORPCError("SERVICE_UNAVAILABLE", { message: "LiveKit is not configured" })

		const displayName =
			participantRole === "hearing_oppositor"
				? (oppositorAccess?.oppositorName ?? (await this.displayNameForUser(ctx.userId)))
				: await this.displayNameForUser(ctx.userId)
		const token = await this.livekit.mintParticipantToken({
			roomName: row.livekitRoomName,
			identity: ctx.userId,
			displayName,
			role:
				participantRole === "admin"
					? "admin_host"
					: participantRole === "hearing_oppositor"
						? "hearing_oppositor"
						: "hearing_applicant",
		})

		await db
			.insert(commissionHearingRoomParticipants)
			.values({ hearingRoomId: row.id, userId: ctx.userId })
			.onConflictDoUpdate({
				target: [
					commissionHearingRoomParticipants.hearingRoomId,
					commissionHearingRoomParticipants.userId,
				],
				set: { joinedAt: new Date() },
			})

		return {
			token,
			livekitUrl: ws,
			livekitRoomName: row.livekitRoomName,
			hearingRoomId: row.id,
			participantRole,
			displayName,
		}
	}

	async inviteApplicant(ctx: QlegalSessionContext, input: InviteApplicantInput) {
		assertCommissionHearingAdminRole(ctx)
		await this.getRoomForEna(ctx, input.id)
		const token = randomBytes(24).toString("base64url")
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
		await db
			.update(commissionHearingRooms)
			.set({
				applicantInviteTokenHash: this.hashInviteToken(token),
				applicantInviteExpiresAt: expiresAt,
				updatedAt: new Date(),
			})
			.where(eq(commissionHearingRooms.id, input.id))

		const inviteUrl = `/commission-hearings/${input.id}/lobby?invite=${encodeURIComponent(token)}`
		return { inviteUrl, expiresAt: expiresAt.toISOString() }
	}

	async lobbyCheck(
		ctx: QlegalSessionContext,
		input: LobbyCheckInput
	): Promise<LobbyCheckResultDto> {
		const [row] = await db
			.select()
			.from(commissionHearingRooms)
			.where(eq(commissionHearingRooms.id, input.id))
			.limit(1)
		if (!row) return { kind: "not_found" as const }

		let oppositorAccess: OppositionRow | null = null
		if (ctx.userId !== row.enaUserId && ctx.userId !== row.applicantUserId) {
			const resolved = await this.resolveOppositorAccess(row.id, ctx.userId, input.oppositionToken)
			if (resolved) {
				oppositorAccess = resolved
			} else if (input.oppositionToken) {
				return { kind: "invite_invalid" as const }
			} else {
				if (!input.inviteToken) return { kind: "forbidden" as const }
				if (!row.applicantInviteTokenHash) return { kind: "invite_invalid" as const }
				if (this.hashInviteToken(input.inviteToken) !== row.applicantInviteTokenHash) {
					return { kind: "invite_invalid" as const }
				}
				if (row.applicantInviteExpiresAt && row.applicantInviteExpiresAt < new Date()) {
					return { kind: "invite_expired" as const }
				}
			}
		}

		if (row.status === "ended") return { kind: "session_ended" as const }
		if (row.status !== "in_session") return { kind: "wrong_status" as const, status: row.status }

		const verificationAppointmentId = await this.ensureVerificationAppointmentForRoom(row)
		const participantRole: "admin" | "applicant" | "hearing_oppositor" =
			ctx.userId === row.enaUserId ? "admin" : oppositorAccess ? "hearing_oppositor" : "applicant"
		return {
			kind: "ok" as const,
			hearingRoomId: row.id,
			livekitRoomName: row.livekitRoomName,
			participantRole,
			displayName: oppositorAccess?.oppositorName ?? (await this.displayNameForUser(ctx.userId)),
			applicantName: await this.displayNameForUser(row.applicantUserId),
			scheduledAt: row.scheduledAt?.toISOString() ?? null,
			status: row.status,
			verificationAppointmentId,
		}
	}

	async recordingStarted(ctx: QlegalSessionContext, input: RecordingStartedInput) {
		assertCommissionHearingAdminRole(ctx)
		const startedAt = input.startedAt ? new Date(input.startedAt) : new Date()
		const [updated] = await db
			.update(commissionHearingRooms)
			.set({
				recordingEgressId: input.egressId,
				recordingStartedAt: startedAt,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(commissionHearingRooms.id, input.id),
					eq(commissionHearingRooms.enaUserId, ctx.userId)
				)
			)
			.returning()
		if (!updated) throw new ORPCError("NOT_FOUND", { message: "Hearing not found" })
		this.events.emitToSession(input.id, "commission-hearing:recording", {
			hearingRoomId: input.id,
			status: "started",
			startedAt: startedAt.toISOString(),
		})
		return this.shapeOne(updated)
	}

	async recordingStopped(ctx: QlegalSessionContext, input: RecordingStoppedInput) {
		assertCommissionHearingAdminRole(ctx)
		const stoppedAt = input.stoppedAt ? new Date(input.stoppedAt) : new Date()
		const [updated] = await db
			.update(commissionHearingRooms)
			.set({
				recordingFileObjectId: input.fileObjectId,
				recordingStoppedAt: stoppedAt,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(commissionHearingRooms.id, input.id),
					eq(commissionHearingRooms.enaUserId, ctx.userId)
				)
			)
			.returning()
		if (!updated) throw new ORPCError("NOT_FOUND", { message: "Hearing not found" })
		this.events.emitToSession(input.id, "commission-hearing:recording", {
			hearingRoomId: input.id,
			status: "stopped",
			stoppedAt: stoppedAt.toISOString(),
		})
		return this.shapeOne(updated)
	}

	async getHearingPaymentStatus(
		ctx: QlegalSessionContext,
		id: string
	): Promise<HearingPaymentStatusDto> {
		const row = await this.getVisibleRoom(ctx, id)
		if (ctx.userId !== row.applicantUserId) {
			return this.shapeHearingPaymentStatus(row.id, false, null)
		}

		const succeeded = await this.findSucceededHearingPaymentIntent(row.id)
		if (succeeded) return this.shapeHearingPaymentStatus(row.id, true, succeeded)

		const active = await this.findActiveHearingPaymentIntent(row.id)
		if (active) {
			const synced = await this.trySyncHearingPaymentFromHitpay(active, row)
			return this.shapeHearingPaymentStatus(row.id, true, synced ?? active)
		}

		return this.shapeHearingPaymentStatus(row.id, true, null)
	}

	async createHearingPayment(
		ctx: QlegalSessionContext,
		id: string
	): Promise<HearingPaymentStatusDto> {
		const row = await this.getVisibleRoom(ctx, id)
		if (ctx.userId !== row.applicantUserId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the applicant can pay the commission hearing fee",
			})
		}
		if (row.status !== "in_session") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Payment is only available while the hearing is in session",
			})
		}

		const existingPaid = await this.findSucceededHearingPaymentIntent(row.id)
		if (existingPaid) return this.shapeHearingPaymentStatus(row.id, true, existingPaid)

		if (!this.hitpay.isConfigured()) {
			throw new ORPCError("SERVICE_UNAVAILABLE", {
				message: "HitPay is not configured on this server",
			})
		}

		const now = new Date()
		await db
			.update(paymentIntents)
			.set({ status: "cancelled", updatedAt: now })
			.where(
				and(
					eq(paymentIntents.hearingRoomId, row.id),
					eq(paymentIntents.purpose, "commission_hearing"),
					inArray(paymentIntents.status, ["pending", "processing"])
				)
			)

		const [applicant] = await db
			.select({ email: users.email, name: users.name })
			.from(users)
			.where(eq(users.id, row.applicantUserId))
			.limit(1)

		const [intent] = await db
			.insert(paymentIntents)
			.values({
				userId: row.applicantUserId,
				hearingRoomId: row.id,
				amount: HEARING_FEE_PHP,
				currency: "PHP",
				status: "pending",
				description: "Commission hearing fee",
				purpose: "commission_hearing",
				provider: "hitpay",
				createdAt: now,
				updatedAt: now,
			})
			.returning()
		if (!intent) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not create payment intent" })
		}

		try {
			const hitpayResult = await this.hitpay.createQrphPaymentRequest({
				amountPhp: HEARING_FEE_PHP,
				referenceNumber: intent.id,
				purpose: "Commission hearing fee",
				email: applicant?.email ?? undefined,
				name: applicant?.name ?? undefined,
			})

			const [updated] = await db
				.update(paymentIntents)
				.set({
					externalId: hitpayResult.id,
					status: "processing",
					metadata: {
						qrCode: hitpayResult.qrCode,
						checkoutUrl: hitpayResult.checkoutUrl ?? hitpayResult.url,
						hitpayStatus: hitpayResult.status,
					},
					updatedAt: new Date(),
				})
				.where(eq(paymentIntents.id, intent.id))
				.returning()

			return this.shapeHearingPaymentStatus(row.id, true, updated ?? intent)
		} catch (e) {
			await db
				.update(paymentIntents)
				.set({ status: "failed", updatedAt: new Date() })
				.where(eq(paymentIntents.id, intent.id))
			const msg = e instanceof Error ? e.message : String(e)
			throw new ORPCError("BAD_GATEWAY", { message: `HitPay payment request failed: ${msg}` })
		}
	}

	async simulateHearingPayment(
		ctx: QlegalSessionContext,
		id: string
	): Promise<HearingPaymentStatusDto> {
		if (!hitpayDevSandboxTestEnabled()) {
			throw new ORPCError("FORBIDDEN", {
				message: "Hearing payment simulation is only available in development with HitPay sandbox",
			})
		}
		const row = await this.getVisibleRoom(ctx, id)
		if (ctx.userId !== row.applicantUserId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the applicant can simulate commission hearing payment",
			})
		}

		const succeeded = await this.findSucceededHearingPaymentIntent(row.id)
		if (succeeded) return this.shapeHearingPaymentStatus(row.id, true, succeeded)

		const now = new Date()
		const active = await this.findActiveHearingPaymentIntent(row.id)
		let finalIntent = active
		if (active) {
			const [updated] = await db
				.update(paymentIntents)
				.set({
					status: "succeeded",
					paidAt: now,
					updatedAt: now,
					metadata: {
						...(typeof active.metadata === "object" && active.metadata
							? (active.metadata as Record<string, unknown>)
							: {}),
						simulatedSandbox: true,
					},
				})
				.where(eq(paymentIntents.id, active.id))
				.returning()
			finalIntent = updated ?? active
		} else {
			const [inserted] = await db
				.insert(paymentIntents)
				.values({
					userId: row.applicantUserId,
					hearingRoomId: row.id,
					amount: HEARING_FEE_PHP,
					currency: "PHP",
					status: "succeeded",
					paidAt: now,
					description: "Commission hearing fee (sandbox simulated)",
					purpose: "commission_hearing",
					provider: "hitpay",
					metadata: { simulatedSandbox: true },
					createdAt: now,
					updatedAt: now,
				})
				.returning()
			finalIntent = inserted ?? null
		}

		if (!finalIntent) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Could not record simulated payment",
			})
		}

		this.emitHearingPaymentUpdated(row.id, row.applicantUserId, row.enaUserId, finalIntent.paidAt)
		return this.shapeHearingPaymentStatus(row.id, true, finalIntent)
	}

	async listChat(ctx: QlegalSessionContext, id: string): Promise<ChatMessageDto[]> {
		await this.getVisibleRoom(ctx, id)
		const rows = await db
			.select({
				id: commissionHearingMessages.id,
				hearingRoomId: commissionHearingMessages.hearingRoomId,
				senderUserId: commissionHearingMessages.senderUserId,
				senderName: users.name,
				body: commissionHearingMessages.body,
				createdAt: commissionHearingMessages.createdAt,
			})
			.from(commissionHearingMessages)
			.innerJoin(users, eq(users.id, commissionHearingMessages.senderUserId))
			.where(eq(commissionHearingMessages.hearingRoomId, id))
			.orderBy(commissionHearingMessages.createdAt)
		return rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() }))
	}

	async sendChat(ctx: QlegalSessionContext, id: string, body: string): Promise<ChatMessageDto> {
		await this.getVisibleRoom(ctx, id)
		const [inserted] = await db
			.insert(commissionHearingMessages)
			.values({ hearingRoomId: id, senderUserId: ctx.userId, body })
			.returning()
		const msg: ChatMessageDto = {
			id: inserted!.id,
			hearingRoomId: inserted!.hearingRoomId,
			senderUserId: inserted!.senderUserId,
			senderName: await this.displayNameForUser(ctx.userId),
			body: inserted!.body,
			createdAt: inserted!.createdAt.toISOString(),
		}
		this.events.emitToSession(id, "commission-hearing:chat", msg)
		return msg
	}

	async fileOpposition(
		ctx: QlegalSessionContext,
		input: FileOppositionInput
	): Promise<OppositionDto> {
		if (!ctx.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		const [application] = await db
			.select({
				id: enpCommissionApplications.id,
				summaryHearingRoomId: enpCommissionApplications.summaryHearingRoomId,
			})
			.from(enpCommissionApplications)
			.where(eq(enpCommissionApplications.id, input.applicationId))
			.limit(1)
		if (!application) {
			throw new ORPCError("NOT_FOUND", { message: "Commission application not found" })
		}

		let hearingRoomId = application.summaryHearingRoomId
		if (hearingRoomId) {
			const [hearing] = await db
				.select({ status: commissionHearingRooms.status })
				.from(commissionHearingRooms)
				.where(eq(commissionHearingRooms.id, hearingRoomId))
				.limit(1)
			if (hearing?.status === "ended" || hearing?.status === "cancelled") {
				throw new ORPCError("BAD_REQUEST", {
					message: "Oppositions cannot be filed after the hearing is closed",
				})
			}
			if (!hearing) hearingRoomId = null
		}

		await this.assertOppositionFileOwnedByUser(
			ctx.userId,
			input.verifiedDocumentFileObjectId,
			"Verified opposition document not found"
		)
		if (input.representativeDocumentFileObjectId) {
			await this.assertOppositionFileOwnedByUser(
				ctx.userId,
				input.representativeDocumentFileObjectId,
				"Representative authority document not found"
			)
		}

		const [inserted] = await db
			.insert(commissionHearingOppositions)
			.values({
				applicationId: input.applicationId,
				hearingRoomId,
				oppositorName: input.oppositorName,
				oppositorEmail: input.oppositorEmail,
				oppositorUserId: ctx.userId,
				grounds: input.grounds,
				verifiedDocumentFileObjectId: input.verifiedDocumentFileObjectId,
				representativeDocumentFileObjectId: input.representativeDocumentFileObjectId ?? null,
				status: "filed",
			})
			.returning()
		if (!inserted) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not file opposition" })
		}
		this.emitOppositionUpdated(inserted)
		return this.shapeOpposition(inserted)
	}

	async listOppositions(
		ctx: QlegalSessionContext,
		applicationId: string
	): Promise<OppositionDto[]> {
		assertCommissionHearingAdminRole(ctx)
		const rows = await db
			.select()
			.from(commissionHearingOppositions)
			.where(eq(commissionHearingOppositions.applicationId, applicationId))
			.orderBy(desc(commissionHearingOppositions.createdAt))
		return rows.map(row => this.shapeOpposition(row))
	}

	async forwardOpposition(
		ctx: QlegalSessionContext,
		input: OppositionIdInput
	): Promise<OppositionDto> {
		assertCommissionHearingAdminRole(ctx)
		await this.getRoomForEna(ctx, input.id)
		const row = await this.getOppositionForHearing(input.id, input.oppositionId)
		const [updated] = await db
			.update(commissionHearingOppositions)
			.set({ status: "forwarded", updatedAt: new Date() })
			.where(eq(commissionHearingOppositions.id, row.id))
			.returning()
		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not forward opposition" })
		}
		this.emitOppositionUpdated(updated)
		return this.shapeOpposition(updated)
	}

	async grantOppositorAccess(
		ctx: QlegalSessionContext,
		input: OppositionIdInput
	): Promise<{ inviteUrl: string; expiresAt: string }> {
		assertCommissionHearingAdminRole(ctx)
		await this.getRoomForEna(ctx, input.id)
		const row = await this.getOppositionForHearing(input.id, input.oppositionId)
		const token = randomBytes(24).toString("base64url")
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
		const [updated] = await db
			.update(commissionHearingOppositions)
			.set({
				accessTokenHash: this.hashInviteToken(token),
				accessExpiresAt: expiresAt,
				status: "access_granted",
				updatedAt: new Date(),
			})
			.where(eq(commissionHearingOppositions.id, row.id))
			.returning()
		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not grant access" })
		}
		this.emitOppositionUpdated(updated)
		const inviteUrl = `/commission-hearings/${input.id}/lobby?oppositionToken=${encodeURIComponent(token)}`
		return { inviteUrl, expiresAt: expiresAt.toISOString() }
	}

	async decideOpposition(
		ctx: QlegalSessionContext,
		input: DecideOppositionInput
	): Promise<OppositionDto> {
		assertCommissionHearingAdminRole(ctx)
		await this.getRoomForEna(ctx, input.id)
		const row = await this.getOppositionForHearing(input.id, input.oppositionId)
		const [updated] = await db
			.update(commissionHearingOppositions)
			.set({
				status: input.outcome,
				nonAppearanceExcused:
					input.outcome === "denied_no_show" ? Boolean(input.excused) : row.nonAppearanceExcused,
				updatedAt: new Date(),
			})
			.where(eq(commissionHearingOppositions.id, row.id))
			.returning()
		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not decide opposition" })
		}
		this.emitOppositionUpdated(updated)
		return this.shapeOpposition(updated)
	}

	async createRoomForApplication(
		applicationId: string,
		scheduledAt: Date,
		instructions: string | undefined,
		enaUserId: string
	): Promise<HearingRow> {
		const [application] = await db
			.select()
			.from(enpCommissionApplications)
			.where(eq(enpCommissionApplications.id, applicationId))
			.limit(1)
		if (!application)
			throw new ORPCError("NOT_FOUND", { message: "Commission application not found" })

		const [existing] = await db
			.select()
			.from(commissionHearingRooms)
			.where(eq(commissionHearingRooms.applicationId, applicationId))
			.limit(1)
		if (existing) {
			const verificationAppointmentId = await this.ensureVerificationAppointmentForRoom({
				...existing,
				enaUserId,
				scheduledAt,
				instructions: instructions ?? null,
			})
			const [updated] = await db
				.update(commissionHearingRooms)
				.set({ scheduledAt, instructions: instructions ?? null, enaUserId, updatedAt: new Date() })
				.where(eq(commissionHearingRooms.id, existing.id))
				.returning()
			await db
				.update(appointments)
				.set({
					clientUserId: enaUserId,
					scheduledAt,
					notes: instructions ?? null,
					updatedAt: new Date(),
				})
				.where(eq(appointments.id, verificationAppointmentId))
			return updated!
		}

		const id = randomUUID()
		const verificationAppointmentId = randomUUID()
		const [created] = await db
			.insert(commissionHearingRooms)
			.values({
				id,
				applicationId,
				enaUserId,
				applicantUserId: application.applicantUserId,
				livekitRoomName: `qlegal-hearing-${id}`,
				scheduledAt,
				instructions: instructions ?? null,
			})
			.returning()
		await db.insert(appointments).values({
			id: verificationAppointmentId,
			clientUserId: enaUserId,
			enpUserId: application.applicantUserId,
			title: "Commission summary hearing",
			description: "Electronic notarial commission application summary hearing.",
			status: "confirmed",
			kind: "commission_hearing",
			scheduledAt,
			durationMinutes: 60,
			location: "Remote audiovisual hearing",
			meetingUrl: `/commission-hearings/${id}/lobby`,
			notes: instructions ?? null,
			notarizationType: "acknowledgment",
			sessionMode: "remote",
			confirmedAt: new Date(),
			canStart: true,
			canRejoin: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		})
		await db
			.update(enpCommissionApplications)
			.set({
				summaryHearingAppointmentId: verificationAppointmentId,
				updatedAt: new Date(),
			})
			.where(eq(enpCommissionApplications.id, applicationId))
		return created!
	}

	private async getVisibleRoom(ctx: QlegalSessionContext, id: string): Promise<HearingRow> {
		if (!ctx.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		const [row] = await db
			.select()
			.from(commissionHearingRooms)
			.where(
				and(
					eq(commissionHearingRooms.id, id),
					or(
						eq(commissionHearingRooms.enaUserId, ctx.userId),
						eq(commissionHearingRooms.applicantUserId, ctx.userId)
					)
				)
			)
			.limit(1)
		if (row) return row

		const opposition = await this.resolveOppositorAccess(id, ctx.userId)
		if (!opposition) throw new ORPCError("NOT_FOUND", { message: "Hearing not found" })
		const [oppositionRoom] = await db
			.select()
			.from(commissionHearingRooms)
			.where(eq(commissionHearingRooms.id, id))
			.limit(1)
		if (!oppositionRoom) throw new ORPCError("NOT_FOUND", { message: "Hearing not found" })
		return oppositionRoom
	}

	private async getRoomForEna(ctx: QlegalSessionContext, id: string): Promise<HearingRow> {
		const [row] = await db
			.select()
			.from(commissionHearingRooms)
			.where(
				and(eq(commissionHearingRooms.id, id), eq(commissionHearingRooms.enaUserId, ctx.userId))
			)
			.limit(1)
		if (!row) throw new ORPCError("NOT_FOUND", { message: "Hearing not found" })
		return row
	}

	private async findSucceededHearingPaymentIntent(hearingRoomId: string) {
		const [row] = await db
			.select()
			.from(paymentIntents)
			.where(
				and(
					eq(paymentIntents.hearingRoomId, hearingRoomId),
					eq(paymentIntents.purpose, "commission_hearing"),
					eq(paymentIntents.status, "succeeded")
				)
			)
			.orderBy(desc(paymentIntents.paidAt))
			.limit(1)
		return row ?? null
	}

	private async findActiveHearingPaymentIntent(hearingRoomId: string) {
		const [row] = await db
			.select()
			.from(paymentIntents)
			.where(
				and(
					eq(paymentIntents.hearingRoomId, hearingRoomId),
					eq(paymentIntents.purpose, "commission_hearing"),
					inArray(paymentIntents.status, ["pending", "processing"])
				)
			)
			.orderBy(desc(paymentIntents.createdAt))
			.limit(1)
		return row ?? null
	}

	private hearingPaymentMetadata(row: HearingPaymentIntent): {
		qrCode: string | null
		checkoutUrl: string | null
	} {
		const meta = row.metadata
		if (!meta || typeof meta !== "object") return { qrCode: null, checkoutUrl: null }
		const m = meta as Record<string, unknown>
		return {
			qrCode: typeof m.qrCode === "string" ? m.qrCode : null,
			checkoutUrl: typeof m.checkoutUrl === "string" ? m.checkoutUrl : null,
		}
	}

	private shapeHearingPaymentStatus(
		hearingRoomId: string,
		required: boolean,
		intent: HearingPaymentIntent | null
	): HearingPaymentStatusDto {
		const paid = !required || intent?.status === "succeeded"
		const meta = intent ? this.hearingPaymentMetadata(intent) : { qrCode: null, checkoutUrl: null }
		const status =
			intent?.status === "pending" ||
			intent?.status === "processing" ||
			intent?.status === "succeeded" ||
			intent?.status === "failed"
				? intent.status
				: "none"

		return {
			hearingRoomId,
			amountPhp: HEARING_FEE_PHP,
			required,
			paid,
			status,
			paymentIntentId: intent?.id ?? null,
			qrCode: paid ? null : meta.qrCode,
			checkoutUrl: paid ? null : meta.checkoutUrl,
			sandboxTestMode: hitpayDevSandboxTestEnabled(),
			paidAt: intent?.paidAt?.toISOString() ?? null,
		}
	}

	private emitHearingPaymentUpdated(
		hearingRoomId: string,
		applicantUserId: string,
		enaUserId: string,
		paidAt?: Date | null
	) {
		const payload = {
			hearingRoomId,
			status: "succeeded" as const,
			paidAt: paidAt?.toISOString() ?? null,
		}
		this.events.emitToUser(applicantUserId, "commission-hearing:payment-updated", payload)
		if (enaUserId !== applicantUserId) {
			this.events.emitToUser(enaUserId, "commission-hearing:payment-updated", payload)
		}
	}

	private async trySyncHearingPaymentFromHitpay(
		intent: HearingPaymentIntent,
		row: HearingRow
	): Promise<HearingPaymentIntent | null> {
		if (!this.hitpay.isConfigured()) return null
		if (intent.purpose !== "commission_hearing") return null
		if (intent.status !== "pending" && intent.status !== "processing") return null
		const externalId = intent.externalId?.trim()
		if (!externalId) return null

		try {
			const remote = await this.hitpay.getPaymentRequest(externalId)
			if (!isHitpayPaymentRequestCompleted(remote.status)) return null
			if (remote.referenceNumber && remote.referenceNumber !== intent.id) {
				this.log.warn(
					`HitPay sync reference mismatch for hearing intent ${intent.id}: expected ${intent.id}, got ${remote.referenceNumber}`
				)
				return null
			}
			if (Math.floor(intent.amount) !== remote.amountPhp) {
				this.log.warn(
					`HitPay sync amount mismatch for hearing intent ${intent.id}: expected ${intent.amount}, got ${remote.amountPhp}`
				)
				return null
			}

			const now = new Date()
			const [updated] = await db
				.update(paymentIntents)
				.set({
					status: "succeeded",
					paidAt: now,
					updatedAt: now,
					...(remote.id && !intent.externalId ? { externalId: remote.id } : {}),
				})
				.where(eq(paymentIntents.id, intent.id))
				.returning()
			const finalIntent = updated ?? intent
			this.emitHearingPaymentUpdated(row.id, row.applicantUserId, row.enaUserId, finalIntent.paidAt)
			return finalIntent
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.warn(`HitPay hearing payment sync failed for intent ${intent.id}: ${msg}`)
			return null
		}
	}

	private async resolveOppositorAccess(
		hearingRoomId: string,
		userId: string,
		oppositionToken?: string
	): Promise<OppositionRow | null> {
		const tokenHash = oppositionToken ? this.hashInviteToken(oppositionToken) : null
		let row: OppositionRow | undefined
		if (tokenHash) {
			const [byToken] = await db
				.select()
				.from(commissionHearingOppositions)
				.where(
					and(
						eq(commissionHearingOppositions.hearingRoomId, hearingRoomId),
						eq(commissionHearingOppositions.accessTokenHash, tokenHash)
					)
				)
				.orderBy(desc(commissionHearingOppositions.updatedAt))
				.limit(1)
			row = byToken
		}
		if (!row) {
			const [byUser] = await db
				.select()
				.from(commissionHearingOppositions)
				.where(
					and(
						eq(commissionHearingOppositions.hearingRoomId, hearingRoomId),
						eq(commissionHearingOppositions.oppositorUserId, userId),
						eq(commissionHearingOppositions.status, "access_granted")
					)
				)
				.orderBy(desc(commissionHearingOppositions.updatedAt))
				.limit(1)
			row = byUser
		}
		if (!row) return null
		if (row.accessExpiresAt && row.accessExpiresAt < new Date()) return null
		return row
	}

	private async assertOppositionFileOwnedByUser(
		userId: string,
		fileObjectId: string,
		notFoundMessage: string
	): Promise<void> {
		const [file] = await db
			.select({ id: fileObjects.id })
			.from(fileObjects)
			.where(
				and(
					eq(fileObjects.id, fileObjectId),
					eq(fileObjects.ownerUserId, userId),
					eq(fileObjects.purpose, "commission_opposition")
				)
			)
			.limit(1)
		if (!file) throw new ORPCError("NOT_FOUND", { message: notFoundMessage })
	}

	private async getOppositionForHearing(
		hearingRoomId: string,
		oppositionId: string
	): Promise<OppositionRow> {
		const [row] = await db
			.select()
			.from(commissionHearingOppositions)
			.where(
				and(
					eq(commissionHearingOppositions.id, oppositionId),
					eq(commissionHearingOppositions.hearingRoomId, hearingRoomId)
				)
			)
			.limit(1)
		if (!row) throw new ORPCError("NOT_FOUND", { message: "Opposition not found" })
		return row
	}

	private shapeOpposition(row: OppositionRow): OppositionDto {
		return {
			id: row.id,
			applicationId: row.applicationId,
			hearingRoomId: row.hearingRoomId,
			oppositorName: row.oppositorName,
			oppositorEmail: row.oppositorEmail,
			oppositorUserId: row.oppositorUserId,
			grounds: row.grounds,
			verifiedDocumentFileObjectId: row.verifiedDocumentFileObjectId,
			representativeDocumentFileObjectId: row.representativeDocumentFileObjectId,
			status: row.status,
			nonAppearanceExcused: row.nonAppearanceExcused,
			createdAt: row.createdAt.toISOString(),
		}
	}

	private emitOppositionUpdated(row: OppositionRow): void {
		const payload = {
			hearingRoomId: row.hearingRoomId,
			applicationId: row.applicationId,
			oppositionId: row.id,
			status: row.status,
		}
		if (row.hearingRoomId) {
			this.events.emitToSession(row.hearingRoomId, "commission-hearing:opposition-updated", payload)
		}
	}

	private async shapeMany(rows: HearingRow[]): Promise<CommissionHearingDto[]> {
		return Promise.all(rows.map(row => this.shapeOne(row)))
	}

	private async shapeOne(row: HearingRow): Promise<CommissionHearingDto> {
		const [applicant] = await db
			.select()
			.from(users)
			.where(eq(users.id, row.applicantUserId))
			.limit(1)
		const verificationAppointmentId = await this.ensureVerificationAppointmentForRoom(row)
		const paymentStatus = await this.resolveHearingPaymentSummaryStatus(row.id)
		return {
			id: row.id,
			applicationId: row.applicationId,
			enaUserId: row.enaUserId,
			applicantUserId: row.applicantUserId,
			applicantName: applicant?.name ?? "Applicant",
			applicantEmail: applicant?.email ?? "",
			livekitRoomName: row.livekitRoomName,
			scheduledAt: row.scheduledAt?.toISOString() ?? null,
			instructions: row.instructions,
			status: row.status,
			startedAt: row.startedAt?.toISOString() ?? null,
			endedAt: row.endedAt?.toISOString() ?? null,
			recordingActive: Boolean(row.recordingEgressId && !row.recordingStoppedAt),
			paymentRequired: true,
			paymentStatus,
			lobbyPath: `/commission-hearings/${row.id}/lobby`,
			verificationAppointmentId,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		}
	}

	private async resolveHearingPaymentSummaryStatus(
		hearingRoomId: string
	): Promise<CommissionHearingDto["paymentStatus"]> {
		const succeeded = await this.findSucceededHearingPaymentIntent(hearingRoomId)
		if (succeeded) return "succeeded"
		const active = await this.findActiveHearingPaymentIntent(hearingRoomId)
		if (active?.status === "pending" || active?.status === "processing") return active.status

		const [failed] = await db
			.select({ status: paymentIntents.status })
			.from(paymentIntents)
			.where(
				and(
					eq(paymentIntents.hearingRoomId, hearingRoomId),
					eq(paymentIntents.purpose, "commission_hearing"),
					eq(paymentIntents.status, "failed")
				)
			)
			.orderBy(desc(paymentIntents.updatedAt))
			.limit(1)

		return failed ? "failed" : "none"
	}

	private async ensureVerificationAppointmentForRoom(row: HearingRow): Promise<string> {
		const [application] = await db
			.select({ verificationAppointmentId: enpCommissionApplications.summaryHearingAppointmentId })
			.from(enpCommissionApplications)
			.where(eq(enpCommissionApplications.id, row.applicationId))
			.limit(1)
		if (application?.verificationAppointmentId) return application.verificationAppointmentId

		const id = randomUUID()
		const now = new Date()
		await db.insert(appointments).values({
			id,
			clientUserId: row.enaUserId,
			enpUserId: row.applicantUserId,
			title: "Commission summary hearing",
			description: "Electronic notarial commission application summary hearing.",
			status:
				row.status === "in_session" ? "in_session" : row.status === "ended" ? "ended" : "confirmed",
			kind: "commission_hearing",
			scheduledAt: row.scheduledAt ?? now,
			durationMinutes: 60,
			location: "Remote audiovisual hearing",
			meetingUrl: `/commission-hearings/${row.id}/lobby`,
			notes: row.instructions,
			notarizationType: "acknowledgment",
			sessionMode: "remote",
			confirmedAt: now,
			canStart: true,
			canRejoin: row.status === "in_session",
			createdAt: now,
			updatedAt: now,
		})
		await db
			.update(enpCommissionApplications)
			.set({ summaryHearingAppointmentId: id, updatedAt: now })
			.where(eq(enpCommissionApplications.id, row.applicationId))
		return id
	}

	private async assertHearingLobbyChecksOk(userId: string, verificationAppointmentId: string) {
		const [passedLiveness] = await db
			.select({ id: livenessValidations.id })
			.from(livenessValidations)
			.where(
				and(
					eq(livenessValidations.userId, userId),
					eq(livenessValidations.appointmentId, verificationAppointmentId),
					eq(livenessValidations.status, "pass")
				)
			)
			.limit(1)
		if (!passedLiveness) {
			throw new ORPCError("FORBIDDEN", {
				message: "Complete the session liveness check in the lobby before joining the hearing.",
			})
		}
		if (!(await hasRecentAllowedLocationAudit(userId, verificationAppointmentId))) {
			throw new ORPCError("FORBIDDEN", {
				message: "Complete the location verification in the lobby before joining the hearing.",
			})
		}
	}

	private async displayNameForUser(userId: string): Promise<string> {
		const [user] = await db
			.select({ name: users.name, email: users.email })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)
		return user?.name || user?.email || "Participant"
	}

	private hashInviteToken(token: string): string {
		return createHash("sha256").update(token).digest("hex")
	}
}
