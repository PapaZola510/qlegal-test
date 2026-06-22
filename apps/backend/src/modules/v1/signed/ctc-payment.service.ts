import { Injectable, Logger } from "@nestjs/common"
import { ORPCError } from "@orpc/server"
import { and, desc, eq, inArray } from "drizzle-orm"

import type {
	CreateCtcPaymentResult,
	CtcPaymentStatus,
	MeetingPaymentBrands,
} from "@repo/contracts"
import { enbAccessRequests, paymentIntents, users } from "@repo/db/schema"

import { env } from "@/config/env.config"
import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { computeMeetingPaymentBreakdown } from "@/modules/v1/appointments/lib/meeting-payment-breakdown"
import { EventsService } from "@/modules/v1/events/events.service"
import { tlpeConfigured, tlpeDevTestSimulateEnabled } from "@/services/tlpe/tlpe.client"
import {
	isTlpeBrandUnavailableOnTestApi,
	tlpeBrandUnavailableMessage,
} from "@/services/tlpe/tlpe-brand-availability"
import { resolveTlpePaymentOption } from "@/services/tlpe/tlpe-options"
import { TlpeService } from "@/services/tlpe/tlpe.service"

@Injectable()
export class CtcPaymentService {
	private readonly log = new Logger(CtcPaymentService.name)

	constructor(
		private readonly tlpe: TlpeService,
		private readonly events: EventsService
	) {}

	private resolveCtcFees() {
		const baseFeePhp = Math.max(1, Math.floor(env.CTC_FEE_PHP))
		const breakdown = computeMeetingPaymentBreakdown(baseFeePhp)
		return { baseFeePhp, breakdown }
	}

	private paymentMetadata(row: typeof paymentIntents.$inferSelect): {
		qrCode: string | null
		checkoutUrl: string | null
		paymentBrandLabel: string | null
	} {
		const meta =
			typeof row.metadata === "object" && row.metadata
				? (row.metadata as Record<string, unknown>)
				: {}
		const checkoutUrl =
			typeof meta.checkoutUrl === "string" ? meta.checkoutUrl.trim() || null : null
		const qrCode = typeof meta.qrCode === "string" ? meta.qrCode.trim() || null : null
		const paymentBrandLabel =
			typeof meta.paymentBrandLabel === "string" ? meta.paymentBrandLabel.trim() || null : null
		return {
			qrCode: qrCode ?? checkoutUrl,
			checkoutUrl,
			paymentBrandLabel,
		}
	}

	private shapeStatus(
		requestId: string,
		intent: typeof paymentIntents.$inferSelect | null
	): CtcPaymentStatus {
		const { breakdown } = this.resolveCtcFees()
		const paid = intent?.status === "succeeded"
		const meta = intent ? this.paymentMetadata(intent) : null
		return {
			requestId,
			required: true,
			totalFeePhp: breakdown.totalPhp,
			breakdown,
			paid,
			paymentIntentId: intent?.id ?? null,
			status: intent?.status ?? null,
			qrCode: meta?.qrCode ?? null,
			checkoutUrl: meta?.checkoutUrl ?? null,
			paymentProvider: "tlpe",
			tlpeTestMode: tlpeDevTestSimulateEnabled(),
			selectedPaymentBrand: meta?.paymentBrandLabel ?? null,
		}
	}

