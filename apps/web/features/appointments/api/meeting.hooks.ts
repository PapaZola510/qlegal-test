import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
	AppointmentAttachment,
	CreateMeetingPaymentResult,
	MeetingEnbSigningStatus,
	MeetingPaymentBrands,
	MeetingPaymentStatus,
	MeetingRecording,
	SessionChatMessage,
} from "@repo/contracts"

import { orpc, orpcClient } from "@/services/orpc/client"
import { uploadPrincipalMeetingDocumentFile } from "@/features/appointments/lib/upload-appointment-file"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap vs contract router
const api = orpc as any

export function useAppointmentAttachmentsQuery(
	appointmentId: string | undefined,
	options?: { enabled?: boolean }
) {
	return useQuery({
		...api.appointment.listAttachments.queryOptions({
			input: { id: appointmentId ?? "__skip__" },
		}),
		enabled: Boolean(appointmentId) && options?.enabled !== false,
		staleTime: 15 * 1000,
		retry: 1,
	})
}

export function useAppointmentBookedDocumentTypesQuery(appointmentId: string | undefined) {
	return useQuery({
		...api.appointment.listBookedDocumentTypes.queryOptions({
			input: { id: appointmentId ?? "__skip__" },
		}),
		enabled: Boolean(appointmentId),
		staleTime: 30 * 1000,
		retry: 1,
	})
}

export function useSessionChatQuery(sessionRoomId: string | undefined) {
	return useQuery({
		...api.session.listSessionChat.queryOptions({
			input: { id: sessionRoomId ?? "__skip__" },
		}),
		enabled: Boolean(sessionRoomId),
		staleTime: 5 * 1000,
	})
}

export function useSendSessionChatMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: { sessionRoomId: string; body: string }) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).session.sendSessionChat({
				id: input.sessionRoomId,
				body: input.body,
			}) as Promise<SessionChatMessage>,
		onSuccess: async () => {
			await queryClient.invalidateQueries()
		},
	})
}

export function useMeetingPaymentStatusQuery(
	appointmentId: string | undefined,
	options?: { enabled?: boolean }
) {
	return useQuery({
		...api.appointment.getMeetingPaymentStatus.queryOptions({
			input: { id: appointmentId ?? "__skip__" },
		}),
		enabled: Boolean(appointmentId) && options?.enabled !== false,
		staleTime: 5 * 1000,
		refetchInterval: query => {
			const data = query.state.data as MeetingPaymentStatus | undefined
			if (data?.required && !data.paid) return 4_000
			return false
		},
	})
}

export function useMeetingPaymentBrandsQuery(
	appointmentId: string | undefined,
	options?: { enabled?: boolean }
) {
	return useQuery<MeetingPaymentBrands>({
		...api.appointment.listMeetingPaymentBrands.queryOptions({
			input: { id: appointmentId ?? "__skip__" },
		}),
		enabled: Boolean(appointmentId) && options?.enabled !== false,
		staleTime: 60 * 1000,
		retry: 1,
	})
}

export function useCreateMeetingPaymentMutation(appointmentId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input?: { paymentOptionCode?: string }) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).appointment.createMeetingPayment({
				id: appointmentId,
				...(input?.paymentOptionCode ? { paymentOptionCode: input.paymentOptionCode } : {}),
			}) as Promise<CreateMeetingPaymentResult>,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.appointment.getMeetingPaymentStatus.key({ input: { id: appointmentId } }),
			})
		},
	})
}

export function useSimulateMeetingPaymentMutation(appointmentId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async () =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).appointment.simulateMeetingPayment({
				id: appointmentId,
			}) as Promise<MeetingPaymentStatus>,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.appointment.getMeetingPaymentStatus.key({ input: { id: appointmentId } }),
			})
		},
	})
}

export function useLinkMeetingDocumentMutation(appointmentId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: {
			fileObjectId: string
			documentName: string
			documentType: string
			enpDocumentTypeId?: string
			feePhp: number
		}) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).appointment.linkMeetingDocument({
				id: appointmentId,
				...input,
			}) as Promise<AppointmentAttachment>,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.appointment.listAttachments.key({ input: { id: appointmentId } }),
			})
			await invalidateMeetingPaymentQueries(queryClient, appointmentId)
		},
	})
}

export function useUpdateMeetingDocumentFeeMutation(appointmentId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: { fileObjectId: string; feePhp: number }) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).appointment.updateMeetingDocumentFee({
				id: appointmentId,
				fileObjectId: input.fileObjectId,
				feePhp: input.feePhp,
			}) as Promise<AppointmentAttachment>,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.appointment.listAttachments.key({ input: { id: appointmentId } }),
			})
			await invalidateMeetingPaymentQueries(queryClient, appointmentId)
		},
	})
}

