import { oc } from "@orpc/contract"
import { z } from "zod"

import {
	ConversationIdSchema,
	ConversationSchema,
	DmPeerIdSchema,
	DmPeerProfileSchema,
	DmPeerSchema,
	GetMessagesInputSchema,
	MessageListResponseSchema,
	MessageSchema,
	OpenDmConversationSchema,
	ResolveDmPeerByEmailSchema,
	SearchDmPeersSchema,
	SendMessageSchema,
} from "./messages.schema.js"

export const messagesContract = {
	listConversations: oc
		.route({
			method: "GET",
			path: "/messages/conversations",
			summary: "List conversations",
			tags: ["Messages"],
		})
		.output(z.array(ConversationSchema)),

	getMessages: oc
		.route({
			method: "GET",
			path: "/messages/conversations/{id}",
			summary:
				"Get paginated messages for a conversation (newest page first; use before for older)",
			tags: ["Messages"],
		})
		.input(GetMessagesInputSchema)
		.output(MessageListResponseSchema),

	send: oc
		.route({
			method: "POST",
			path: "/messages",
			summary: "Send a message",
			tags: ["Messages"],
		})
		.input(SendMessageSchema)
		.output(MessageSchema),

	openConversation: oc
		.route({
			method: "POST",
			path: "/messages/conversations/open",
			summary: "Get or create a DM conversation with another user",
			tags: ["Messages"],
		})
		.input(OpenDmConversationSchema)
		.output(ConversationSchema),

	resolvePeerByEmail: oc
		.route({
			method: "POST",
			path: "/messages/peers/resolve",
			summary: "Resolve a DM peer by email",
			tags: ["Messages"],
		})
		.input(ResolveDmPeerByEmailSchema)
		.output(DmPeerSchema.nullable()),

	searchPeers: oc
		.route({
			method: "POST",
			path: "/messages/peers/search",
			summary: "Search DM peers by name or email",
			tags: ["Messages"],
		})
		.input(SearchDmPeersSchema)
		.output(z.array(DmPeerSchema)),

	getPeerProfile: oc
		.route({
			method: "POST",
			path: "/messages/peers/profile",
			summary: "Get the public profile for a DM peer",
			tags: ["Messages"],
		})
		.input(DmPeerIdSchema)
		.output(DmPeerProfileSchema.nullable()),

	markRead: oc
		.route({
			method: "POST",
			path: "/messages/conversations/{id}/read",
			summary: "Mark a DM conversation as read for the current user",
			tags: ["Messages"],
		})
		.input(ConversationIdSchema)
		.output(z.object({ ok: z.literal(true) })),
}
