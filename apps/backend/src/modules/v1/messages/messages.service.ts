import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { ORPCError } from "@orpc/server"
import { and, count, desc, eq, gt, ilike, inArray, isNull, lt, ne, or, sql } from "drizzle-orm"

import { DM_MESSAGES_DEFAULT_PAGE_SIZE } from "@repo/contracts"
import { clientProfiles, dmConversations, dmMessages, enpProfiles, users } from "@repo/db/schema"

import { db } from "@/common/database/database.client"

import { EventsService } from "../events/events.service"

function sortedUserPair(a: string, b: string): [string, string] {
	return a < b ? [a, b] : [b, a]
}

function convKeyFor(a: string, b: string): string {
	const [l, h] = sortedUserPair(a, b)
	return `${l}:${h}`
}

@Injectable()
export class MessagesService {
	constructor(private readonly events: EventsService) {}

	private async unreadCountFor(
		conversationId: string,
		viewerUserId: string,
		conv: typeof dmConversations.$inferSelect
	): Promise<number> {
		const lastReadAt =
			viewerUserId === conv.lowUserId ? conv.lowUserLastReadAt : conv.highUserLastReadAt
		const since = lastReadAt ?? new Date(0)
		const [row] = await db
			.select({ n: count() })
			.from(dmMessages)
			.where(
				and(
					eq(dmMessages.conversationId, conversationId),
					ne(dmMessages.senderUserId, viewerUserId),
					gt(dmMessages.createdAt, since)
				)
			)
		return Number(row?.n ?? 0)
	}

	private async mapConversation(
		conv: typeof dmConversations.$inferSelect,
		viewerUserId: string,
		names: Map<string, string>,
		verifiedByUserId: Map<string, boolean>
	): Promise<{
		id: string
		participantIds: string[]
		participantNames: string[]
		participantVerified: boolean[]
		lastMessagePreview: string | null
		lastMessageAt: string | null
		unreadCount: number
		createdAt: string
		updatedAt: string
	}> {
		const peerId = viewerUserId === conv.lowUserId ? conv.highUserId : conv.lowUserId
		const unreadCount = await this.unreadCountFor(conv.id, viewerUserId, conv)
		return {
			id: conv.id,
			participantIds: [conv.lowUserId, conv.highUserId],
			participantNames: [names.get(conv.lowUserId) ?? "User", names.get(conv.highUserId) ?? "User"],
			participantVerified: [
				verifiedByUserId.get(conv.lowUserId) ?? false,
				verifiedByUserId.get(conv.highUserId) ?? false,
			],
			lastMessagePreview: conv.lastMessagePreview ?? null,
			lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
			unreadCount,
			createdAt: conv.createdAt.toISOString(),
			updatedAt: conv.updatedAt.toISOString(),
		}
	}

	private async getUsersMeta(userIds: string[]) {
		if (userIds.length === 0) {
			return {
				namesByUserId: new Map<string, string>(),
				verifiedByUserId: new Map<string, boolean>(),
			}
		}

		const rows = await db
			.select({
				id: users.id,
				name: users.name,
				emailVerified: users.emailVerified,
				clientIdentityStatus: clientProfiles.identityStatus,
				enpIdentityStatus: enpProfiles.identityStatus,
				enpCertificateStatus: enpProfiles.certificateStatus,
			})
			.from(users)
			.leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
			.leftJoin(enpProfiles, eq(enpProfiles.userId, users.id))
			.where(inArray(users.id, userIds))

		const namesByUserId = new Map(rows.map(row => [row.id, row.name]))
		const verifiedByUserId = new Map(
			rows.map(row => [
				row.id,
				Boolean(row.clientIdentityStatus === "verified" || row.enpIdentityStatus === "verified"),
			])
		)

		return { namesByUserId, verifiedByUserId }
	}

	async listConversations(viewerUserId: string) {
		const rows = await db
			.select()
			.from(dmConversations)
			.where(
				or(
					eq(dmConversations.lowUserId, viewerUserId),
					eq(dmConversations.highUserId, viewerUserId)
				)
			)
			.orderBy(desc(dmConversations.lastMessageAt), desc(dmConversations.updatedAt))

		const userIds = new Set<string>()
		for (const r of rows) {
			userIds.add(r.lowUserId)
			userIds.add(r.highUserId)
		}
		const { namesByUserId, verifiedByUserId } = await this.getUsersMeta([...userIds])

		return Promise.all(
			rows.map(row => this.mapConversation(row, viewerUserId, namesByUserId, verifiedByUserId))
		)
	}

