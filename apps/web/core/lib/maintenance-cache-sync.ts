"use client"

import { useEffect } from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"

import { orpc } from "@/services/orpc/client"

const MAINTENANCE_CACHE_CHANNEL = "qlegal-maintenance-cache"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
const api = orpc as any

export async function invalidateMaintenanceCacheQueries(queryClient: QueryClient) {
	await Promise.all([
		queryClient.invalidateQueries({
			queryKey: api.maintenance.listForAdmin.key(),
			refetchType: "all",
		}),
		queryClient.invalidateQueries({
			queryKey: api.maintenance.listForUser.key(),
			refetchType: "all",
		}),
	])
}

export function broadcastMaintenanceCacheInvalidation() {
	if (typeof window === "undefined") return
	new BroadcastChannel(MAINTENANCE_CACHE_CHANNEL).postMessage({ type: "invalidated" })
}

/** Invalidate in this tab and notify other open tabs (e.g. user dashboard). */
export async function invalidateAndBroadcastMaintenanceCache(queryClient: QueryClient) {
	await invalidateMaintenanceCacheQueries(queryClient)
	broadcastMaintenanceCacheInvalidation()
}

export function MaintenanceCacheSyncListener() {
	const queryClient = useQueryClient()

	useEffect(() => {
		if (typeof window === "undefined") return
		const channel = new BroadcastChannel(MAINTENANCE_CACHE_CHANNEL)
		channel.onmessage = () => {
			void invalidateMaintenanceCacheQueries(queryClient)
		}
		return () => channel.close()
	}, [queryClient])

	return null
}
