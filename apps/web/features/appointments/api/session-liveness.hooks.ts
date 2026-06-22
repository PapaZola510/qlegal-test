import { useMutation, useQuery } from "@tanstack/react-query"

import { orpc } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
const api = orpc as any

export function useSessionLivenessStatusQuery(
	appointmentId: string | undefined,
	guestInviteToken?: string | null
) {
	return useQuery({
		...api.session.getSessionLivenessStatus.queryOptions({
			input: {
				appointmentId: appointmentId ?? "__none__",
				...(guestInviteToken ? { guestInviteToken } : {}),
			},
		}),
		enabled: Boolean(appointmentId),
		staleTime: 5 * 1000,
	})
}

export function useStartHostedLivenessMutation() {
	return useMutation({
		...api.session.startHostedLiveness.mutationOptions(),
	})
}

export function useCompleteSessionLivenessMutation() {
	return useMutation({
		...api.session.completeSessionLiveness.mutationOptions(),
	})
}
