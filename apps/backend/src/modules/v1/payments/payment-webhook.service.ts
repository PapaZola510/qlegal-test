import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common"
import { createHmac, timingSafeEqual } from "node:crypto"
import { eq } from "drizzle-orm"

import { appointments, paymentIntents, users } from "@repo/db/schema"

import type { EmailAdapter } from "@/services/email/email-adapter"
import { createEmailAdapter } from "@/services/email/email-adapter.provider"
import { db } from "@/common/database/database.client"
import { env } from "@/config/env.config"

import { EventsService } from "../events/events.service"

const SIG_HEADER = "x-qlegal-payment-signature"

@Injectable()
export class PaymentWebhookService {
	private readonly email: EmailAdapter = createEmailAdapter()

	constructor(private readonly events: EventsService) {}

	assertValidSignature(headers: Record<string, unknown>, rawBody: Buffer) {
		const secret = env.PAYMENT_WEBHOOK_SECRET
		if (!secret) {
			throw new BadRequestException("PAYMENT_WEBHOOK_SECRET is not configured")
		}
		const headerVal = headers[SIG_HEADER] ?? headers[SIG_HEADER.toUpperCase()]
		if (typeof headerVal !== "string" || !headerVal) {
			throw new UnauthorizedException("Missing payment webhook signature")
		}
		const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
		const a = Buffer.from(expected, "utf8")
		const b = Buffer.from(headerVal, "utf8")
		if (a.length !== b.length || !timingSafeEqual(a, b)) {
			throw new UnauthorizedException("Invalid payment webhook signature")
		}
	}

	async handleVerifiedJsonPayload(json: unknown) {
		const body = json as {
			intentId?: string
			status?: string
		}
		const intentId = body.intentId
		if (!intentId || typeof intentId !== "string") {
			throw new BadRequestException("Missing intentId")
		}
		const status =
			body.status === "succeeded" ? "succeeded" : body.status === "failed" ? "failed" : null
		if (!status) {
			throw new BadRequestException("Unsupported status")
		}

		const [row] = await db
			.select()
			.from(paymentIntents)
			.where(eq(paymentIntents.id, intentId))
			.limit(1)
		if (!row) throw new BadRequestException("Unknown payment intent")

		const now = new Date()
		await db
			.update(paymentIntents)
			.set({
				status,
				paidAt: status === "succeeded" ? now : null,
				updatedAt: now,
			})
			.where(eq(paymentIntents.id, intentId))

		if (status === "succeeded" && row.purpose === "exam_retake") {
			const [u] = await db
				.select({ email: users.email })
				.from(users)
				.where(eq(users.id, row.userId))
				.limit(1)
			if (u?.email) {
				await this.email.sendTransactional(u.email, "exam_retake_instructions", {
					intentId: row.id,
					amount: String(row.amount),
				})
			}
		}

		if (status === "succeeded" && row.purpose === "meeting_session" && row.appointmentId) {
			const [apt] = await db
				.select({ clientUserId: appointments.clientUserId, enpUserId: appointments.enpUserId })
				.from(appointments)
				.where(eq(appointments.id, row.appointmentId))
				.limit(1)
			if (apt) {
				const payloadEvent = { appointmentId: row.appointmentId, status: "succeeded" as const }
				this.events.emitToUser(apt.clientUserId, "appointments:payment-updated", payloadEvent)
				if (apt.enpUserId !== apt.clientUserId) {
					this.events.emitToUser(apt.enpUserId, "appointments:payment-updated", payloadEvent)
				}
			}
		}
	}
}
