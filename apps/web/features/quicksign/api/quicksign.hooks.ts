import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { CreateQuicksignProject, EnpDocumentType } from "@repo/contracts"

import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import { orpc, orpcClient } from "@/services/orpc/client"

type QuicksignAddSignerInput = {
	id: string
	firstName: string
	lastName: string
	email: string
	order?: number
}

type QuicksignFinalizeInput = {
	id: string
	clientUserId?: string
	scheduledAt?: string
	durationMinutes?: number
	title?: string
	notarizationType?:
		| "acknowledgment"
		| "jurat"
		| "oath_affirmation"
		| "copy_certification"
		| "signature_witnessing"
	sessionMode?: "remote" | "in_person" | "hybrid"
	notes?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client vs NestedClient inference gap
const api = orpc as any

export function useQuicksignProjectsQuery() {
	return useQuery({
		...api.quicksign.list.queryOptions({}),
		staleTime: 30 * 1000,
	})
}

export function useQuicksignProjectQuery(
	projectId: string | null,
	options?: { enabled?: boolean }
) {
	return useQuery({
		...api.quicksign.get.queryOptions({ input: { id: projectId ?? "" } }),
		enabled: Boolean(projectId) && (options?.enabled ?? true),
		staleTime: 10 * 1000,
		refetchInterval: query => {
			if (!projectId) return false
			const data = query.state.data as { signingComplete?: boolean } | undefined
			if (data?.signingComplete) return false
			return 15_000
		},
	})
}

export function useCreateQuicksignProjectMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: CreateQuicksignProject) =>
			(orpcClient as any).quicksign.create(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.quicksign.key() })
		},
	})
}

export function useMyEnpDocumentTypesQuery() {
	const me = useAuthProfileMeQuery()
	const enpId = me.data?.id ?? null

	return useQuery<EnpDocumentType[]>({
		...api.enpDocumentType.listForEnp.queryOptions({
			input: { enpId: enpId ?? "__none__" },
		}),
		enabled: Boolean(enpId),
		staleTime: 0,
		refetchOnMount: "always",
	})
}

export function useAddQuicksignSignerMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: QuicksignAddSignerInput) =>
			(orpcClient as any).quicksign.addSigner(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.quicksign.key() })
		},
	})
}

export function useQuicksignPlotLinkMutation() {
	return useMutation({
		mutationFn: async (id: string) => (orpcClient as any).quicksign.getPlotLink({ id }),
	})
}

export function useCompleteQuicksignPlottingMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (id: string) => (orpcClient as any).quicksign.completePlotting({ id }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.quicksign.key() })
		},
	})
}

export function useFinalizeQuicksignMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: QuicksignFinalizeInput) =>
			(orpcClient as any).quicksign.finalize(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries()
		},
	})
}
