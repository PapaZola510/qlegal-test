import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { and, asc, eq, inArray, isNull } from "drizzle-orm"

import { clientProfiles, enpProfiles, subOrgs, users } from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import type { V1Inputs, V1Outputs } from "@/config/contract-types"

type SubOrgDto = V1Outputs["subOrg"]["list"][number]
type SubOrgMemberDto = V1Outputs["subOrg"]["members"][number]
type CreateSubOrgInput = V1Inputs["subOrg"]["create"]

function slugify(name: string, id: string): string {
	const base = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40)
	const suffix = id.replace(/[^a-z0-9]/gi, "").slice(0, 8)
	return base.length > 0 ? `${base}-${suffix}` : `org-${suffix}`
}

@Injectable()
export class SubOrgsService {
	async findAllForUser(allowedSubOrgIds: string[]): Promise<SubOrgDto[]> {
		if (allowedSubOrgIds.length === 0) return []

		const rows = await db
			.select()
			.from(subOrgs)
			.where(and(inArray(subOrgs.id, allowedSubOrgIds), isNull(subOrgs.deletedAt)))
			.orderBy(asc(subOrgs.name))

		const withCounts = await Promise.all(rows.map(row => this.toSubOrgDto(row)))
		return withCounts
	}

	async findOneForUser(id: string, allowedSubOrgIds: string[]): Promise<SubOrgDto> {
		if (!allowedSubOrgIds.includes(id)) {
			throw new ForbiddenException("You do not have access to this sub-organization")
		}
		const [row] = await db
			.select()
			.from(subOrgs)
			.where(and(eq(subOrgs.id, id), isNull(subOrgs.deletedAt)))
			.limit(1)
		if (!row) throw new NotFoundException(`Sub-org ${id} not found`)
		return this.toSubOrgDto(row)
	}

	async create(ownerUserId: string, input: CreateSubOrgInput): Promise<SubOrgDto> {
		const now = new Date()
		const [inserted] = await db
			.insert(subOrgs)
			.values({
				ownerId: ownerUserId,
				name: input.name,
				kind: "personal",
				createdAt: now,
				updatedAt: now,
			})
			.returning()
		if (!inserted) throw new NotFoundException("Failed to create sub-organization")
		return this.toSubOrgDto(inserted)
	}

	async getMembersForUser(
		subOrgId: string,
		allowedSubOrgIds: string[]
	): Promise<SubOrgMemberDto[]> {
		if (!allowedSubOrgIds.includes(subOrgId)) {
			throw new ForbiddenException("You do not have access to this sub-organization")
		}
		const [org] = await db
			.select()
			.from(subOrgs)
			.where(and(eq(subOrgs.id, subOrgId), isNull(subOrgs.deletedAt)))
			.limit(1)
		if (!org) throw new NotFoundException(`Sub-org ${subOrgId} not found`)

		const enpRows = await db
			.select({
				userId: enpProfiles.userId,
				joinedAt: enpProfiles.createdAt,
				userName: users.name,
				userEmail: users.email,
			})
			.from(enpProfiles)
			.innerJoin(users, eq(enpProfiles.userId, users.id))
			.where(and(eq(enpProfiles.subOrgId, subOrgId), isNull(users.deletedAt)))

		const clientRows = await db
			.select({
				userId: clientProfiles.userId,
				joinedAt: clientProfiles.createdAt,
				userName: users.name,
				userEmail: users.email,
			})
			.from(clientProfiles)
			.innerJoin(users, eq(clientProfiles.userId, users.id))
			.where(and(eq(clientProfiles.subOrgId, subOrgId), isNull(users.deletedAt)))

		const byUser = new Map<
			string,
			{
				userId: string
				joinedAt: Date
				userName: string
				userEmail: string
				source: "enp" | "client"
			}
		>()

		for (const r of enpRows) {
			byUser.set(r.userId, { ...r, source: "enp" })
		}
		for (const r of clientRows) {
			if (!byUser.has(r.userId)) byUser.set(r.userId, { ...r, source: "client" })
		}

		if (!byUser.has(org.ownerId)) {
			const [owner] = await db
				.select({ userName: users.name, userEmail: users.email, createdAt: users.createdAt })
				.from(users)
				.where(eq(users.id, org.ownerId))
				.limit(1)
			if (owner) {
				byUser.set(org.ownerId, {
					userId: org.ownerId,
					joinedAt: owner.createdAt,
					userName: owner.userName,
					userEmail: owner.userEmail,
					source: "enp",
				})
			}
		}

		return [...byUser.values()].map(m => ({
			id: `mem:${subOrgId}:${m.userId}`,
			userId: m.userId,
			subOrgId,
			userName: m.userName,
			userEmail: m.userEmail,
			role: m.userId === org.ownerId ? ("admin" as const) : ("member" as const),
			joinedAt: m.joinedAt.toISOString(),
		}))
	}

	private async memberCount(row: typeof subOrgs.$inferSelect): Promise<number> {
		const enpIds = await db
			.select({ userId: enpProfiles.userId })
			.from(enpProfiles)
			.where(eq(enpProfiles.subOrgId, row.id))
		const clientIds = await db
			.select({ userId: clientProfiles.userId })
			.from(clientProfiles)
			.where(eq(clientProfiles.subOrgId, row.id))
		const ids = new Set([...enpIds.map(r => r.userId), ...clientIds.map(r => r.userId)])
		ids.add(row.ownerId)
		return ids.size
	}

	private async ownerDisplayName(ownerId: string): Promise<string> {
		const [owner] = await db
			.select({ name: users.name })
			.from(users)
			.where(eq(users.id, ownerId))
			.limit(1)
		return owner?.name ?? "Unknown"
	}

	private async toSubOrgDto(row: typeof subOrgs.$inferSelect): Promise<SubOrgDto> {
		const count = await this.memberCount(row)
		const ownerName = await this.ownerDisplayName(row.ownerId)
		return {
			id: row.id,
			name: row.name,
			slug: slugify(row.name, row.id),
			description: null,
			logoUrl: null,
			kind: row.kind,
			ownerName,
			memberCount: count,
			isActive: row.deletedAt === null,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		}
	}
}
