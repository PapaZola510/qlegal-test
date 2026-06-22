import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { IenAttestationRole } from "@repo/contracts"

import { orpc, orpcClient } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
const api = orpc as any

export function useListQuicksignIenAttestationsQuery(
	projectId: string | null,
	options?: { enabled?: boolean }
) {
	return useQuery({
		...api.quicksign.listIenAttestations.queryOptions({
			input: { id: projectId ?? "__skip__" },
		}),
		enabled: Boolean(projectId) && (options?.enabled ?? true),
		staleTime: 10 * 1000,
	})
}

export function useRecordQuicksignIenAttestationMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: {
			id: string
			role: "enp"
			acknowledged: true
			notarizationType?: string
		}) => (orpcClient as any).quicksign.recordIenAttestation(input),
		onSuccess: async (_data, variables) => {
			await queryClient.invalidateQueries({
				queryKey: api.quicksign.listIenAttestations.key({ input: { id: variables.id } }),
			})
		},
	})
}

export function useListAppointmentIenAttestationsQuery(
	appointmentId: string | null,
	documentFileId: string | null,
	options?: { enabled?: boolean }
) {
	return useQuery({
		...api.appointment.listIenAttestations.queryOptions({
			input: {
				id: appointmentId ?? "__skip__",
				documentFileId: documentFileId ?? "__skip__",
			},
		}),
		enabled: Boolean(appointmentId && documentFileId) && (options?.enabled ?? true),
		staleTime: 10 * 1000,
	})
}

export function useRecordAppointmentIenAttestationMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: {
			id: string
			documentFileId: string
			role: IenAttestationRole
			acknowledged: true
		}) => (orpcClient as any).appointment.recordIenAttestation(input),
		onSuccess: async (_data, variables) => {
			await queryClient.invalidateQueries({
				queryKey: api.appointment.listIenAttestations.key({
					input: { id: variables.id, documentFileId: variables.documentFileId },
				}),
			})
		},
	})
}

export function useResolveIenSignUrlMutation() {
	return useMutation({
		mutationFn: async (input: { id: string; documentFileId: string; role: IenAttestationRole }) =>
			(orpcClient as any).appointment.resolveIenSignUrl(input),
	})
}
