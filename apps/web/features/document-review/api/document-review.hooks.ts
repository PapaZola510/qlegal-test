import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
	ApproveDocumentReviewRequest,
	CreateDocumentReviewRequest,
	DocumentReviewRequest,
	RejectDocumentReviewRequest,
} from "@repo/contracts"

import { orpc, orpcClient } from "@/services/orpc/client"

/** OpenAPI client typing is looser than the contract router; keep calls runtime-safe. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client vs NestedClient inference gap
const api = orpc as any

export function useDocumentReviewRequestsQuery() {
	return useQuery<DocumentReviewRequest[]>({
		...api.documentReviewRequest.list.queryOptions({
			staleTime: 10 * 1000,
			refetchInterval: 20 * 1000,
			refetchIntervalInBackground: false,
			refetchOnWindowFocus: true,
		}),
	})
}

export function useDocumentReviewRequestQuery(id: string | undefined) {
	return useQuery<DocumentReviewRequest>({
		...api.documentReviewRequest.get.queryOptions({
			input: { id: id ?? "__none__" },
		}),
		enabled: Boolean(id),
		staleTime: 15 * 1000,
	})
}

export function useCreateDocumentReviewRequestMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: CreateDocumentReviewRequest) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).documentReviewRequest.create(input) as Promise<DocumentReviewRequest>,
		onSuccess: async () => {
			await queryClient.invalidateQueries()
		},
	})
}

export function useApproveDocumentReviewRequestMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: ApproveDocumentReviewRequest) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).documentReviewRequest.approve(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries()
		},
	})
}

export function useAdvanceDocumentReviewQuicksignMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (reviewRequestId: string) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).documentReviewRequest.advanceQuicksign({ id: reviewRequestId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries()
		},
	})
}

export function useRejectDocumentReviewRequestMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: RejectDocumentReviewRequest) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).documentReviewRequest.reject(input) as Promise<DocumentReviewRequest>,
		onSuccess: async () => {
			await queryClient.invalidateQueries()
		},
	})
}

export function useCancelDocumentReviewRequestMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (id: string) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).documentReviewRequest.cancel({ id }) as Promise<DocumentReviewRequest>,
		onSuccess: async () => {
			await queryClient.invalidateQueries()
		},
	})
}

export type { DocumentReviewRequest }