async function invalidateMeetingPaymentQueries(
	queryClient: ReturnType<typeof useQueryClient>,
	appointmentId: string
) {
	await queryClient.invalidateQueries({
		queryKey: api.appointment.getMeetingPaymentStatus.key({ input: { id: appointmentId } }),
	})
}

export function useMeetingRecordingsQuery(appointmentId: string | undefined) {
	return useQuery({
		...api.appointment.listMeetingRecordings.queryOptions({
			input: { id: appointmentId ?? "__skip__" },
		}),
		enabled: Boolean(appointmentId),
		staleTime: 15 * 1000,
		retry: 1,
	})
}

export function useAllMeetingRecordingsQuery() {
	return useQuery({
		...api.appointment.listAllMeetingRecordings.queryOptions({ input: {} }),
		staleTime: 15 * 1000,
		retry: 1,
	})
}

export function useLinkMeetingRecordingMutation(appointmentId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: { fileObjectId: string; fileName: string }) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).appointment.linkMeetingRecording({
				id: appointmentId,
				...input,
			}) as Promise<MeetingRecording>,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.appointment.listMeetingRecordings.key({ input: { id: appointmentId } }),
			})
		},
	})
}

export function useDeleteMeetingRecordingMutation(appointmentId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: { fileObjectId: string }) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).appointment.deleteMeetingRecording({
				id: appointmentId,
				fileObjectId: input.fileObjectId,
			}) as Promise<{ ok: boolean }>,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.appointment.listMeetingRecordings.key({ input: { id: appointmentId } }),
			})
			await queryClient.invalidateQueries({
				queryKey: api.appointment.listAllMeetingRecordings.key({ input: {} }),
			})
		},
	})
}

export function useDeleteMeetingRecordingGlobalMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: { appointmentId: string; fileObjectId: string }) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).appointment.deleteMeetingRecording({
				id: input.appointmentId,
				fileObjectId: input.fileObjectId,
			}) as Promise<{ ok: boolean }>,
		onSuccess: async (_data, variables) => {
			await queryClient.invalidateQueries({
				queryKey: api.appointment.listMeetingRecordings.key({
					input: { id: variables.appointmentId },
				}),
			})
			await queryClient.invalidateQueries({
				queryKey: api.appointment.listAllMeetingRecordings.key({ input: {} }),
			})
		},
	})
}

export function useDeleteMeetingDocumentMutation(appointmentId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: { fileObjectId: string }) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).appointment.deleteMeetingDocument({
				id: appointmentId,
				fileObjectId: input.fileObjectId,
			}) as Promise<{ ok: true; fileObjectId: string }>,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.appointment.listAttachments.key({ input: { id: appointmentId } }),
			})
			await invalidateMeetingPaymentQueries(queryClient, appointmentId)
		},
	})
}

export function useCreateMeetingDocumentProjectMutation(appointmentId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: { fileObjectId: string; feePhp?: number }) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).appointment.createMeetingDocumentProject({
				id: appointmentId,
				fileObjectId: input.fileObjectId,
				...(input.feePhp !== undefined ? { feePhp: input.feePhp } : {}),
			}) as Promise<AppointmentAttachment>,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.appointment.listAttachments.key({ input: { id: appointmentId } }),
			})
		},
	})
}

/**
 * Multipart upload for the principal/client during a live meeting. The file is uploaded
 * directly into the ENP's sub-org and linked to the appointment without provisioning a
 * project — the ENP must create the signing project later.
 */
export function usePrincipalMeetingDocumentUploadMutation(appointmentId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: {
			file: File
			documentName: string
			documentType: string
			enpDocumentTypeId?: string
		}) =>
			uploadPrincipalMeetingDocumentFile({
				file: input.file,
				appointmentId,
				documentName: input.documentName,
				documentType: input.documentType,
				enpDocumentTypeId: input.enpDocumentTypeId,
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.appointment.listAttachments.key({ input: { id: appointmentId } }),
			})
		},
	})
}

export function useMeetingSignerParticipantsQuery(meetingId: string | undefined) {
	return useQuery({
		...api.session.listMeetingSignerParticipants.queryOptions({
			input: { meetingId: meetingId ?? "__skip__" },
		}),
		enabled: Boolean(meetingId),
		staleTime: 30 * 1000,
	})
}

