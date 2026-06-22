import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
	EnbAccessRequest,
	ProtestProceedings,
	RecordIncompleteAct,
	SubmitMonthlyNotarialBook,
} from "@repo/contracts"

import { orpc, orpcClient } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
const api = orpc as any

export function useRegistryActsQuery(enabled: boolean) {
	return useQuery({
		...api.registry.list.queryOptions({
			staleTime: 30 * 1000,
		}),
		enabled,
	})
}

export function useSubmitMonthlyNotarialBookMutation() {
	return useMutation({
		mutationFn: async (input: SubmitMonthlyNotarialBook) =>
			(orpcClient as any).registry.submitMonthlyNotarialBook(input),
	})
}

export function useRegistryBulkScSyncMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (actIds: string[]) => {
			const result = await (orpcClient as any).registry.bulkScSync({ actIds })
			const failed = (result?.results ?? []).filter(
				(r: { success: boolean }) => !r.success
			) as Array<{ actId: string; error: string | null }>
			if (failed.length === actIds.length) {
				const msg = failed.find(r => r.error?.trim())?.error?.trim()
				throw new Error(msg || "SC sync failed")
			}
			return result
		},
		onSettled: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.registry.list.key(),
			})
		},
	})
}

export function useRegistryRefreshNotarizedDocumentMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (actId: string) =>
			(orpcClient as any).registry.refreshNotarizedDocument({ id: actId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.registry.list.key(),
			})
		},
	})
}

export function useRecordIncompleteActMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: RecordIncompleteAct) =>
			(orpcClient as any).registry.recordIncompleteAct(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.registry.list.key() })
		},
	})
}

export function useEnbAccessRequestsQuery(enabled = true) {
	return useQuery<EnbAccessRequest[]>({
		...api.registry.listEnbAccessRequests.queryOptions({
			staleTime: 30_000,
		}),
		enabled,
	})
}

export function useCreateEnbAccessRequestMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: Record<string, unknown>) =>
			(orpcClient as any).registry.createEnbAccessRequest(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.registry.list.key() })
			await queryClient.invalidateQueries({ queryKey: api.registry.listEnbAccessRequests.key() })
		},
	})
}

export function useDecideEnbAccessRequestMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: Record<string, unknown>) =>
			(orpcClient as any).registry.decideEnbAccessRequest(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.registry.list.key() })
			await queryClient.invalidateQueries({ queryKey: api.registry.listEnbAccessRequests.key() })
		},
	})
}

export function useProtestProceedingsQuery(registryActId: string) {
	return useQuery<ProtestProceedings | null>({
		queryKey: [...api.registry.getProtestProceedings.key({ input: { id: registryActId } })],
		queryFn: () => (orpcClient as any).registry.getProtestProceedings({ id: registryActId }),
		enabled: Boolean(registryActId),
	})
}

export function useUpsertProtestProceedingsMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: Record<string, unknown>) =>
			(orpcClient as any).registry.upsertProtestProceedings(input),
		onSuccess: async (_data, variables) => {
			const actId = (variables as { registryActId?: string }).registryActId
			if (actId) {
				await queryClient.invalidateQueries({
					queryKey: api.registry.getProtestProceedings.key({ input: { id: actId } }),
				})
			}
		},
	})
}
