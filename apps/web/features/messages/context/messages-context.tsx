"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import { authClient } from "@/services/better-auth/auth-client"
import { orpc } from "@/services/orpc/client"
import {
	emitQlegalClientEvent,
	ensureQlegalSocketConnected,
	subscribeQlegalEvent,
} from "@/services/ws/ws-client"
import {
	DM_MESSAGE_MAX_LENGTH,
	flattenMessagePages,
	useConversationMessagesQuery,
	useConversationsQuery,
	useMarkConversationReadMutation,
	useOpenDmConversationMutation,
	useSendMessageMutation,
	type Conversation,
	type Message,
} from "@/features/messages/api/messages.hooks"

type MessagesContextValue = {
	loadingConversations: boolean
	loadingMessages: boolean
	loadingOlderMessages: boolean
	hasOlderMessages: boolean
	conversations: Conversation[]
	thread: Message[]
	selectedId: string
	selectedConversation: Conversation | undefined
	draft: string
	userId: string
	isSending: boolean
	isOpeningConversation: boolean
	isPeerTyping: boolean
	typingParticipantName: string | null
	setSelectedId: React.Dispatch<React.SetStateAction<string>>
	setDraft: React.Dispatch<React.SetStateAction<string>>
	clearSelectedConversation: () => void
	setTyping: (isTyping: boolean) => void
	loadOlderMessages: () => void
	sendMessage: () => void
	startConversationWithPeer: (
		peerUserId: string,
		existingConversationId?: string | null
	) => Promise<{ ok: boolean; message?: string }>
}

const MessagesContext = React.createContext<MessagesContextValue | null>(null)

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
const api = orpc as any