export function useListMeetingDocumentSignerAssignmentsQuery(
	meetingId: string | undefined,
	documentId: string | undefined
) {
	return useQuery({
		...api.session.listMeetingDocumentSignerAssignments.queryOptions({
			input: {
				meetingId: meetingId ?? "__skip__",
				documentId: documentId ?? "__skip__",
			},
		}),
		enabled: Boolean(meetingId && documentId),
		staleTime: 10 * 1000,
	})
}

export function useListMeetingDocumentSignersQuery(
	meetingId: string | undefined,
	documentId: string | undefined,
	options?: { pollWhileSigning?: boolean }
) {
	return useQuery({
		...api.session.listMeetingDocumentSigners.queryOptions({
			input: {
				meetingId: meetingId ?? "__skip__",
				documentId: documentId ?? "__skip__",
			},
		}),
		enabled: Boolean(meetingId && documentId),
		staleTime: 30 * 1000,
		placeholderData: keepPreviousData,
		refetchOnMount: "always",
		refetchInterval: query => {
			if (!options?.pollWhileSigning) return false
			const data = query.state.data as
				| {
						completed?: boolean
						plotCompletedAt?: string | null
						notarizedPdfReady?: boolean
				 }
				| undefined
			if (!data?.plotCompletedAt) return 10_000
			if (!data.completed) return 4_000
			if (!data.notarizedPdfReady) return 4_000
			return false
		},
	})
}

export function useGenerateMeetingDocumentPlotLinkMutation(meetingId: string, documentId: string) {
	return useMutation({
		mutationFn: async () =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).session.generateMeetingDocumentPlotLink({
				meetingId,
				documentId,
			}) as Promise<{ plotLink: string }>,
	})
}

export function useMarkMeetingDocumentPlottedMutation(meetingId: string, documentId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async () =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).session.markMeetingDocumentPlotted({
				meetingId,
				documentId,
			}) as Promise<{ ok: boolean }>,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.session.listMeetingDocumentSigners.key({
					input: { meetingId, documentId },
				}),
			})
			await queryClient.invalidateQueries({
				queryKey: api.appointment.listAttachments.key({ input: { id: meetingId } }),
			})
		},
	})
}

export function useSetMeetingDocumentSignersMutation(meetingId: string, documentId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: {
			signers: { userId: string; role: "notary" | "principal" | "witness" }[]
		}) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).session.setMeetingDocumentSigners({
				meetingId,
				documentId,
				signers: input.signers,
			}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.session.listMeetingDocumentSignerAssignments.key({
					input: { meetingId, documentId },
				}),
			})
			await queryClient.invalidateQueries({
				queryKey: api.session.listMeetingDocumentSigners.key({
					input: { meetingId, documentId },
				}),
			})
			await queryClient.invalidateQueries({
				queryKey: api.appointment.listAttachments.key({ input: { id: meetingId } }),
			})
		},
	})
}

export function useMeetingEnbSigningStatusQuery(
	meetingId: string | undefined,
	options?: { enabled?: boolean }
) {
	return useQuery({
		...api.session.getMeetingEnbSigningStatus.queryOptions({
			input: { meetingId: meetingId ?? "__skip__" },
		}),
		enabled: Boolean(meetingId) && options?.enabled !== false,
		staleTime: 5 * 1000,
		refetchInterval: query => {
			const data = query.state.data as MeetingEnbSigningStatus | undefined
			if (data?.status === "active" && data.pendingCount > 0) return 5_000
			return false
		},
	})
}

export function useStartMeetingEnbSigningMutation(meetingId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async () =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).session.startMeetingEnbSigning({
				meetingId,
			}) as Promise<MeetingEnbSigningStatus>,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.session.getMeetingEnbSigningStatus.key({ input: { meetingId } }),
			})
			await queryClient.invalidateQueries({
				queryKey: api.appointment.get.key({ input: { id: meetingId } }),
			})
		},
	})
}

export function useSignMeetingEnbEntryMutation(meetingId: string) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: {
			requestId: string
			signatureAcknowledgment: string
			signatureImageData: string
		}) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
			(orpcClient as any).session.signMeetingEnbEntry({
				meetingId,
				requestId: input.requestId,
				signatureAcknowledgment: input.signatureAcknowledgment,
				signatureImageData: input.signatureImageData,
			}) as Promise<{ ok: boolean; status: MeetingEnbSigningStatus }>,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.session.getMeetingEnbSigningStatus.key({ input: { meetingId } }),
			})
			await queryClient.invalidateQueries({
				queryKey: api.appointment.get.key({ input: { id: meetingId } }),
			})
		},
	})
}

export type { AppointmentAttachment }
