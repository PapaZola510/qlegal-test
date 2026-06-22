import { z } from "zod"

import { MessageTypeEnum } from "../shared/enums.js"
import { TimestampFields } from "../shared/schemas.js"

/** Max characters for a single DM text body (API + DB). */
export const DM_MESSAGE_MAX_LENGTH = 4000

/** Default page size when loading a conversation thread. */
export const DM_MESSAGES_DEFAULT_PAGE_SIZE = 50

export const ConversationSchema = z.object({
	id: z.string(),
	participantIds: z.array(z.string()),
	participantNames: z.array(z.string()),
	participantVerified: z.array(z.boolean()),
	lastMessagePreview: z.string().nullable(),
	lastMessageAt: z.string().nullable(),
	unreadCount: z.number().int(),
	...TimestampFields,
})

export const MessageSchema = z.object({
	id: z.string(),
	conversationId: z.string(),
	senderId: z.string(),
	senderName: z.string(),
	type: MessageTypeEnum,
	content: z.string(),
	fileUrl: z.string().nullable(),
	isRead: z.boolean(),
	...TimestampFields,
})

export const SendMessageSchema = z.object({
	conversationId: z.string(),
	content: z.string().min(1).max(DM_MESSAGE_MAX_LENGTH),
	type: MessageTypeEnum.default("text"),
	fileUrl: z.string().url().optional(),
})

export const ConversationIdSchema = z.object({
	id: z.coerce.string(),
})

export const GetMessagesInputSchema = ConversationIdSchema.extend({
	limit: z.coerce.number().int().min(1).max(100).default(DM_MESSAGES_DEFAULT_PAGE_SIZE),
	/** Message id cursor — returns older messages before this one. */
	before: z.string().min(1).optional(),
})

export const MessageListResponseSchema = z.object({
	items: z.array(MessageSchema),
	hasMore: z.boolean(),
	nextCursor: z.string().nullable(),
})

export const OpenDmConversationSchema = z.object({
	peerUserId: z.string().min(1),
})

export const SearchDmPeersSchema = z.object({
	query: z.string().min(1).max(80),
})

export const ResolveDmPeerByEmailSchema = z.object({
	email: z.string().email(),
})

export const DmPeerSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string().email(),
	isVerified: z.boolean(),
	existingConversationId: z.string().nullable(),
})

export const DmPeerIdSchema = z.object({
	peerUserId: z.string().min(1),
})

export const DmPeerProfileSchema = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string().email(),
	image: z.string().nullable(),
	role: z.enum(["ENP", "Client", "Admin", "User"]),
	isVerified: z.boolean(),
	bio: z.string().nullable(),
	joinedAt: z.string(),
})

export type Conversation = z.infer<typeof ConversationSchema>
export type Message = z.infer<typeof MessageSchema>
export type MessageListResponse = z.infer<typeof MessageListResponseSchema>
export type GetMessagesInput = z.infer<typeof GetMessagesInputSchema>
export type SendMessage = z.infer<typeof SendMessageSchema>
export type DmPeer = z.infer<typeof DmPeerSchema>
export type DmPeerProfile = z.infer<typeof DmPeerProfileSchema>
export type SearchDmPeersInput = z.infer<typeof SearchDmPeersSchema>
