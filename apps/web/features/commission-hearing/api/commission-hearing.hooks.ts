"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
	CommissionHearing,
	CommissionHearingChatMessage,
	CommissionHearingId,
	CommissionHearingJoinToken,
	CommissionHearingJoinTokenInput,
	CommissionHearingLobbyCheckInput,
	CommissionHearingLobbyCheckResult,
	CommissionHearingOpposition,
	CommissionHearingPaymentStatus,
	DecideCommissionHearingOpposition,
	EnpCommissionApplication,
	FileCommissionHearingOpposition,
	InviteCommissionApplicant,
	InviteCommissionApplicantResult,
	SendCommissionHearingChat,
} from "@repo/contracts"

import { orpc, orpcClient } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client vs NestedClient inference gap
const api = orpc as any

function invalidateCommissionHearing(
	queryClient: ReturnType<typeof useQueryClient>,
	hearingRoomId: string
) {
	void queryClient.invalidateQueries({
		queryKey: api.commissionHearing.get.key({ input: { id: hearingRoomId } }),
	})
	void queryClient.invalidateQueries({
		queryKey: api.commissionHearing.listForAdmin.key(),
	})
	void queryClient.invalidateQueries({
		queryKey: api.commissionHearing.listMine.key(),
	})
}

function invalidateCommissionOppositions(
	queryClient: ReturnType<typeof useQueryClient>,
	applicationId: string
) {
	void queryClient.invalidateQueries({
		queryKey: api.commissionHearing.listOppositions.key({
			input: { applicationId },
		}),
	})
}

export function useCommissionHearingQuery(id: string | null | undefined) {
	return useQuery<CommissionHearing>({
		...api.commissionHearing.get.queryOptions({
			input: { id: id ?? "__skip__" },
		}),
		enabled: Boolean(id),
		staleTime: 10 * 1000,
	})
}

export function useHearingApplicationQuery(applicationId: string | null | undefined) {
	return useQuery<EnpCommissionApplication>({
		...api.enpCommissionApplication.get.queryOptions({
			input: { id: applicationId ?? "__skip__" },
		}),
		enabled: Boolean(applicationId),
		staleTime: 30 * 1000,
	})
}

export function useCommissionOppositionsQuery(applicationId: string | null | undefined) {
	return useQuery<CommissionHearingOpposition[]>({
		...api.commissionHearing.listOppositions.queryOptions({
			input: { applicationId: applicationId ?? "__skip__" },
		}),
		enabled: Boolean(applicationId),
		staleTime: 15 * 1000,
	})
}

export function useAdminHearingQueueQuery() {
	return useQuery<CommissionHearing[]>({
		...api.commissionHearing.listForAdmin.queryOptions(),
		staleTime: 30 * 1000,
	})
}

export function useCommissionHearingLobbyCheckMutation() {
	return useMutation<CommissionHearingLobbyCheckResult, Error, CommissionHearingLobbyCheckInput>({
		...api.commissionHearing.lobbyCheck.mutationOptions(),
	})
}

export function useIssueHearingJoinTokenMutation() {
	return useMutation<CommissionHearingJoinToken, Error, CommissionHearingJoinTokenInput>({
		...api.commissionHearing.issueJoinToken.mutationOptions(),
	})
}

export function useOpenHearingMutation() {
	const queryClient = useQueryClient()

	return useMutation<CommissionHearing, Error, CommissionHearingId>({
		...api.commissionHearing.openSession.mutationOptions(),
		onSuccess: data => {
			invalidateCommissionHearing(queryClient, data.id)
		},
	})
}

export function useEndHearingMutation() {
	const queryClient = useQueryClient()

	return useMutation<CommissionHearing, Error, CommissionHearingId>({
		...api.commissionHearing.endSession.mutationOptions(),
		onSuccess: data => {
			invalidateCommissionHearing(queryClient, data.id)
		},
	})
}

export function useInviteApplicantMutation() {
	const queryClient = useQueryClient()

	return useMutation<InviteCommissionApplicantResult, Error, InviteCommissionApplicant>({
		...api.commissionHearing.inviteApplicant.mutationOptions(),
		onSuccess: (_data, variables) => {
			invalidateCommissionHearing(queryClient, variables.id)
		},
	})
}