	async getMessages(
		viewerUserId: string,
		conversationId: string,
		options: { limit?: number; before?: string } = {}
	) {
		const [conv] = await db
			.select()
			.from(dmConversations)
			.where(eq(dmConversations.id, conversationId))
			.limit(1)
		if (!conv) throw new NotFoundException(`Conversation ${conversationId} not found`)
		if (conv.lowUserId !== viewerUserId && conv.highUserId !== viewerUserId) {
			throw new ForbiddenException("You are not a participant in this conversation")
		}

		const limit = Math.min(options.limit ?? DM_MESSAGES_DEFAULT_PAGE_SIZE, 100)
		let beforeCreatedAt: Date | null = null
		let beforeId: string | null = null

		if (options.before) {
			const [cursor] = await db
				.select({ createdAt: dmMessages.createdAt, id: dmMessages.id })
				.from(dmMessages)
				.where(
					and(eq(dmMessages.id, options.before), eq(dmMessages.conversationId, conversationId))
				)
				.limit(1)
			if (cursor) {
				beforeCreatedAt = cursor.createdAt
				beforeId = cursor.id
			}
		}

		const whereParts = [eq(dmMessages.conversationId, conversationId)]
		if (beforeCreatedAt && beforeId) {
			whereParts.push(
				or(
					lt(dmMessages.createdAt, beforeCreatedAt),
					and(eq(dmMessages.createdAt, beforeCreatedAt), lt(dmMessages.id, beforeId))
				)!
			)
		}

		const rows = await db
			.select()
			.from(dmMessages)
			.where(and(...whereParts))
			.orderBy(desc(dmMessages.createdAt), desc(dmMessages.id))
			.limit(limit + 1)

		const hasMore = rows.length > limit
		const pageRows = hasMore ? rows.slice(0, limit) : rows
		const chronological = [...pageRows].reverse()

		const senderIds = [...new Set(chronological.map(m => m.senderUserId))]
		const senders =
			senderIds.length === 0
				? []
				: await db
						.select({ id: users.id, name: users.name })
						.from(users)
						.where(inArray(users.id, senderIds))
		const senderNames = new Map(senders.map(s => [s.id, s.name]))

		const myReadThrough =
			(viewerUserId === conv.lowUserId ? conv.lowUserLastReadAt : conv.highUserLastReadAt) ??
			new Date(0)
		const peerReadThrough =
			(viewerUserId === conv.lowUserId ? conv.highUserLastReadAt : conv.lowUserLastReadAt) ??
			new Date(0)

		const items = chronological.map(m => ({
			id: m.id,
			conversationId,
			senderId: m.senderUserId,
			senderName: senderNames.get(m.senderUserId) ?? "User",
			type: m.type,
			content: m.content,
			fileUrl: m.fileUrl ?? null,
			isRead:
				m.senderUserId === viewerUserId
					? m.createdAt <= peerReadThrough
					: m.createdAt <= myReadThrough,
			createdAt: m.createdAt.toISOString(),
			updatedAt: m.createdAt.toISOString(),
		}))

		return {
			items,
			hasMore,
			nextCursor: hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null,
		}
	}

