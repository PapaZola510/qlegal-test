import { useMutation, useQueryClient } from "@tanstack/react-query"

import type {
	DismissCommissionExpiryWarning,
	SnoozeCommissionExpiryWarning,
	UserProfile,
} from "@repo/contracts"

import { orpc } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client vs NestedClient inference gap
const api = orpc as any

function invalidateProfile(queryClient: ReturnType<typeof useQueryClient>) {
	void queryClient.invalidateQueries({
		queryKey: api.authProfile.me.queryOptions().queryKey,
	})
}

export function useDismissCommissionExpiryWarningMutation() {
	const queryClient = useQueryClient()
	return useMutation<UserProfile, Error, DismissCommissionExpiryWarning>({
		...api.authProfile.dismissCommissionExpiryWarning.mutationOptions(),
		onSettled: () => invalidateProfile(queryClient),
	})
}

export function useSnoozeCommissionExpiryWarningMutation() {
	const queryClient = useQueryClient()
	return useMutation<UserProfile, Error, SnoozeCommissionExpiryWarning | void>({
		...api.authProfile.snoozeCommissionExpiryWarning.mutationOptions(),
		onSettled: () => invalidateProfile(queryClient),
	})
}