export function useFileCommissionOppositionMutation() {
	const queryClient = useQueryClient()

	return useMutation<CommissionHearingOpposition, Error, FileCommissionHearingOpposition>({
		mutationFn: async input =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).commissionHearing.fileOpposition(
				input
			) as Promise<CommissionHearingOpposition>,
		onSuccess: (_data, variables) => {
			invalidateCommissionOppositions(queryClient, variables.applicationId)
		},
	})
}

export function useForwardCommissionOppositionMutation() {
	const queryClient = useQueryClient()

	return useMutation<CommissionHearingOpposition, Error, { id: string; oppositionId: string }>({
		mutationFn: async input =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).commissionHearing.forwardOpposition(
				input
			) as Promise<CommissionHearingOpposition>,
		onSuccess: data => {
			invalidateCommissionOppositions(queryClient, data.applicationId)
			if (data.hearingRoomId) invalidateCommissionHearing(queryClient, data.hearingRoomId)
		},
	})
}

export function useGrantOppositorAccessMutation() {
	const queryClient = useQueryClient()

	return useMutation<
		InviteCommissionApplicantResult,
		Error,
		{ id: string; oppositionId: string; applicationId: string }
	>({
		mutationFn: async ({ id, oppositionId }) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).commissionHearing.grantOppositorAccess({
				id,
				oppositionId,
			}) as Promise<InviteCommissionApplicantResult>,
		onSuccess: (_data, variables) => {
			invalidateCommissionOppositions(queryClient, variables.applicationId)
			invalidateCommissionHearing(queryClient, variables.id)
		},
	})
}

export function useMarkCommissionOppositionOutcomeMutation() {
	const queryClient = useQueryClient()

	return useMutation<
		CommissionHearingOpposition,
		Error,
		DecideCommissionHearingOpposition & { applicationId: string }
	>({
		mutationFn: async ({ applicationId: _applicationId, ...input }) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).commissionHearing.decideOpposition(
				input
			) as Promise<CommissionHearingOpposition>,
		onSuccess: (data, variables) => {
			invalidateCommissionOppositions(queryClient, variables.applicationId)
			if (data.hearingRoomId) invalidateCommissionHearing(queryClient, data.hearingRoomId)
		},
	})
}

export function useHearingChatQuery(id: string | null | undefined) {
	return useQuery<CommissionHearingChatMessage[]>({
		...api.commissionHearing.listChat.queryOptions({
			input: { id: id ?? "__skip__" },
		}),
		enabled: Boolean(id),
		staleTime: 5 * 1000,
	})
}

export function useCommissionHearingPaymentStatusQuery(hearingRoomId: string | null | undefined) {
	return useQuery<CommissionHearingPaymentStatus>({
		...api.commissionHearing.getPaymentStatus.queryOptions({
			input: { id: hearingRoomId ?? "__skip__" },
		}),
		enabled: Boolean(hearingRoomId),
		staleTime: 5 * 1000,
		refetchInterval: query => {
			const data = query.state.data as CommissionHearingPaymentStatus | undefined
			return data?.required && !data.paid ? 4_000 : false
		},
	})
}

export function useCreateCommissionHearingPaymentMutation(hearingRoomId: string) {
	const queryClient = useQueryClient()
	return useMutation<CommissionHearingPaymentStatus, Error>({
		mutationFn: async () =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).commissionHearing.createPayment({
				id: hearingRoomId,
			}) as Promise<CommissionHearingPaymentStatus>,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.commissionHearing.getPaymentStatus.key({
					input: { id: hearingRoomId },
				}),
			})
		},
	})
}

export function useSimulateCommissionHearingPaymentMutation(hearingRoomId: string) {
	const queryClient = useQueryClient()
	return useMutation<CommissionHearingPaymentStatus, Error>({
		mutationFn: async () =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).commissionHearing.simulatePayment({
				id: hearingRoomId,
			}) as Promise<CommissionHearingPaymentStatus>,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.commissionHearing.getPaymentStatus.key({
					input: { id: hearingRoomId },
				}),
			})
		},
	})
}

export function useSendHearingChatMutation() {
	const queryClient = useQueryClient()

	return useMutation<CommissionHearingChatMessage, Error, SendCommissionHearingChat>({
		...api.commissionHearing.sendChat.mutationOptions(),
		onSuccess: (_data, variables) => {
			void queryClient.invalidateQueries({
				queryKey: api.commissionHearing.listChat.key({ input: { id: variables.id } }),
			})
		},
	})
}
