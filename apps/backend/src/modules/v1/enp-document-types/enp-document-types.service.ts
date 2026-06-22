import { Injectable } from "@nestjs/common"
import { ORPCError } from "@orpc/server"
import { and, count, desc, eq, ilike, inArray } from "drizzle-orm"

import type { CreateEnpDocumentType, EnpDocumentType, UpdateEnpDocumentType } from "@repo/contracts"
import { enpDocumentTypes, enpProfiles } from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"

function normalizeName(raw: string): string {
	return raw.trim().replace(/\s+/g, " ")
}

function shape(row: typeof enpDocumentTypes.$inferSelect): EnpDocumentType {
	return {
		id: row.id,
		enpId: row.enpUserId,
		name: row.name,
		pricePhp: row.pricePhp,
		isActive: row.isActive,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	}
}

@Injectable()
export class EnpDocumentTypesService {
	async listForEnp(enpId: string): Promise<EnpDocumentType[]> {
		const rows = await db
			.select()
			.from(enpDocumentTypes)
			.where(and(eq(enpDocumentTypes.enpUserId, enpId), eq(enpDocumentTypes.isActive, true)))
			.orderBy(desc(enpDocumentTypes.updatedAt), desc(enpDocumentTypes.createdAt))
		return rows.filter(r => typeof r.pricePhp === "number" && r.pricePhp > 0).map(shape)
	}

	async listMine(ctx: QlegalSessionContext | null): Promise<EnpDocumentType[]> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		await this.assertHasEnpProfile(ctx.userId)
		const rows = await db
			.select()
			.from(enpDocumentTypes)
			.where(and(eq(enpDocumentTypes.enpUserId, ctx.userId), eq(enpDocumentTypes.isActive, true)))
			.orderBy(desc(enpDocumentTypes.updatedAt), desc(enpDocumentTypes.createdAt))
		return rows.map(shape)
	}

	async create(
		ctx: QlegalSessionContext | null,
		input: CreateEnpDocumentType
	): Promise<EnpDocumentType> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		await this.assertHasEnpProfile(ctx.userId)

		const name = normalizeName(input.name)
		if (!name) throw new ORPCError("BAD_REQUEST", { message: "Name is required" })

		// Prevent obvious duplicates within an ENP (case-insensitive match) among ACTIVE types.
		// Inactive types are treated as deleted (ENP can re-create the same name freely).
		const [dup] = await db
			.select({ id: enpDocumentTypes.id })
			.from(enpDocumentTypes)
			.where(
				and(
					eq(enpDocumentTypes.enpUserId, ctx.userId),
					eq(enpDocumentTypes.isActive, true),
					ilike(enpDocumentTypes.name, name)
				)
			)
			.limit(1)
		if (dup) {
			throw new ORPCError("BAD_REQUEST", {
				message: "A document type with this name already exists",
			})
		}

		const now = new Date()
		const [inserted] = await db
			.insert(enpDocumentTypes)
			.values({
				enpUserId: ctx.userId,
				name,
				pricePhp: Math.floor(input.pricePhp),
				isActive: true,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
		if (!inserted) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Create failed" })
		return shape(inserted)
	}

	async update(
		ctx: QlegalSessionContext | null,
		input: UpdateEnpDocumentType
	): Promise<EnpDocumentType> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		await this.assertHasEnpProfile(ctx.userId)

		const patch: Partial<typeof enpDocumentTypes.$inferInsert> = { updatedAt: new Date() }
		if (input.name !== undefined) {
			const name = normalizeName(input.name)
			if (!name) throw new ORPCError("BAD_REQUEST", { message: "Name is required" })
			patch.name = name
		}
		if (input.pricePhp !== undefined) {
			patch.pricePhp = Math.floor(input.pricePhp)
		}
		if (input.isActive !== undefined) {
			patch.isActive = input.isActive
		}

		const [updated] = await db
			.update(enpDocumentTypes)
			.set(patch)
			.where(and(eq(enpDocumentTypes.id, input.id), eq(enpDocumentTypes.enpUserId, ctx.userId)))
			.returning()
		if (!updated) throw new ORPCError("NOT_FOUND", { message: "Document type not found" })
		return shape(updated)
	}

	async delete(ctx: QlegalSessionContext | null, id: string): Promise<{ ok: true; id: string }> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		await this.assertHasEnpProfile(ctx.userId)

		// Delete should always succeed for ENPs: treat as soft-delete (deactivate).
		// Historical bookings/review requests keep their price snapshots via join tables.
		const [updated] = await db
			.update(enpDocumentTypes)
			.set({ isActive: false, updatedAt: new Date() })
			.where(and(eq(enpDocumentTypes.id, id), eq(enpDocumentTypes.enpUserId, ctx.userId)))
			.returning({ id: enpDocumentTypes.id })
		if (!updated) throw new ORPCError("NOT_FOUND", { message: "Document type not found" })
		return { ok: true as const, id: updated.id }
	}

	async resolveAndValidateSelection(args: {
		enpId: string
		documentTypeIds: string[]
	}): Promise<{ id: string; pricePhp: number }[]> {
		const ids = [...new Set(args.documentTypeIds.map(s => s.trim()).filter(Boolean))]
		if (ids.length === 0) {
			throw new ORPCError("BAD_REQUEST", { message: "At least one document type must be selected" })
		}

		const activeCountRow = await db
			.select({ n: count() })
			.from(enpDocumentTypes)
			.where(and(eq(enpDocumentTypes.enpUserId, args.enpId), eq(enpDocumentTypes.isActive, true)))
			.limit(1)
		const activeCount = Number(activeCountRow[0]?.n ?? 0)
		if (activeCount === 0) {
			throw new ORPCError("FORBIDDEN", {
				message: "This ENP is not accepting bookings until document pricing is configured.",
			})
		}

		const rows = await db
			.select({ id: enpDocumentTypes.id, pricePhp: enpDocumentTypes.pricePhp })
			.from(enpDocumentTypes)
			.where(
				and(
					eq(enpDocumentTypes.enpUserId, args.enpId),
					eq(enpDocumentTypes.isActive, true),
					inArray(enpDocumentTypes.id, ids)
				)
			)

		if (rows.length !== ids.length) {
			throw new ORPCError("BAD_REQUEST", {
				message: "One or more selected document types are invalid for this ENP.",
			})
		}
		for (const r of rows) {
			if (typeof r.pricePhp !== "number" || r.pricePhp <= 0) {
				throw new ORPCError("FORBIDDEN", {
					message: "One or more selected document types is missing a price.",
				})
			}
		}
		return rows.map(r => ({ id: r.id, pricePhp: r.pricePhp }))
	}

	private async assertHasEnpProfile(userId: string) {
		const [enp] = await db
			.select({ userId: enpProfiles.userId })
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, userId))
			.limit(1)
		if (!enp) throw new ORPCError("FORBIDDEN", { message: "ENP profile required" })
	}
}