export function MessagesProvider({ children }: { children: React.ReactNode }) {
	const queryClient = useQueryClient()
	const { data: session } = authClient.useSession()
	const userId = session?.user?.id ?? ""

	const listQuery = useConversationsQuery()
	const conversations = React.useMemo(
		() => (listQuery.data as Conversation[] | undefined) ?? [],
		[listQuery.data]
	)
	const [selectedId, setSelectedId] = React.useState("")
	const [draft, setDraft] = React.useState("")

	const messagesQuery = useConversationMessagesQuery(selectedId || null)
	const thread = React.useMemo(() => flattenMessagePages(messagesQuery.data), [messagesQuery.data])
	const hasOlderMessages = messagesQuery.hasNextPage ?? false
	const loadingOlderMessages = messagesQuery.isFetchingNextPage

	const send = useSendMessageMutation()
	const markRead = useMarkConversationReadMutation()
	const openConversation = useOpenDmConversationMutation()
	const markReadRef = React.useRef(markRead)
	React.useEffect(() => {
		markReadRef.current = markRead
	}, [markRead])
	const [typingByConversation, setTypingByConversation] = React.useState<
		Record<string, { senderUserId: string; isTyping: boolean }>
	>({})
	const typingTimeoutsRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({})

	React.useEffect(() => {
		if (!selectedId && conversations[0]) {
			if (typeof window === "undefined" || window.matchMedia("(min-width: 768px)").matches) {
				setSelectedId(conversations[0].id)
			}
		}
	}, [conversations, selectedId])

	React.useEffect(() => {
		ensureQlegalSocketConnected()

		const offMessage = subscribeQlegalEvent("dm:message", () => {
			void queryClient.invalidateQueries({ queryKey: api.message.getMessages.key() })
			void queryClient.invalidateQueries({ queryKey: api.message.listConversations.key() })
		})
		const offConversation = subscribeQlegalEvent("dm:conversation-updated", () => {
			void queryClient.invalidateQueries({ queryKey: api.message.listConversations.key() })
		})
		const offRead = subscribeQlegalEvent("dm:read", () => {
			void queryClient.invalidateQueries({ queryKey: api.message.getMessages.key() })
			void queryClient.invalidateQueries({ queryKey: api.message.listConversations.key() })
		})
		const offTyping = subscribeQlegalEvent("dm:typing", payload => {
			if (!payload.conversationId || payload.senderUserId === userId) return

			setTypingByConversation(prev => ({
				...prev,
				[payload.conversationId]: {
					senderUserId: payload.senderUserId,
					isTyping: payload.isTyping,
				},
			}))

			if (typingTimeoutsRef.current[payload.conversationId]) {
				clearTimeout(typingTimeoutsRef.current[payload.conversationId])
			}

			if (payload.isTyping) {
				typingTimeoutsRef.current[payload.conversationId] = setTimeout(() => {
					setTypingByConversation(prev => ({
						...prev,
						[payload.conversationId]: {
							senderUserId: payload.senderUserId,
							isTyping: false,
						},
					}))
				}, 2500)
			}
		})

		return () => {
			offMessage()
			offConversation()
			offRead()
			offTyping()

			for (const timeout of Object.values(typingTimeoutsRef.current)) {
				clearTimeout(timeout)
			}
			typingTimeoutsRef.current = {}
		}
	}, [queryClient, userId])

	React.useEffect(() => {
		if (!selectedId || !userId) return

		ensureQlegalSocketConnected()
		emitQlegalClientEvent("join-dm", { conversationId: selectedId })
		markReadRef.current.mutate(selectedId)

		return () => {
			emitQlegalClientEvent("leave-dm", { conversationId: selectedId })
		}
	}, [selectedId, userId])

	const selectedConversation = React.useMemo(
		() => conversations.find(conversation => conversation.id === selectedId),
		[conversations, selectedId]
	)

	const sendMessage = React.useCallback(() => {
		const text = draft.trim()
		if (!text || !selectedId) return
		if (text.length > DM_MESSAGE_MAX_LENGTH) return

		send.mutate(
			{ conversationId: selectedId, content: text, type: "text" },
			{
				onSettled: () => setDraft(""),
			}
		)
	}, [draft, selectedId, send])

	const loadOlderMessages = React.useCallback(() => {
		if (!hasOlderMessages || loadingOlderMessages) return
		void messagesQuery.fetchNextPage()
	}, [hasOlderMessages, loadingOlderMessages, messagesQuery])

	const clearSelectedConversation = React.useCallback(() => {
		setSelectedId("")
	}, [])

	const startConversationWithPeer = React.useCallback(
		async (
			peerUserId: string,
			_existingConversationId?: string | null
		): Promise<{ ok: boolean; message?: string }> => {
			if (!peerUserId) return { ok: false, message: "Invalid user selected." }

			try {
				const conversation = await openConversation.mutateAsync(peerUserId)
				setSelectedId(conversation.id)
				return { ok: true }
			} catch {
				return { ok: false, message: "Could not start the conversation. Please try again." }
			}
		},
		[openConversation]
	)

	const setTyping = React.useCallback(
		(isTyping: boolean) => {
			if (!selectedId) return
			emitQlegalClientEvent("dm:typing", { conversationId: selectedId, isTyping })
		},
		[selectedId]
	)

	const isPeerTyping = selectedId ? (typingByConversation[selectedId]?.isTyping ?? false) : false
	const typingParticipantName = isPeerTyping
		? selectedConversation
			? (selectedConversation.participantNames[
					selectedConversation.participantIds.findIndex(id => id !== userId)
				] ?? "Someone")
			: "Someone"
		: null

	const value = React.useMemo<MessagesContextValue>(
		() => ({
			loadingConversations: listQuery.isLoading,
			loadingMessages: messagesQuery.isLoading,
			loadingOlderMessages,
			hasOlderMessages,
			conversations,
			thread,
			selectedId,
			selectedConversation,
			draft,
			userId,
			isSending: send.isPending,
			isOpeningConversation: openConversation.isPending,
			isPeerTyping,
			typingParticipantName,
			setSelectedId,
			setDraft,
			clearSelectedConversation,
			setTyping,
			loadOlderMessages,
			sendMessage,
			startConversationWithPeer,
		}),
		[
			listQuery.isLoading,
			messagesQuery.isLoading,
			loadingOlderMessages,
			hasOlderMessages,
			conversations,
			thread,
			selectedId,
			selectedConversation,
			draft,
			userId,
			send.isPending,
			openConversation.isPending,
			isPeerTyping,
			typingParticipantName,
			clearSelectedConversation,
			setTyping,
			loadOlderMessages,
			sendMessage,
			startConversationWithPeer,
		]
	)

	return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>
}

export function useMessagesContext() {
	const context = React.useContext(MessagesContext)
	if (!context) {
		throw new Error("useMessagesContext must be used within MessagesProvider")
	}
	return context
}
