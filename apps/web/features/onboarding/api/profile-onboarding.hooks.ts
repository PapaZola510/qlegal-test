import { useMutation, useQueryClient } from "@tanstack/react-query"

import type { BootstrapRole, UpdateProfile } from "@repo/contracts"

import { orpc, orpcClient } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- imperative client matches OAuth callback shape
const rpc = orpcClient as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = orpc as any

export function useBootstrapRoleMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (input: BootstrapRole) => rpc.authProfile.bootstrapRole(input) as Promise<unknown>,
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: api.authProfile.me.queryOptions().queryKey })
			void queryClient.invalidateQueries({
				queryKey: api.onboarding.progress.queryOptions().queryKey,
			})
		},
	})
}

export function useCancelEnpOnboardingMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: () => rpc.authProfile.cancelEnpOnboarding() as Promise<unknown>,
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: api.authProfile.me.queryOptions().queryKey })
			void queryClient.invalidateQueries({
				queryKey: api.onboarding.progress.queryOptions().queryKey,
			})
		},
	})
}

export function useUpdateAuthProfileMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (input: UpdateProfile) => rpc.authProfile.update(input) as Promise<unknown>,
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: api.authProfile.me.queryOptions().queryKey })
			void queryClient.invalidateQueries({
				queryKey: api.onboarding.progress.queryOptions().queryKey,
			})
		},
	})
}
