import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"

import { orpc } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client vs NestedClient inference gap
const api = orpc as any

export function invalidateAuthProfileQuery(queryClient: QueryClient): void {
	void queryClient.invalidateQueries({
		queryKey: api.authProfile.me.queryOptions().queryKey,
	})
}

export function useLmsTrainingProgressQuery(enabled = true) {
	return useQuery({
		...api.integration.progress.queryOptions(),
		enabled,
		staleTime: 30 * 1000,
	})
}

export function useSyncAccountToLmsMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		...api.integration.syncAccount.mutationOptions(),
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: api.integration.progress.queryOptions().queryKey,
			})
		},
	})
}

export function useStartLmsTrainingMutation() {
	return useMutation({
		...api.integration.startTraining.mutationOptions(),
	})
}

export function useStartQLearnCourseMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		...api.onboarding.startQLearnCourse.mutationOptions(),
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: api.integration.progress.queryOptions().queryKey,
			})
		},
	})
}

export function useLmsTrainingCertificateQuery(enabled = true) {
	return useQuery({
		...api.integration.certificate.queryOptions(),
		enabled,
		staleTime: 60 * 1000,
		refetchOnWindowFocus: true,
	})
}

export function useSyncLmsCourseCompletionMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		...api.integration.syncCourseCompletion.mutationOptions(),
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: api.authProfile.me.queryOptions().queryKey,
			})
			void queryClient.invalidateQueries({
				queryKey: api.onboarding.progress.queryOptions().queryKey,
			})
			void queryClient.invalidateQueries({
				queryKey: api.integration.progress.queryOptions().queryKey,
			})
			void queryClient.invalidateQueries({
				queryKey: api.integration.certificate.queryOptions().queryKey,
			})
		},
	})
}

export function useSimulateLmsCompletionMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		...api.integration.simulateCompletion.mutationOptions(),
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: api.authProfile.me.queryOptions().queryKey,
			})
			void queryClient.invalidateQueries({
				queryKey: api.onboarding.progress.queryOptions().queryKey,
			})
		},
	})
}
