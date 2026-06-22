import { BadRequestException, Injectable, Logger } from "@nestjs/common"
import { eq } from "drizzle-orm"

import { appointments, commissionHearingRooms, paymentIntents } from "@repo/db/schema"

import { HitpayService } from "@/services/hitpay/hitpay.service"
import { db } from "@/common/database/database.client"

import { EventsService } from "../events/events.service"

interface HitpayWebhookPayload {
	id?: string
	status?: string
	reference_number?: string
}

@Injectable()
export class PaymentHitpayWebhookService {
	private readonly log = new Logger(PaymentHitpayWebhookService.name)

	constructor(
		private readonly hitpay: HitpayService,
		private readonly events: EventsService
	) {}

	async handleRawWebhook(headers: Record<string, unknown>, rawBody: Buffer): Promise<void> {
		this.hitpay.assertWebhookSignature(headers, rawBody)

		let payload: HitpayWebhookPayload
		try {
			payload = JSON.parse(rawBody.toString("utf8")) as HitpayWebhookPayload
		} catch {
			throw new BadRequestException("Invalid JSON")
		}

		const hitpayStatus = typeof payload.status === "string" ? payload.status.toLowerCase() : ""
		if (hitpayStatus !== "completed") {
			this.log.debug(`Ignoring HitPay webhook status=${payload.status ?? "unknown"}`)
			return
		}

		const reference =
			typeof payload.reference_number === "string" && payload.reference_number.trim().length > 0
				? payload.reference_number.trim()
				: null
		const hitpayId = typeof payload.id === "string" ? payload.id : null

		let intent =
			reference !== null
				? await db
						.select()
						.from(paymentIntents)
						.where(eq(paymentIntents.id, reference))
						.limit(1)
						.then(rows => rows[0])
				: undefined

		if (!intent && hitpayId) {
			intent = await db
				.select()
				.from(paymentIntents)
				.where(eq(paymentIntents.externalId, hitpayId))
				.limit(1)
				.then(rows => rows[0])
		}

		if (!intent) {
			throw new BadRequestException("Unknown payment intent for HitPay webhook")
		}
		if (intent.provider !== "hitpay") {
			this.log.warn(
				`HitPay webhook for non-HitPay intent ${intent.id} (provider=${intent.provider})`
			)
			return
		}
		if (intent.purpose !== "meeting_session" && intent.purpose !== "commission_hearing") {
			this.log.warn(
				`HitPay webhook for unsupported intent purpose ${intent.purpose} (${intent.id})`
			)
			return
		}
		if (intent.status === "succeeded") return

		const now = new Date()
		await db
			.update(paymentIntents)
			.set({
				status: "succeeded",
				paidAt: now,
				updatedAt: now,
				...(hitpayId && !intent.externalId ? { externalId: hitpayId } : {}),
			})
			.where(eq(paymentIntents.id, intent.id))

		if (intent.purpose === "commission_hearing") {
			const hearingRoomId = intent.hearingRoomId
			if (!hearingRoomId) return

			const [room] = await db
				.select({
					applicantUserId: commissionHearingRooms.applicantUserId,
					enaUserId: commissionHearingRooms.enaUserId,
				})
				.from(commissionHearingRooms)
				.where(eq(commissionHearingRooms.id, hearingRoomId))
				.limit(1)
			if (!room) return

			const payloadEvent = {
				hearingRoomId,
				status: "succeeded" as const,
				paidAt: now.toISOString(),
			}
			this.events.emitToUser(
				room.applicantUserId,
				"commission-hearing:payment-updated",
				payloadEvent
			)
			if (room.enaUserId !== room.applicantUserId) {
				this.events.emitToUser(room.enaUserId, "commission-hearing:payment-updated", payloadEvent)
			}
			return
		}

		const appointmentId = intent.appointmentId
		if (!appointmentId) return
		const [apt] = await db
			.select({ clientUserId: appointments.clientUserId, enpUserId: appointments.enpUserId })
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!apt) return

		const payloadEvent = { appointmentId, status: "succeeded" as const }
		this.events.emitToUser(apt.clientUserId, "appointments:payment-updated", payloadEvent)
		if (apt.enpUserId !== apt.clientUserId) {
			this.events.emitToUser(apt.enpUserId, "appointments:payment-updated", payloadEvent)
		}
	}
}
