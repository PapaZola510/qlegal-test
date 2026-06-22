import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { orpc } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client vs NestedClient inference gap
const api = orpc as any

export function useOnboardingProgressQuery() {
	return useQuery({
		...api.onboarding.progress.queryOptions(),
		staleTime: 15 * 1000,
	})
}

export function useStartHypervergeAttemptMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		...api.onboarding.startHypervergeAttempt.mutationOptions(),
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

export function useSyncHypervergeSdkCallbackMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		...api.onboarding.syncHypervergeSdkCallback.mutationOptions(),
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

export function useDismissIdentityExpiryNoticeMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		...api.authProfile.dismissIdentityExpiryNotice.mutationOptions(),
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: api.authProfile.me.queryOptions().queryKey,
			})
		},
	})
}

export function useSkipEnpKycMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		...api.onboarding.skipEnpKyc.mutationOptions(),
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

export function useCompleteCertificationCourseMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		...api.onboarding.completeCertificationCourse.mutationOptions(),
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
