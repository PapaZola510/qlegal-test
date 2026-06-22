import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { CtcPaymentStatus, MeetingPaymentBrands } from "@repo/contracts"

import { orpc, orpcClient } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
const api = orpc as any

export function useSignedDocumentsQuery(enabled: boolean) {
	return useQuery({
		...api.signed.listDocuments.queryOptions({
			staleTime: 30 * 1000,
			refetchOnWindowFocus: true,
		}),
		enabled,
	})
}

export function useRequestCertifiedTrueCopyMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (input: {
			appointmentId: string
			documentFileId: string
			requesterAddress: string
			lawfulPurpose: string
			paymentMethod: "cash" | "online"
		}) => (orpcClient as any).signed.requestCertifiedTrueCopy(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.signed.listDocuments.key() })
			await queryClient.invalidateQueries({ queryKey: api.registry.list.key() })
			await queryClient.invalidateQueries({ queryKey: api.registry.listEnbAccessRequests.key() })
		},
	})
}

export function useCtcPaymentStatusQuery(requestId: string | undefined) {
	return useQuery({
		...api.signed.getCtcPaymentStatus.queryOptions({
			input: { requestId: requestId ?? "__skip__" },
		}),
		enabled: Boolean(requestId),
		staleTime: 5 * 1000,
		refetchInterval: query => {
			const data = query.state.data as CtcPaymentStatus | undefined
			if (!data || data.paid) return false
			return 5_000
		},
	})
}

export function useCtcPaymentBrandsQuery(requestId: string | undefined) {
	return useQuery<MeetingPaymentBrands>({
		...api.signed.listCtcPaymentBrands.queryOptions({
			input: { requestId: requestId ?? "__skip__" },
		}),
		enabled: Boolean(requestId),
		staleTime: 60 * 1000,
	})
}

export function useCreateCtcPaymentMutation(requestId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (input?: { paymentOptionCode?: string }) =>
			(orpcClient as any).signed.createCtcPayment({
				requestId,
				paymentOptionCode: input?.paymentOptionCode,
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.signed.getCtcPaymentStatus.key({ input: { requestId } }),
			})
			await queryClient.invalidateQueries({ queryKey: api.signed.listDocuments.key() })
		},
	})
}

export function useSimulateCtcPaymentMutation(requestId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: () => (orpcClient as any).signed.simulateCtcPayment({ requestId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.signed.getCtcPaymentStatus.key({ input: { requestId } }),
			})
			await queryClient.invalidateQueries({ queryKey: api.signed.listDocuments.key() })
		},
	})
}