	private async loadClientCtcRequest(requestId: string, clientUserId: string) {
		const [row] = await db
			.select()
			.from(enbAccessRequests)
			.where(eq(enbAccessRequests.id, requestId))
			.limit(1)
		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "Certified true copy request not found" })
		}
		if (!row.certifiedTrueCopy) {
			throw new ORPCError("BAD_REQUEST", { message: "This request is not a certified true copy" })
		}
		if (row.requesterUserId !== clientUserId) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only the requesting client can manage CTC payment",
			})
		}
		if (row.requesterPaymentMethod !== "online") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Online payment is not required for this certified true copy request",
			})
		}
		if (row.outcome === "refused") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Payment is not available for refused certified true copy requests",
			})
		}
		return row
	}

	private async findSucceededIntent(requestId: string) {
		const [row] = await db
			.select()
			.from(paymentIntents)
			.where(
				and(
					eq(paymentIntents.enbAccessRequestId, requestId),
					eq(paymentIntents.purpose, "ctc_request"),
					eq(paymentIntents.status, "succeeded")
				)
			)
			.orderBy(desc(paymentIntents.paidAt))
			.limit(1)
		return row ?? null
	}

	private async findActiveIntent(requestId: string) {
		const [row] = await db
			.select()
			.from(paymentIntents)
			.where(
				and(
					eq(paymentIntents.enbAccessRequestId, requestId),
					eq(paymentIntents.purpose, "ctc_request"),
					inArray(paymentIntents.status, ["pending", "processing"])
				)
			)
			.orderBy(desc(paymentIntents.createdAt))
			.limit(1)
		return row ?? null
	}

	private emitPaymentUpdated(requestId: string, clientUserId: string, enpUserId: string) {
		const payload = { requestId, status: "succeeded" as const }
		this.events.emitToUser(clientUserId, "signed:ctc-payment-updated", payload)
		if (enpUserId !== clientUserId) {
			this.events.emitToUser(enpUserId, "signed:ctc-payment-updated", payload)
		}
	}

	private async markSucceeded(
		intent: typeof paymentIntents.$inferSelect,
		clientUserId: string,
		enpUserId: string,
		externalId?: string
	): Promise<typeof paymentIntents.$inferSelect> {
		if (intent.status === "succeeded") return intent
		const now = new Date()
		const [updated] = await db
			.update(paymentIntents)
			.set({
				status: "succeeded",
				paidAt: now,
				updatedAt: now,
				...(externalId && !intent.externalId ? { externalId } : {}),
			})
			.where(eq(paymentIntents.id, intent.id))
			.returning()
		const finalRow = updated ?? intent
		if (finalRow.enbAccessRequestId) {
			this.emitPaymentUpdated(finalRow.enbAccessRequestId, clientUserId, enpUserId)
		}
		return finalRow
	}

	private async trySyncFromTlpe(
		intent: typeof paymentIntents.$inferSelect,
		clientUserId: string,
		enpUserId: string
	): Promise<typeof paymentIntents.$inferSelect | null> {
		if (!this.tlpe.isConfigured()) return null
		const candidates = [intent.externalId?.trim(), intent.id.trim()].filter((id): id is string =>
			Boolean(id)
		)
		if (!candidates.length) return null

		for (const transactionId of [...new Set(candidates)]) {
			try {
				const remote = await this.tlpe.syncPayment(transactionId)
				if (!remote.paid) continue
				return await this.markSucceeded(intent, clientUserId, enpUserId, remote.transactionId)
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e)
				this.log.warn(`TLPE CTC sync failed for intent ${intent.id} (${transactionId}): ${msg}`)
			}
		}
		return null
	}

	async getPaymentStatus(
		ctx: QlegalSessionContext | null,
		requestId: string
	): Promise<CtcPaymentStatus> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		const request = await this.loadClientCtcRequest(requestId, ctx.userId)

		const succeeded = await this.findSucceededIntent(requestId)
		if (succeeded) return this.shapeStatus(requestId, succeeded)

		const active = await this.findActiveIntent(requestId)
		if (active) {
			const synced = await this.trySyncFromTlpe(active, request.requesterUserId!, request.enpUserId)
			return this.shapeStatus(requestId, synced ?? active)
		}

		return this.shapeStatus(requestId, null)
	}

	async listPaymentBrands(
		ctx: QlegalSessionContext | null,
		requestId: string
	): Promise<MeetingPaymentBrands> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		await this.loadClientCtcRequest(requestId, ctx.userId)

		if (!tlpeConfigured()) {
			throw new ORPCError("SERVICE_UNAVAILABLE", {
				message: "AltPayNet TLPE is not configured on this server",
			})
		}

		try {
			return await this.tlpe.listPaymentBrands()
		} catch (e) {
			const message = e instanceof Error ? e.message : "Could not load TLPE payment brands"
			throw new ORPCError("BAD_GATEWAY", { message })
		}
	}

	async createPayment(
		ctx: QlegalSessionContext | null,
		requestId: string,
		paymentOptionCode?: string
	): Promise<CreateCtcPaymentResult> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		const request = await this.loadClientCtcRequest(requestId, ctx.userId)

		const existingPaid = await this.findSucceededIntent(requestId)
		if (existingPaid) {
			const shaped = this.shapeStatus(requestId, existingPaid)
			return { ...shaped, paymentIntentId: existingPaid.id, status: existingPaid.status }
		}

		if (!tlpeConfigured()) {
			throw new ORPCError("SERVICE_UNAVAILABLE", {
				message: "AltPayNet TLPE is not configured on this server",
			})
		}

		const { breakdown } = this.resolveCtcFees()
		const now = new Date()

		await db
			.update(paymentIntents)
			.set({ status: "cancelled", updatedAt: now })
			.where(
				and(
					eq(paymentIntents.enbAccessRequestId, requestId),
					eq(paymentIntents.purpose, "ctc_request"),
					inArray(paymentIntents.status, ["pending", "processing"])
				)
			)

		const [clientUser] = await db
			.select({ email: users.email, name: users.name })
			.from(users)
			.where(eq(users.id, request.requesterUserId!))
			.limit(1)

		const [intent] = await db
			.insert(paymentIntents)
			.values({
				userId: request.requesterUserId!,
				appointmentId: request.appointmentId,
				enbAccessRequestId: requestId,
				amount: breakdown.totalPhp,
				currency: "PHP",
				status: "pending",
				description: `Certified true copy · ${request.requesterName}`,
				purpose: "ctc_request",
				provider: "tlpe",
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		if (!intent) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not create payment intent" })
		}

		await db
			.update(enbAccessRequests)
			.set({ paymentIntentId: intent.id, updatedAt: now })
			.where(eq(enbAccessRequests.id, requestId))

		try {
			const explicitPreference = paymentOptionCode?.trim()
			const resolvedOption = explicitPreference
				? await resolveTlpePaymentOption(explicitPreference)
				: await resolveTlpePaymentOption()

			if (explicitPreference && isTlpeBrandUnavailableOnTestApi(explicitPreference)) {
				throw new ORPCError("BAD_REQUEST", {
					message: tlpeBrandUnavailableMessage(explicitPreference),
				})
			}
			if (explicitPreference && !resolvedOption) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Payment brand "${explicitPreference}" is not available from AltPayNet`,
				})
			}

			const tlpeResult = await this.tlpe.createEasyPaymentLink({
				amountPhp: breakdown.totalPhp,
				transactionId: intent.id,
				description: `Certified true copy · ${request.requesterName}`,
				customer: {
					email: clientUser?.email,
					name: clientUser?.name,
				},
				convenienceFixedFeePhp: breakdown.processingFeePhp,
				paymentOptionCode: resolvedOption?.value ?? explicitPreference,
			})

			const tlpeExternalId =
				"tlpeTransactionId" in tlpeResult && typeof tlpeResult.tlpeTransactionId === "string"
					? tlpeResult.tlpeTransactionId
					: tlpeResult.transactionId

			const [updated] = await db
				.update(paymentIntents)
				.set({
					externalId: tlpeExternalId,
					status: "processing",
					metadata: {
						feeBreakdown: breakdown,
						checkoutUrl: tlpeResult.link,
						merchantReferenceId: intent.id,
						paymentOptionCode: resolvedOption?.code ?? null,
						paymentBrandLabel: resolvedOption?.value ?? null,
					},
					updatedAt: new Date(),
				})
				.where(eq(paymentIntents.id, intent.id))
				.returning()

			const finalRow = updated ?? intent
			const shaped = this.shapeStatus(requestId, finalRow)
			return { ...shaped, paymentIntentId: finalRow.id, status: finalRow.status }
		} catch (e) {
			await db
				.update(paymentIntents)
				.set({ status: "failed", updatedAt: new Date() })
				.where(eq(paymentIntents.id, intent.id))
			if (e instanceof ORPCError) throw e
			const msg = e instanceof Error ? e.message : String(e)
			throw new ORPCError("BAD_GATEWAY", {
				message: `AltPayNet payment request failed: ${msg}`,
			})
		}
	}

	async simulatePayment(ctx: QlegalSessionContext | null, requestId: string): Promise<CtcPaymentStatus> {
		if (!tlpeDevTestSimulateEnabled()) {
			throw new ORPCError("FORBIDDEN", {
				message: "CTC payment simulation is only available in development with TLPE test API",
			})
		}
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		const request = await this.loadClientCtcRequest(requestId, ctx.userId)

		const succeeded = await this.findSucceededIntent(requestId)
		if (succeeded) return this.shapeStatus(requestId, succeeded)

		const now = new Date()
		const active = await this.findActiveIntent(requestId)
		const { breakdown } = this.resolveCtcFees()

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
						feeBreakdown: breakdown,
						simulatedSandbox: true,
					},
				})
				.where(eq(paymentIntents.id, active.id))
				.returning()
			finalIntent = updated ?? active
		} else {
			const [intent] = await db
				.insert(paymentIntents)
				.values({
					userId: request.requesterUserId!,
					appointmentId: request.appointmentId,
					enbAccessRequestId: requestId,
					amount: breakdown.totalPhp,
					currency: "PHP",
					status: "succeeded",
					description: `Certified true copy · ${request.requesterName}`,
					purpose: "ctc_request",
					provider: "tlpe",
					paidAt: now,
					metadata: { feeBreakdown: breakdown, simulatedSandbox: true },
					createdAt: now,
					updatedAt: now,
				})
				.returning()
			finalIntent = intent ?? null
			if (finalIntent) {
				await db
					.update(enbAccessRequests)
					.set({ paymentIntentId: finalIntent.id, updatedAt: now })
					.where(eq(enbAccessRequests.id, requestId))
			}
		}

		if (!finalIntent) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Could not simulate CTC payment" })
		}

		this.emitPaymentUpdated(requestId, request.requesterUserId!, request.enpUserId)
		return this.shapeStatus(requestId, finalIntent)
	}

	async assertOnlinePaymentComplete(requestId: string): Promise<void> {
		const succeeded = await this.findSucceededIntent(requestId)
		if (!succeeded) {
			throw new ORPCError("BAD_REQUEST", {
				message: "The client must complete online payment before you can grant this certified true copy",
			})
		}
	}
}
