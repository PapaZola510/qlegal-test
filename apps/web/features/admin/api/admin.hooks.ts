import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
	AdminRegistryOversightEntry,
	AdminUser,
	CreateMaintenanceWindowInput,
	MaintenanceStatus,
	MaintenanceWindow,
	SetMaintenanceModeInput,
	SubOrg,
	UserRole,
} from "@repo/contracts"

import { invalidateAndBroadcastMaintenanceCache } from "@/core/lib/maintenance-cache-sync"
import { orpc, orpcClient } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
const api = orpc as any

export function useAdminUsersQuery() {
	return useQuery<AdminUser[]>({
		...api.admin.listUsers.queryOptions({
			staleTime: 30 * 1000,
		}),
	})
}

export function useRevokeCertificateMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (userId: string) =>
			(
				orpcClient as {
					admin: { revokeCertificate: (input: { userId: string }) => Promise<{ ok: true }> }
				}
			).admin.revokeCertificate({ userId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.admin.listUsers.key() })
		},
	})
}

export function useReinstateCertificateMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (userId: string) =>
			(
				orpcClient as {
					admin: { reinstateCertificate: (input: { userId: string }) => Promise<{ ok: true }> }
				}
			).admin.reinstateCertificate({ userId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.admin.listUsers.key() })
		},
	})
}

type ScCommissionStatus =
	| "active"
	| "inactive"
	| "cancelled"
	| "revoked"
	| "disqualified"
	| "suspended"
	| "unknown"

export function useSetEnpScCommissionStatusMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: { userId: string; status: ScCommissionStatus }) =>
			(
				orpcClient as {
					admin: {
						setEnpScCommissionStatus: (input: {
							userId: string
							status: ScCommissionStatus
						}) => Promise<AdminUser>
					}
				}
			).admin.setEnpScCommissionStatus(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.admin.listUsers.key() })
		},
	})
}

export function useSyncEnpScCommissionFromScMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (userId: string) =>
			(
				orpcClient as {
					admin: {
						syncEnpScCommissionFromSc: (input: { userId: string }) => Promise<AdminUser>
					}
				}
			).admin.syncEnpScCommissionFromSc({ userId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.admin.listUsers.key() })
		},
	})
}

export function useUpdateUserRoleMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: { userId: string; role: UserRole }) =>
			(
				orpcClient as {
					admin: {
						updateUserRole: (input: { userId: string; role: UserRole }) => Promise<unknown>
					}
				}
			).admin.updateUserRole(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.admin.listUsers.key() })
		},
	})
}

export function useSetComplianceAccessMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: { userId: string; granted: boolean }) =>
			(
				orpcClient as {
					admin: {
						setComplianceAccess: (input: { userId: string; granted: boolean }) => Promise<AdminUser>
					}
				}
			).admin.setComplianceAccess(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.admin.listUsers.key() })
		},
	})
}

export function useSoftDeleteUserMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (userId: string) =>
			(
				orpcClient as {
					admin: { softDeleteUser: (input: { userId: string }) => Promise<{ ok: true }> }
				}
			).admin.softDeleteUser({ userId }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.admin.listUsers.key() })
		},
	})
}

export function useAdminSubOrgsQuery() {
	return useQuery<SubOrg[]>({
		...api.admin.listSubOrgs.queryOptions({
			staleTime: 30 * 1000,
		}),
	})
}

export function useAdminRegistryOversightQuery() {
	return useQuery<AdminRegistryOversightEntry[]>({
		...api.admin.registryOversight.queryOptions({
			staleTime: 30 * 1000,
		}),
	})
}

export function useAdminMaintenanceWindowsQuery(includePast = false) {
	return useQuery<MaintenanceWindow[]>({
		...api.maintenance.listForAdmin.queryOptions({
			input: { includePast },
			staleTime: 30 * 1000,
		}),
	})
}

export function useMaintenanceStatusQuery() {
	return useQuery<MaintenanceStatus>({
		...api.maintenance.getStatus.queryOptions({
			staleTime: 15 * 1000,
		}),
	})
}

export function useSetMaintenanceModeMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: SetMaintenanceModeInput) =>
			(
				orpcClient as {
					maintenance: { setMode: (input: SetMaintenanceModeInput) => Promise<MaintenanceStatus> }
				}
			).maintenance.setMode(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: api.maintenance.getStatus.key() })
		},
	})
}

async function invalidateMaintenanceQueries(queryClient: ReturnType<typeof useQueryClient>) {
	await invalidateAndBroadcastMaintenanceCache(queryClient)
}

export function useCreateMaintenanceWindowMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: CreateMaintenanceWindowInput) =>
			(
				orpcClient as {
					maintenance: {
						createForAdmin: (input: CreateMaintenanceWindowInput) => Promise<MaintenanceWindow>
					}
				}
			).maintenance.createForAdmin(input),
		onSuccess: async () => {
			await invalidateMaintenanceQueries(queryClient)
		},
	})
}

export function useCancelMaintenanceWindowMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (id: string) =>
			(
				orpcClient as {
					maintenance: { cancelForAdmin: (input: { id: string }) => Promise<{ ok: true }> }
				}
			).maintenance.cancelForAdmin({ id }),
		onSuccess: async () => {
			await invalidateMaintenanceQueries(queryClient)
		},
	})
}

export function useCompleteMaintenanceWindowMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (id: string) =>
			(
				orpcClient as {
					maintenance: { completeForAdmin: (input: { id: string }) => Promise<{ ok: true }> }
				}
			).maintenance.completeForAdmin({ id }),
		onSuccess: async () => {
			await invalidateMaintenanceQueries(queryClient)
		},
	})
}
