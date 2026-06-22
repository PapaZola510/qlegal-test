import { useQuery } from "@tanstack/react-query"

import { orpcClient } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
const rpc = orpcClient as any

interface UseSessionLivenessResultOptions {
	appointmentId: string | null
	transactionId: string | null
	guestInviteToken?: string | null
	enabled?: boolean
}

export function useSessionLivenessResult({
	appointmentId,
	transactionId,
	guestInviteToken,
	enabled = true,
}: UseSessionLivenessResultOptions) {
	return useQuery({
		queryKey: ["session-liveness-result", appointmentId, transactionId, guestInviteToken ?? null],
		queryFn: async () => {
			if (!appointmentId || !transactionId) {
				throw new Error("Appointment and transaction ID are required")
			}
			return rpc.session.completeSessionLiveness({
				appointmentId,
				transactionId,
				...(guestInviteToken ? { guestInviteToken } : {}),
			})
		},
		enabled: enabled && Boolean(appointmentId && transactionId),
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: 1000 * 60 * 10,
		retry: 0,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		refetchOnMount: false,
	})
}
