import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
	type InfiniteData,
} from "@tanstack/react-query"

import {
	DM_MESSAGE_MAX_LENGTH,
	DM_MESSAGES_DEFAULT_PAGE_SIZE,
	type Conversation,
	type DmPeer,
	type DmPeerProfile,
	type Message,
	type MessageListResponse,
} from "@repo/contracts"

import { orpc, orpcClient } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client vs NestedClient inference gap
const api = orpc as any

export { DM_MESSAGE_MAX_LENGTH, DM_MESSAGES_DEFAULT_PAGE_SIZE }

export function flattenMessagePages(
	data: InfiniteData<MessageListResponse> | undefined
): Message[] {
	if (!data) return []
	return [...data.pages].reverse().flatMap(page => page.items)
}

export function useConversationsQuery() {
	return useQuery(
		api.message.listConversations.queryOptions({
			staleTime: 30 * 1000,
		})
	)
}

export function useConversationMessagesQuery(conversationId: string | null) {
	return useInfiniteQuery({
		queryKey: [...api.message.getMessages.key(), { id: conversationId ?? "__none__" }],
		queryFn: async ({ pageParam }) =>
			(orpcClient as any).message.getMessages({
				id: conversationId,
				limit: DM_MESSAGES_DEFAULT_PAGE_SIZE,
				...(pageParam ? { before: pageParam } : {}),
			}) as Promise<MessageListResponse>,
		initialPageParam: null as string | null,
		getNextPageParam: lastPage => (lastPage.hasMore ? lastPage.nextCursor : undefined),
		enabled: Boolean(conversationId),
		staleTime: 15 * 1000,
	})
}

export function useSendMessageMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: {
			conversationId: string
			content: string
			type?: "text" | "file"
		}) =>
			(orpcClient as any).message.send({
				...input,
				type: input.type ?? "text",
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.message.getMessages.key() })
			await queryClient.invalidateQueries({ queryKey: api.message.listConversations.key() })
		},
	})
}

export function useMarkConversationReadMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (conversationId: string) =>
			(orpcClient as any).message.markRead({ id: conversationId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.message.listConversations.key() })
		},
	})
}

export function useOpenDmConversationMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (peerUserId: string) =>
			(orpcClient as any).message.openConversation({ peerUserId }) as Promise<Conversation>,
		onSuccess: async conversation => {
			queryClient.setQueryData(
				api.message.listConversations.key(),
				(old: Conversation[] | undefined) => {
					if (!old) return [conversation]
					if (old.some(item => item.id === conversation.id)) return old
					return [conversation, ...old]
				}
			)
			await queryClient.invalidateQueries({ queryKey: api.message.listConversations.key() })
		},
	})
}

export function useResolveDmPeerByEmailMutation() {
	return useMutation({
		mutationFn: async (email: string) =>
			(orpcClient as any).message.resolvePeerByEmail({
				email: email.trim().toLowerCase(),
			}) as DmPeer | null,
	})
}

export function useSearchDmPeersQuery(query: string) {
	const normalized = query.trim()
	return useQuery({
		...api.message.searchPeers.queryOptions({ input: { query: normalized } }),
		enabled: normalized.length >= 2,
		staleTime: 20 * 1000,
	})
}

export function useDmPeerProfileQuery(peerUserId: string | null | undefined) {
	return useQuery({
		...api.message.getPeerProfile.queryOptions({ input: { peerUserId: peerUserId ?? "__none__" } }),
		enabled: Boolean(peerUserId),
		staleTime: 60 * 1000,
	})
}

export function getPeerName(conversation: Conversation, currentUserId: string): string {
	const idx = conversation.participantIds.findIndex(id => id !== currentUserId)
	const i = idx >= 0 ? idx : 0
	return conversation.participantNames[i] ?? "Conversation"
}

export function getPeerVerified(conversation: Conversation, currentUserId: string): boolean {
	const idx = conversation.participantIds.findIndex(id => id !== currentUserId)
	const i = idx >= 0 ? idx : 0
	return conversation.participantVerified[i] ?? false
}

export type { Conversation, DmPeer, DmPeerProfile, Message, MessageListResponse }
