import { useQuery } from "@tanstack/react-query"

import type { MaintenanceWindow, UserProfile } from "@repo/contracts"

import { orpc } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client vs NestedClient inference gap
const api = orpc as any

export function useAuthProfileMeQuery(initialProfile?: UserProfile | null) {
	return useQuery<UserProfile>({
		...api.authProfile.me.queryOptions({
			staleTime: 60 * 1000,
		}),
		...(initialProfile !== null && initialProfile !== undefined
			? { initialData: initialProfile }
			: {}),
	})
}

export function useMaintenanceNoticesQuery() {
	return useQuery<MaintenanceWindow[]>({
		...api.maintenance.listForUser.queryOptions({
			input: {},
			staleTime: 0,
			refetchOnWindowFocus: true,
		}),
	})
}
