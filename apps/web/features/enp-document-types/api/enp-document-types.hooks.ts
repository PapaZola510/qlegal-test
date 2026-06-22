import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"

import type { CreateEnpDocumentType, EnpDocumentType, UpdateEnpDocumentType } from "@repo/contracts"

import { orpc, orpcClient } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client vs NestedClient inference gap
const api = orpc as any

function listMineQueryKey() {
	return api.enpDocumentType.listMine.queryOptions({}).queryKey
}

function readListMine(queryClient: QueryClient): EnpDocumentType[] {
	return queryClient.getQueryData<EnpDocumentType[]>(listMineQueryKey()) ?? []
}

function writeListMine(queryClient: QueryClient, next: EnpDocumentType[]) {
	queryClient.setQueryData(listMineQueryKey(), next)
}

async function refreshEnpDocumentTypeQueries(queryClient: QueryClient) {
	await Promise.all([
		queryClient.invalidateQueries({
			queryKey: listMineQueryKey(),
			refetchType: "active",
		}),
		queryClient.invalidateQueries({
			queryKey: api.enpDocumentType.listForEnp.key(),
			refetchType: "active",
		}),
	])
}

export function useEnpDocumentTypesForEnpQuery(enpId: string | null) {
	return useQuery<EnpDocumentType[]>({
		...api.enpDocumentType.listForEnp.queryOptions({
			input: { enpId: enpId ?? "__none__" },
		}),
		enabled: Boolean(enpId),
		staleTime: 0,
		refetchOnMount: "always",
	})
}

export function useMyEnpDocumentTypesQuery() {
	return useQuery<EnpDocumentType[]>({
		...api.enpDocumentType.listMine.queryOptions({}),
		staleTime: 0,
		refetchOnMount: "always",
	})
}

export function useCreateEnpDocumentTypeMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: CreateEnpDocumentType) =>
			(orpcClient as any).enpDocumentType.create(input) as Promise<EnpDocumentType>,
		onMutate: async input => {
			await queryClient.cancelQueries({ queryKey: listMineQueryKey() })
			const previous = readListMine(queryClient)
			const optimisticId = `optimistic-${crypto.randomUUID()}`
			const optimistic: EnpDocumentType = {
				id: optimisticId,
				enpId: "",
				name: input.name.trim(),
				pricePhp: input.pricePhp,
				isActive: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			}
			writeListMine(queryClient, [optimistic, ...previous])
			return { previous, optimisticId }
		},
		onSuccess: (created, _input, context) => {
			const optimisticId = context?.optimisticId
			const current = readListMine(queryClient).filter(
				t => t.id !== optimisticId && t.id !== created.id
			)
			writeListMine(queryClient, [created, ...current])
		},
		onError: (_error, _input, context) => {
			if (context?.previous) writeListMine(queryClient, context.previous)
		},
		onSettled: async () => {
			await refreshEnpDocumentTypeQueries(queryClient)
		},
	})
}

export function useUpdateEnpDocumentTypeMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: UpdateEnpDocumentType) =>
			(orpcClient as any).enpDocumentType.update(input) as Promise<EnpDocumentType>,
		onMutate: async input => {
			await queryClient.cancelQueries({ queryKey: listMineQueryKey() })
			const previous = readListMine(queryClient)
			writeListMine(
				queryClient,
				previous.map(t =>
					t.id === input.id
						? {
								...t,
								...(input.name !== undefined ? { name: input.name } : {}),
								...(input.pricePhp !== undefined ? { pricePhp: input.pricePhp } : {}),
								updatedAt: new Date(),
							}
						: t
				)
			)
			return { previous }
		},
		onSuccess: updated => {
			writeListMine(
				queryClient,
				readListMine(queryClient).map(t => (t.id === updated.id ? updated : t))
			)
		},
		onError: (_error, _input, context) => {
			if (context?.previous) writeListMine(queryClient, context.previous)
		},
		onSettled: async () => {
			await refreshEnpDocumentTypeQueries(queryClient)
		},
	})
}

export function useDeleteEnpDocumentTypeMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (id: string) => (orpcClient as any).enpDocumentType.delete({ id }),
		onMutate: async id => {
			await queryClient.cancelQueries({ queryKey: listMineQueryKey() })
			const previous = readListMine(queryClient)
			writeListMine(
				queryClient,
				previous.filter(t => t.id !== id)
			)
			return { previous }
		},
		onError: (_error, _id, context) => {
			if (context?.previous) writeListMine(queryClient, context.previous)
		},
		onSettled: async () => {
			await refreshEnpDocumentTypeQueries(queryClient)
		},
	})
}