	async openConversation(viewerUserId: string, peerUserId: string) {
		if (viewerUserId === peerUserId) {
			throw new ORPCError("BAD_REQUEST", { message: "Cannot open a conversation with yourself" })
		}
		const [peer] = await db
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.id, peerUserId), isNull(users.deletedAt)))
			.limit(1)
		if (!peer) throw new NotFoundException("Peer user not found")

		const key = convKeyFor(viewerUserId, peerUserId)
		const [existing] = await db
			.select()
			.from(dmConversations)
			.where(eq(dmConversations.convKey, key))
			.limit(1)
		const now = new Date()
		let conv = existing
		if (!conv) {
			const [low, high] = sortedUserPair(viewerUserId, peerUserId)
			const [inserted] = await db
				.insert(dmConversations)
				.values({
					convKey: key,
					lowUserId: low,
					highUserId: high,
					createdAt: now,
					updatedAt: now,
				})
				.returning()
			conv = inserted!
		}

		const { namesByUserId, verifiedByUserId } = await this.getUsersMeta([
			conv.lowUserId,
			conv.highUserId,
		])
		return this.mapConversation(conv, viewerUserId, namesByUserId, verifiedByUserId)
	}

	async resolvePeerByEmail(viewerUserId: string, email: string) {
		const normalized = email.trim().toLowerCase()
		if (!normalized) return null

		const [peer] = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				emailVerified: users.emailVerified,
				clientIdentityStatus: clientProfiles.identityStatus,
				enpIdentityStatus: enpProfiles.identityStatus,
				enpCertificateStatus: enpProfiles.certificateStatus,
			})
			.from(users)
			.leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
			.leftJoin(enpProfiles, eq(enpProfiles.userId, users.id))
			.where(
				and(
					sql`lower(${users.email}) = ${normalized}`,
					isNull(users.deletedAt),
					ne(users.id, viewerUserId)
				)
			)
			.limit(1)

		if (!peer) return null

		const [existingConversation] = await db
			.select({ id: dmConversations.id })
			.from(dmConversations)
			.where(eq(dmConversations.convKey, convKeyFor(viewerUserId, peer.id)))
			.limit(1)

		return {
			id: peer.id,
			name: peer.name,
			email: peer.email,
			isVerified: Boolean(
				peer.clientIdentityStatus === "verified" || peer.enpIdentityStatus === "verified"
			),
			existingConversationId: existingConversation?.id ?? null,
		}
	}

	async searchPeers(viewerUserId: string, query: string) {
		const normalized = query.trim()
		if (!normalized) return []

		const pattern = `%${normalized}%`
		const emailPattern = `%${normalized.toLowerCase()}%`

		const peers = await db
			.selectDistinct({
				id: users.id,
				name: users.name,
				email: users.email,
				emailVerified: users.emailVerified,
				clientIdentityStatus: clientProfiles.identityStatus,
				enpIdentityStatus: enpProfiles.identityStatus,
				enpCertificateStatus: enpProfiles.certificateStatus,
			})
			.from(users)
			.leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
			.leftJoin(enpProfiles, eq(enpProfiles.userId, users.id))
			.where(
				and(
					isNull(users.deletedAt),
					ne(users.id, viewerUserId),
					or(
						ilike(users.name, pattern),
						ilike(users.email, emailPattern),
						ilike(clientProfiles.firstName, pattern),
						ilike(clientProfiles.lastName, pattern),
						ilike(enpProfiles.firstName, pattern),
						ilike(enpProfiles.lastName, pattern),
						sql`concat(${clientProfiles.firstName}, ' ', ${clientProfiles.lastName}) ilike ${pattern}`,
						sql`concat(${enpProfiles.firstName}, ' ', ${enpProfiles.lastName}) ilike ${pattern}`
					)
				)
			)
			.orderBy(users.name)
			.limit(8)

		if (peers.length === 0) return []

		const keys = peers.map(peer => convKeyFor(viewerUserId, peer.id))
		const existingConversations = await db
			.select({ id: dmConversations.id, key: dmConversations.convKey })
			.from(dmConversations)
			.where(inArray(dmConversations.convKey, keys))

		const conversationByKey = new Map(existingConversations.map(row => [row.key, row.id]))

		return peers.map(peer => ({
			id: peer.id,
			name: peer.name,
			email: peer.email,
			isVerified: Boolean(
				peer.clientIdentityStatus === "verified" || peer.enpIdentityStatus === "verified"
			),
			existingConversationId: conversationByKey.get(convKeyFor(viewerUserId, peer.id)) ?? null,
		}))
	}

	async getPeerProfile(viewerUserId: string, peerUserId: string) {
		if (peerUserId === viewerUserId) return null

		const [peer] = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				image: users.image,
				platformRole: users.platformRole,
				emailVerified: users.emailVerified,
				createdAt: users.createdAt,
				hasClientProfile: clientProfiles.userId,
				hasEnpProfile: enpProfiles.userId,
				clientIdentityStatus: clientProfiles.identityStatus,
				enpIdentityStatus: enpProfiles.identityStatus,
				enpCertificateStatus: enpProfiles.certificateStatus,
			})
			.from(users)
			.leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
			.leftJoin(enpProfiles, eq(enpProfiles.userId, users.id))
			.where(and(eq(users.id, peerUserId), isNull(users.deletedAt)))
			.limit(1)

		if (!peer) return null

		const role: "ENP" | "Client" | "Admin" | "User" =
			peer.platformRole === "admin" || peer.platformRole === "sub_org_admin"
				? "Admin"
				: peer.hasEnpProfile
					? "ENP"
					: peer.hasClientProfile
						? "Client"
						: "User"

		return {
			id: peer.id,
			name: peer.name,
			email: peer.email,
			image: peer.image ?? null,
			role,
			isVerified: Boolean(
				peer.clientIdentityStatus === "verified" || peer.enpIdentityStatus === "verified"
			),
			bio: null,
			joinedAt: peer.createdAt.toISOString(),
		}
	}

	async sendMessage(
		senderUserId: string,
		data: { conversationId: string; content: string; type?: string; fileUrl?: string }
	) {
		const [conv] = await db
			.select()
			.from(dmConversations)
			.where(eq(dmConversations.id, data.conversationId))
			.limit(1)
		if (!conv) throw new NotFoundException(`Conversation ${data.conversationId} not found`)
		if (conv.lowUserId !== senderUserId && conv.highUserId !== senderUserId) {
			throw new ForbiddenException("You are not a participant in this conversation")
		}

		const now = new Date()
		const msgType = (data.type ?? "text") as "text" | "file" | "system" | "notification"
		const [inserted] = await db
			.insert(dmMessages)
			.values({
				conversationId: data.conversationId,
				senderUserId,
				type: msgType,
				content: data.content,
				fileUrl: data.fileUrl ?? null,
				createdAt: now,
			})
			.returning()
		const m = inserted!

		const preview = data.content.length > 100 ? `${data.content.slice(0, 100)}…` : data.content
		await db
			.update(dmConversations)
			.set({
				lastMessagePreview: preview,
				lastMessageAt: now,
				updatedAt: now,
			})
			.where(eq(dmConversations.id, data.conversationId))

		const [sender] = await db
			.select({ name: users.name })
			.from(users)
			.where(eq(users.id, senderUserId))
			.limit(1)
		const dto = {
			id: m.id,
			conversationId: data.conversationId,
			senderId: senderUserId,
			senderName: sender?.name ?? "User",
			type: m.type,
			content: m.content,
			fileUrl: m.fileUrl ?? null,
			isRead: false,
			createdAt: m.createdAt.toISOString(),
			updatedAt: m.createdAt.toISOString(),
		}

		this.events.emitToDm(data.conversationId, "dm:message", dto)
		const peerId = senderUserId === conv.lowUserId ? conv.highUserId : conv.lowUserId
		this.events.emitToUser(peerId, "dm:conversation-updated", {
			conversationId: data.conversationId,
			lastMessagePreview: preview,
			lastMessageAt: now.toISOString(),
		})
		this.events.emitToUser(senderUserId, "dm:conversation-updated", {
			conversationId: data.conversationId,
			lastMessagePreview: preview,
			lastMessageAt: now.toISOString(),
		})

		return dto
	}

	async markRead(viewerUserId: string, conversationId: string) {
		const [conv] = await db
			.select()
			.from(dmConversations)
			.where(eq(dmConversations.id, conversationId))
			.limit(1)
		if (!conv) throw new NotFoundException(`Conversation ${conversationId} not found`)
		if (conv.lowUserId !== viewerUserId && conv.highUserId !== viewerUserId) {
			throw new ForbiddenException("You are not a participant in this conversation")
		}
		const now = new Date()
		const patch =
			viewerUserId === conv.lowUserId
				? { lowUserLastReadAt: now, updatedAt: now }
				: { highUserLastReadAt: now, updatedAt: now }
		await db.update(dmConversations).set(patch).where(eq(dmConversations.id, conversationId))

		this.events.emitToDm(conversationId, "dm:read", {
			conversationId,
			readerUserId: viewerUserId,
			readAt: now.toISOString(),
		})
		const peerId = viewerUserId === conv.lowUserId ? conv.highUserId : conv.lowUserId
		this.events.emitToUser(peerId, "dm:read", {
			conversationId,
			readerUserId: viewerUserId,
			readAt: now.toISOString(),
		})

		return { ok: true as const }
	}
}
