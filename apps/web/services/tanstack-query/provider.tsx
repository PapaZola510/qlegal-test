"use client"

import {
	dehydrate,
	HydrationBoundary,
	QueryClientProvider,
	type QueryClient,
} from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

import { MaintenanceCacheSyncListener } from "@/core/lib/maintenance-cache-sync"

import { getQueryClient } from "./query-client"

export function QueryProvider({ children }: Readonly<{ children: React.ReactNode }>) {
	const queryClient = getQueryClient()

	return (
		<QueryClientProvider client={queryClient}>
			<MaintenanceCacheSyncListener />
			{children}
			<ReactQueryDevtools />
		</QueryClientProvider>
	)
}

interface HydrateClientProps {
	children: React.ReactNode
	client: QueryClient
}

/**
 * Wraps children with HydrationBoundary so dehydrated state from the given QueryClient
 * is hydrated on the client. Use from server components after prefetching.
 */
export function HydrateClient({ children, client }: HydrateClientProps) {
	return <HydrationBoundary state={dehydrate(client)}>{children}</HydrationBoundary>
}
