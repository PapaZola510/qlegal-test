import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
	Appointment,
	AppointmentListResponse,
	CreateAppointment,
	DeclineBookingQuote,
	DirectorySearchInput,
	ListAppointmentsInput,
	NotaryDirectoryEntry,
	SendBookingQuote,
} from "@repo/contracts"

import { orpc, orpcClient } from "@/services/orpc/client"

/** OpenAPI client typing is looser than the contract router; keep calls runtime-safe. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client vs NestedClient inference gap
const api = orpc as any

export const APPOINTMENTS_PAGE_SIZE = 10

export function useAppointmentsQuery(input: Partial<ListAppointmentsInput> = {}) {
	const page = input.page ?? 1
	const limit = input.limit ?? APPOINTMENTS_PAGE_SIZE
	const status = input.status

	return useQuery({
		...api.appointment.list.queryOptions({
			input: {
				page,
				limit,
				...(status ? { status } : {}),
			},
			// Short stale window + poll: when the notary confirms or starts the session, the client list must refresh quickly or "Join meeting" stays hidden.
			staleTime: 5 * 1000,
			refetchInterval: 12 * 1000,
			refetchIntervalInBackground: false,
			refetchOnWindowFocus: true,
		}),
	})
}

export function selectAppointmentList(data: unknown): AppointmentListResponse | undefined {
	if (!data || typeof data !== "object" || !("items" in data)) return undefined
	return data as AppointmentListResponse
}

export function useAppointmentQuery(appointmentId: string | undefined) {
	return useQuery({
		...api.appointment.get.queryOptions({
			input: { id: appointmentId ?? "__none__" },
		}),
		enabled: Boolean(appointmentId),
		staleTime: 15 * 1000,
	})
}

export function useIssueJoinTokenMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (appointmentId: string) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap vs contract router
			(orpcClient as any).session.issueJoinToken({ appointmentId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries()
		},
	})
}

export function useNotaryDirectoryQuery(input: DirectorySearchInput) {
	return useQuery<NotaryDirectoryEntry[]>({
		...api.appointment.searchDirectory.queryOptions(input),
		staleTime: 30 * 1000,
	})
}

export function useAppointmentStatusMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: {
			id: string
			status: Appointment["status"]
			declineReason?: string
		}) => (orpcClient as any).appointment.updateStatus(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries()
		},
	})
}

export function useCreateAppointmentMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: CreateAppointment) => (orpcClient as any).appointment.create(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries()
		},
	})
}

export function useSendBookingQuoteMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: SendBookingQuote) =>
			(orpcClient as any).appointment.sendBookingQuote(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries()
		},
	})
}

export function useAcceptBookingQuoteMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (appointmentId: string) =>
			(orpcClient as any).appointment.acceptBookingQuote({ id: appointmentId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries()
		},
	})
}

export function useDeclineBookingQuoteMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: DeclineBookingQuote) =>
			(orpcClient as any).appointment.declineBookingQuote(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries()
		},
	})
}

export type { Appointment, AppointmentListResponse }
export type { NotaryDirectoryEntry }
