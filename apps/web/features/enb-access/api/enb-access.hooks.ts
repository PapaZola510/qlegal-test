import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
	EnbAccessRequest,
	EnbEntryLookupResult,
	LookupEnbEntryForAccess,
	SubmitVirtualEnbAccessRequest,
} from "@repo/contracts"

import { orpc as api } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
const orpcClient = api as any

export function useEnbAccessMyRequestsQuery(enabled = true) {
	return useQuery<EnbAccessRequest[]>({
		queryKey: [...orpcClient.enbAccess.listMyRequests.key()],
		queryFn: async () => {
			const result = await orpcClient.enbAccess.listMyRequests()
			return Array.isArray(result) ? (result as EnbAccessRequest[]) : []
		},
		enabled,
		staleTime: 30 * 1000,
	})
}

export function useLookupEnbEntryMutation() {
	return useMutation({
		mutationFn: async (input: LookupEnbEntryForAccess) => {
			const result = await orpcClient.enbAccess.lookupEntry(input)
			return result as EnbEntryLookupResult
		},
	})
}

export function useSubmitVirtualEnbAccessMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: SubmitVirtualEnbAccessRequest) => {
			const result = await orpcClient.enbAccess.submitVirtualRequest(input)
			return result as EnbAccessRequest
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: orpcClient.enbAccess.listMyRequests.key() })
			await queryClient.invalidateQueries({
				queryKey: orpcClient.registry.listEnbAccessRequests.key(),
			})
		},
	})
}
