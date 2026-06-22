"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
	AccessLogEntry,
	AvRecording,
	ChainVerifyResult,
	CommissionRecord,
	ComplianceExportRequest,
	ComplianceExportResult,
	ComplianceListFilter,
	EnbInspectFilter,
	EnbInspectResult,
	EnbSummary,
	NotarizedDocument,
	RequestEnbCopyInput,
	RequestEnbCopyResult,
} from "@repo/contracts"

import { orpc, orpcClient } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
const api = orpc as any

type AccessLogFilter = { limit?: number; offset?: number }

export function useCommissionRecordsQuery(filter: ComplianceListFilter) {
	return useQuery<CommissionRecord[]>({
		...api.complianceAudit.listCommissionRecords.queryOptions({
			input: filter,
			staleTime: 30 * 1000,
		}),
	})
}

export function useEnbsQuery(filter: ComplianceListFilter) {
	return useQuery<EnbSummary[]>({
		...api.complianceAudit.listEnbs.queryOptions({
			input: filter,
			staleTime: 30 * 1000,
		}),
	})
}

export function useInspectEnbQuery(filter: EnbInspectFilter, enabled: boolean) {
	return useQuery<EnbInspectResult>({
		...api.complianceAudit.inspectEnb.queryOptions({
			input: filter,
			staleTime: 30 * 1000,
		}),
		enabled,
	})
}

export function useRequestEnbCopyMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: RequestEnbCopyInput) =>
			(
				orpcClient as {
					complianceAudit: {
						requestEnbCopy: (input: RequestEnbCopyInput) => Promise<RequestEnbCopyResult>
					}
				}
			).complianceAudit.requestEnbCopy(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.complianceAudit.listMyAccessLog.key(),
			})
		},
	})
}

export function useNotarizedDocumentsQuery(filter: ComplianceListFilter) {
	return useQuery<NotarizedDocument[]>({
		...api.complianceAudit.listNotarizedDocuments.queryOptions({
			input: filter,
			staleTime: 30 * 1000,
		}),
	})
}

export function useNotarizedDocumentQuery(id: string | null) {
	return useQuery<NotarizedDocument>({
		...api.complianceAudit.getNotarizedDocument.queryOptions({
			input: { id: id ?? "" },
			enabled: Boolean(id),
			staleTime: 30 * 1000,
		}),
	})
}

export function useAvRecordingsQuery(filter: ComplianceListFilter) {
	return useQuery<AvRecording[]>({
		...api.complianceAudit.listAvRecordings.queryOptions({
			input: filter,
			staleTime: 30 * 1000,
		}),
	})
}

export function useAvRecordingUrlMutation() {
	return useMutation({
		mutationFn: async (id: string) =>
			(
				orpcClient as {
					complianceAudit: {
						getAvRecordingUrl: (input: {
							id: string
						}) => Promise<{ url: string; expiresAt: string }>
					}
				}
			).complianceAudit.getAvRecordingUrl({ id }),
	})
}

export function useMyAccessLogQuery(filter: AccessLogFilter) {
	return useQuery<AccessLogEntry[]>({
		...api.complianceAudit.listMyAccessLog.queryOptions({
			input: { limit: filter.limit ?? 50, offset: filter.offset ?? 0 },
			staleTime: 30 * 1000,
		}),
	})
}

export function useVerifyChainQuery() {
	return useQuery<ChainVerifyResult>({
		...api.complianceAudit.verifyChain.queryOptions({
			enabled: false,
			staleTime: 30 * 1000,
		}),
	})
}

export function useCreateExportMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: ComplianceExportRequest) =>
			(
				orpcClient as {
					complianceAudit: {
						createExport: (input: ComplianceExportRequest) => Promise<ComplianceExportResult>
					}
				}
			).complianceAudit.createExport(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: api.complianceAudit.listMyAccessLog.key(),
			})
		},
	})
}
