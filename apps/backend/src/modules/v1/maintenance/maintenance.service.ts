import { Injectable, NotFoundException } from "@nestjs/common"
import { and, asc, eq, gte, inArray, isNull } from "drizzle-orm"

import {
	clientProfiles,
	enpProfiles,
	maintenanceMode,
	maintenanceWindows,
	users,
} from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import type { V1Inputs, V1Outputs } from "@/config/contract-types"
import { qlegalRoleFromProfiles } from "@/modules/v1/auth-profile/lib/effective-app-role"

type CreateMaintenanceInput = V1Inputs["maintenance"]["createForAdmin"]
type ListAdminInput = V1Inputs["maintenance"]["listForAdmin"]
type ListUserInput = V1Inputs["maintenance"]["listForUser"]
type MaintenanceWindowDto = V1Outputs["maintenance"]["listForAdmin"][number]
type SetModeInput = V1Inputs["maintenance"]["setMode"]
type MaintenanceStatusDto = V1Outputs["maintenance"]["getStatus"]

const MAINTENANCE_MODE_ROW_ID = "singleton"

@Injectable()
export class MaintenanceService {
	private toDto(row: typeof maintenanceWindows.$inferSelect): MaintenanceWindowDto {
		const durationMinutes = Math.max(
			1,
			Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 60000)
		)
		return {
			id: row.id,
			title: row.title,
			message: row.message,
			audience: row.audience,
			startsAt: row.startsAt.toISOString(),
			endsAt: row.endsAt.toISOString(),
			durationMinutes,
			createdAt: row.createdAt.toISOString(),
			updatedAt: row.updatedAt.toISOString(),
		}
	}

	async listForAdmin(input: ListAdminInput): Promise<Array<MaintenanceWindowDto>> {
		const now = new Date()
		const where = input.includePast
			? isNull(maintenanceWindows.cancelledAt)
			: and(isNull(maintenanceWindows.cancelledAt), gte(maintenanceWindows.endsAt, now))

		const rows = await db
			.select()
			.from(maintenanceWindows)
			.where(where)
			.orderBy(asc(maintenanceWindows.startsAt))

		return rows.map(r => this.toDto(r))
	}

	async createForAdmin(
		input: CreateMaintenanceInput,
		actorUserId: string
	): Promise<MaintenanceWindowDto> {
		const startsAt = new Date(input.startsAt)
		const endsAt = new Date(input.endsAt)
		const now = new Date()
		const [row] = await db
			.insert(maintenanceWindows)
			.values({
				title: input.title.trim(),
				message: input.message.trim(),
				audience: input.audience,
				startsAt,
				endsAt,
				createdByUserId: actorUserId,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
		return this.toDto(row!)
	}

	async dismissForAdmin(id: string): Promise<{ ok: true }> {
		const now = new Date()
		const [row] = await db
			.update(maintenanceWindows)
			.set({ cancelledAt: now, updatedAt: now })
			.where(and(eq(maintenanceWindows.id, id), isNull(maintenanceWindows.cancelledAt)))
			.returning({ id: maintenanceWindows.id })

		if (!row) {
			throw new NotFoundException("Maintenance window not found or already dismissed")
		}

		return { ok: true }
	}

	private async getUserRole(
		userId: string
	): Promise<"enp" | "client" | "admin" | "super_admin" | "sub_org_admin"> {
		const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
		if (!u) return "client"
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		const [client] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		const role = qlegalRoleFromProfiles(u.platformRole ?? "none", enp, client)
		if (role === "none") return "client"
		return role
	}

	async listForUser(userId: string, _input: ListUserInput): Promise<Array<MaintenanceWindowDto>> {
		const role = await this.getUserRole(userId)
		const now = new Date()

		const roleScopes: Array<"all" | "enp" | "client"> =
			role === "enp"
				? ["all", "enp"]
				: role === "client"
					? ["all", "client"]
					: ["all", "enp", "client"]

		// Match admin "upcoming" list: any non-cancelled window that has not ended yet,
		// regardless of how far in the future it starts.
		const rows = await db
			.select()
			.from(maintenanceWindows)
			.where(
				and(
					isNull(maintenanceWindows.cancelledAt),
					gte(maintenanceWindows.endsAt, now),
					inArray(maintenanceWindows.audience, roleScopes)
				)
			)
			.orderBy(asc(maintenanceWindows.startsAt))

		return rows.map(r => this.toDto(r))
	}

	/** Read the live maintenance-mode kill switch. Public — no auth. */
	async getMode(): Promise<MaintenanceStatusDto> {
		const [row] = await db
			.select()
			.from(maintenanceMode)
			.where(eq(maintenanceMode.id, MAINTENANCE_MODE_ROW_ID))
			.limit(1)
		return {
			enabled: row?.enabled ?? false,
			message: row?.message ?? null,
		}
	}

	/** Toggle the live maintenance-mode kill switch (upsert singleton row). */
	async setMode(input: SetModeInput, actorUserId: string): Promise<MaintenanceStatusDto> {
		const message = input.message?.trim() ? input.message.trim() : null
		const now = new Date()
		const [row] = await db
			.insert(maintenanceMode)
			.values({
				id: MAINTENANCE_MODE_ROW_ID,
				enabled: input.enabled,
				message,
				updatedByUserId: actorUserId,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: maintenanceMode.id,
				set: {
					enabled: input.enabled,
					message,
					updatedByUserId: actorUserId,
					updatedAt: now,
				},
			})
			.returning()
		return {
			enabled: row?.enabled ?? input.enabled,
			message: row?.message ?? message,
		}
	}
}
