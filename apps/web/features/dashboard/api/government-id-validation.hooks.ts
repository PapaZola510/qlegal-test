import { useMutation, useQueryClient } from "@tanstack/react-query"

import type {
	DismissGovernmentIdExpiryWarning,
	SnoozeGovernmentIdExpiryWarning,
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

export function useDismissGovernmentIdExpiryWarningMutation() {
	const queryClient = useQueryClient()
	return useMutation<UserProfile, Error, DismissGovernmentIdExpiryWarning>({
		...api.authProfile.dismissGovernmentIdExpiryWarning.mutationOptions(),
		onSettled: () => invalidateProfile(queryClient),
	})
}

export function useSnoozeGovernmentIdExpiryWarningMutation() {
	const queryClient = useQueryClient()
	return useMutation<UserProfile, Error, SnoozeGovernmentIdExpiryWarning | void>({
		...api.authProfile.snoozeGovernmentIdExpiryWarning.mutationOptions(),
		onSettled: () => invalidateProfile(queryClient),
	})
}
