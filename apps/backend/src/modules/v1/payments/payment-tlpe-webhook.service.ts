import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common"
import { eq } from "drizzle-orm"

import { appointments, enbAccessRequests, paymentIntents } from "@repo/db/schema"

import { TlpeService } from "@/services/tlpe/tlpe.service"
import { validateTlpeNotifyAuthorization } from "@/services/tlpe/tlpe-notify"
import { tlpeAuthorizationHeader } from "@/services/tlpe/tlpe.client"
import { db } from "@/common/database/database.client"

import { EventsService } from "../events/events.service"

@Injectable()
export class PaymentTlpeWebhookService {
	private readonly log = new Logger(PaymentTlpeWebhookService.name)

	constructor(
		private readonly tlpe: TlpeService,
		private readonly events: EventsService
	) {}

	async handleRawWebhook(headers: Record<string, unknown>, rawBody: Buffer): Promise<void> {
		if (!validateTlpeNotifyAuthorization(headers, tlpeAuthorizationHeader())) {
			throw new UnauthorizedException("Invalid or missing TLPE Authorization header")
		}

		const parsed = this.tlpe.parseNotifyBody(rawBody.toString("utf8"), headers)
		if (!parsed) {
			throw new BadRequestException("Invalid TLPE notify payload")
		}
		if (!parsed.paid) {
			this.log.debug(`Ignoring TLPE notify status=${parsed.statusCode}`)
			return
		}

		const transactionId = parsed.transactionId
		const reference = parsed.referenceNumber

		let intent =
			reference !== null
				? await db
						.select()
						.from(paymentIntents)
						.where(eq(paymentIntents.id, reference))
						.limit(1)
						.then(rows => rows[0])
				: undefined

		if (!intent) {
			intent = await db
				.select()
				.from(paymentIntents)
				.where(eq(paymentIntents.id, transactionId))
				.limit(1)
				.then(rows => rows[0])
		}

		if (!intent) {
			intent = await db
				.select()
				.from(paymentIntents)
				.where(eq(paymentIntents.externalId, transactionId))
				.limit(1)
				.then(rows => rows[0])
		}

		if (!intent) {
			throw new BadRequestException("Unknown payment intent for TLPE webhook")
		}
		if (intent.provider !== "tlpe") {
			this.log.warn(`TLPE webhook for non-TLPE intent ${intent.id} (provider=${intent.provider})`)
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
				...(transactionId && !intent.externalId ? { externalId: transactionId } : {}),
			})
			.where(eq(paymentIntents.id, intent.id))

		if (intent.purpose === "ctc_request") {
			const requestId = intent.enbAccessRequestId
			if (!requestId) return

			const [request] = await db
				.select({
					requesterUserId: enbAccessRequests.requesterUserId,
					enpUserId: enbAccessRequests.enpUserId,
				})
				.from(enbAccessRequests)
				.where(eq(enbAccessRequests.id, requestId))
				.limit(1)
			if (!request?.requesterUserId) return

			const payload = { requestId, status: "succeeded" as const }
			this.events.emitToUser(request.requesterUserId, "signed:ctc-payment-updated", payload)
			if (request.enpUserId !== request.requesterUserId) {
				this.events.emitToUser(request.enpUserId, "signed:ctc-payment-updated", payload)
			}
			return
		}

		if (intent.purpose !== "meeting_session") {
			this.log.warn(`TLPE webhook for unsupported intent purpose ${intent.id} (${intent.purpose})`)
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
