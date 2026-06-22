"use client"

import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"

import { authClient } from "@/services/better-auth/auth-client"
import { destroyQlegalSocket } from "@/services/ws/ws-client"
import { clearBetterAuthBrowserCookies } from "@/features/auth/lib/clear-better-auth-cookies"

/**
 * Centralized query keys for session-related queries.
 * Use these constants to ensure consistent cache invalidation.
 */
export const sessionKeys = {
	all: ["session"] as const,
}

/**
 * Query hook for fetching the current user session.
 *
 * Session is cached for 5 minutes before becoming stale.
 * Uses Better Auth client which automatically handles cookies.
 */
export const sessionOptions = queryOptions({
	queryKey: sessionKeys.all,
	queryFn: async () => {
		const result = await authClient.getSession()
		if (result.error) {
			return null
		}
		return result.data
	},
	staleTime: 5 * 60 * 1000, // 5 minutes
	retry: 8,
	retryDelay: attempt => Math.min(500 * attempt, 3_000),
	refetchOnWindowFocus: true,
	refetchOnReconnect: true,
})

/**
 * Mutation hook for signing out the current user.
 *
 * Invalidates the session query and redirects to home page on success.
 */
export function useSignOutMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async () => {
			const result = await authClient.signOut()
			if (result.error) {
				throw new Error(result.error.message || "Failed to sign out")
			}
			return result
		},
		onSettled: () => {
			clearBetterAuthBrowserCookies()
			destroyQlegalSocket()
			queryClient.clear()
			window.location.replace("/login")
		},
	})
}
