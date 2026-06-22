import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
	DenyEnpCommissionApplication,
	EnpCommission,
	EnpCommissionApplication,
	GrantEnpCommissionApplication,
	ScheduleEnpCommissionSummaryHearing,
	SubmitEnpCommissionApplication,
} from "@repo/contracts"

import { orpc, orpcClient } from "@/services/orpc/client"

/** OpenAPI client typing is looser than the contract router; keep calls runtime-safe. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client vs NestedClient inference gap
const api = orpc as any

export function useMyEnpCommissionApplicationsQuery() {
	return useQuery<EnpCommissionApplication[]>({
		...api.enpCommissionApplication.listMine.queryOptions({ staleTime: 30 * 1000 }),
	})
}

export function useEnpCommissionApplicationsReviewQueueQuery() {
	return useQuery<EnpCommissionApplication[]>({
		...api.enpCommissionApplication.listForReview.queryOptions({ staleTime: 30 * 1000 }),
	})
}

export function useEnpCommissionApplicationQuery(id: string | null) {
	return useQuery<EnpCommissionApplication>({
		...api.enpCommissionApplication.get.queryOptions({ input: { id: id ?? "__none__" } }),
		enabled: Boolean(id),
	})
}

export function useCommissionApplicationCommissionQuery(applicationId: string | null | undefined) {
	return useQuery<EnpCommission>({
		...api.enpCommissionApplication.getCommission.queryOptions({
			input: { id: applicationId ?? "__none__" },
		}),
		enabled: Boolean(applicationId),
		retry: false,
	})
}

function invalidateCommissionApplicationQueries(
	queryClient: ReturnType<typeof useQueryClient>,
	applicationId: string
) {
	void queryClient.invalidateQueries({
		queryKey: api.enpCommissionApplication.get.key({ input: { id: applicationId } }),
	})
	void queryClient.invalidateQueries({
		queryKey: api.enpCommissionApplication.getCommission.key({ input: { id: applicationId } }),
	})
	void queryClient.invalidateQueries({
		queryKey: api.enpCommissionApplication.listMine.key(),
	})
	void queryClient.invalidateQueries({
		queryKey: api.enpCommissionApplication.listForReview.key(),
	})
}

export function useSubmitEnpCommissionApplicationMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: SubmitEnpCommissionApplication) =>
			(orpcClient as any).enpCommissionApplication.submit(
				input
			) as Promise<EnpCommissionApplication>,
		onSuccess: async () => {
			await queryClient.invalidateQueries()
		},
	})
}

export function useGrantCommissionMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: GrantEnpCommissionApplication) =>
			(orpcClient as any).enpCommissionApplication.grant(
				input
			) as Promise<EnpCommissionApplication>,
		onSuccess: (_data, variables) => {
			invalidateCommissionApplicationQueries(queryClient, variables.id)
		},
	})
}

export function useDenyCommissionMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: DenyEnpCommissionApplication) =>
			(orpcClient as any).enpCommissionApplication.deny(input) as Promise<EnpCommissionApplication>,
		onSuccess: (_data, variables) => {
			invalidateCommissionApplicationQueries(queryClient, variables.id)
		},
	})
}

export function useScheduleEnpCommissionSummaryHearingMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: ScheduleEnpCommissionSummaryHearing) =>
			(orpcClient as any).enpCommissionApplication.scheduleSummaryHearing(
				input
			) as Promise<EnpCommissionApplication>,
		onSuccess: async () => {
			await queryClient.invalidateQueries()
		},
	})
}
