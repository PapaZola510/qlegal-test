import { Injectable, NotFoundException } from "@nestjs/common"
import { ORPCError } from "@orpc/server"
import { and, desc, eq, inArray, lt } from "drizzle-orm"

import { paymentIntents } from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import type { V1Inputs, V1Outputs } from "@/config/contract-types"

type PaymentRow = typeof paymentIntents.$inferSelect
type PaymentDto = V1Outputs["payment"]["list"][number]
type CreateInput = V1Inputs["payment"]["create"]

@Injectable()
export class PaymentsService {
	private rowToDto(row: PaymentRow): PaymentDto {
		const meta = (row.metadata ?? {}) as { paymentMethod?: string }
		return {
			id: row.id,
			userId: row.userId,
			amount: row.amount,
			currency: row.currency,
			status: row.status,
			description: row.description,
			purpose: row.purpose,
			provider: row.provider,
			referenceNumber: row.externalId,
			paymentMethod: meta.paymentMethod ?? null,
			paidAt: row.paidAt?.toISOString() ?? null,
			paidViaAdminOverride: row.paidViaAdminOverride,
			consumedAt: row.consumedAt?.toISOString() ?? null,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		}
	}

	async findAllForUser(userId: string): Promise<PaymentDto[]> {
		const rows = await db
			.select()
			.from(paymentIntents)
			.where(eq(paymentIntents.userId, userId))
			.orderBy(desc(paymentIntents.createdAt))
		return rows.map(r => this.rowToDto(r))
	}

	async findOneForUser(userId: string, id: string): Promise<PaymentDto> {
		const [row] = await db
			.select()
			.from(paymentIntents)
			.where(and(eq(paymentIntents.id, id), eq(paymentIntents.userId, userId)))
			.limit(1)
		if (!row) throw new NotFoundException(`Payment ${id} not found`)
		return this.rowToDto(row)
	}

	async create(userId: string, data: CreateInput): Promise<PaymentDto> {
		const now = new Date()
		const [row] = await db
			.insert(paymentIntents)
			.values({
				userId,
				amount: data.amount,
				currency: data.currency ?? "PHP",
				status: "pending",
				description: data.description,
				purpose: data.purpose ?? "other",
				provider: "stub",
				externalId: `stub_${now.getTime()}`,
				metadata: { checkoutHint: "Use webhook to mark succeeded in development" },
			})
			.returning()
		if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create payment" })
		return this.rowToDto(row)
	}

	/** Admin override: creates a succeeded retake intent (audited separately by caller). */
	async createAdminRetakeGrant(
		targetUserId: string,
		adminActorId: string
	): Promise<{ id: string }> {
		const now = new Date()
		const [row] = await db
			.insert(paymentIntents)
			.values({
				userId: targetUserId,
				amount: 0,
				currency: "PHP",
				status: "succeeded",
				description: "Exam retake — admin override",
				purpose: "exam_retake",
				provider: "stub",
				externalId: `admin_override_${now.getTime()}`,
				paidAt: now,
				paidViaAdminOverride: true,
				adminActorId,
				metadata: {},
			})
			.returning()
		if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to grant retake" })
		return { id: row.id }
	}

	/** Admin override: mark an existing intent as paid (caller writes audit_events). */
	async markSucceededByAdmin(paymentIntentId: string, adminActorId: string): Promise<PaymentDto> {
		const now = new Date()
		const [row] = await db
			.update(paymentIntents)
			.set({
				status: "succeeded",
				paidAt: now,
				paidViaAdminOverride: true,
				adminActorId,
				updatedAt: now,
			})
			.where(
				and(
					eq(paymentIntents.id, paymentIntentId),
					inArray(paymentIntents.status, ["pending", "processing"])
				)
			)
			.returning()
		if (!row) {
			const [existing] = await db
				.select()
				.from(paymentIntents)
				.where(eq(paymentIntents.id, paymentIntentId))
				.limit(1)
			if (!existing) throw new NotFoundException(`Payment ${paymentIntentId} not found`)
			throw new ORPCError("BAD_REQUEST", {
				message: "Only pending payment intents can be marked paid by admin",
			})
		}
		return this.rowToDto(row)
	}

	async findAllForAdmin(): Promise<PaymentDto[]> {
		const rows = await db.select().from(paymentIntents).orderBy(desc(paymentIntents.createdAt))
		return rows.map(r => this.rowToDto(r))
	}

	/** G1: expire stale checkout intents (in-process cron). */
	async expireStalePendingIntents(maxAgeMinutes: number): Promise<number> {
		const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000)
		const now = new Date()
		const updated = await db
			.update(paymentIntents)
			.set({ status: "cancelled", updatedAt: now })
			.where(and(eq(paymentIntents.status, "pending"), lt(paymentIntents.createdAt, cutoff)))
			.returning({ id: paymentIntents.id })
		return updated.length
	}
}
