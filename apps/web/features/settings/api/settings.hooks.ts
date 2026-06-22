"use client"

import { useMutation, useQuery } from "@tanstack/react-query"

import { authClient } from "@/services/better-auth/auth-client"
import { getAuthUrl } from "@/services/better-auth/lib/utils"
import { orpc, orpcClient } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
const api = orpc as any

interface LinkedAccount {
	id: string
	providerId: string
	accountId: string
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${getAuthUrl()}${path}`, {
		credentials: "include",
		headers: { "Content-Type": "application/json", ...init?.headers },
		...init,
	})
	const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | T
	if (!res.ok) {
		const message =
			(body && typeof body === "object" && ("message" in body || "error" in body)
				? (body.message ?? body.error)
				: null) ?? `Request failed (${res.status})`
		throw new Error(message)
	}
	return body as T
}

export function useLinkedAccountsQuery() {
	return useQuery({
		queryKey: ["auth", "linked-accounts"],
		queryFn: async () => {
			const data = await authFetch<LinkedAccount[] | { accounts?: LinkedAccount[] }>(
				"/list-accounts"
			)
			if (Array.isArray(data)) return data
			return data.accounts ?? []
		},
		staleTime: 60_000,
	})
}

export function useEmailMfaStatusQuery() {
	return useQuery({
		...api.emailMfa.status.queryOptions(),
		staleTime: 30_000,
	})
}

export function useChangePasswordMutation() {
	return useMutation({
		mutationFn: async (input: { currentPassword: string; newPassword: string }) => {
			const client = authClient as typeof authClient & {
				changePassword?: (payload: {
					currentPassword: string
					newPassword: string
					revokeOtherSessions?: boolean
				}) => Promise<{ error?: { message?: string } | null }>
			}

			if (client.changePassword) {
				const result = await client.changePassword({
					...input,
					revokeOtherSessions: true,
				})
				if (result.error) {
					throw new Error(result.error.message ?? "Could not change password")
				}
				return
			}

			await authFetch("/change-password", {
				method: "POST",
				body: JSON.stringify({ ...input, revokeOtherSessions: true }),
			})
		},
	})
}

export function useRevokeOtherSessionsMutation() {
	return useMutation({
		mutationFn: async () => {
			const client = authClient as typeof authClient & {
				revokeOtherSessions?: () => Promise<{ error?: { message?: string } | null }>
			}

			if (client.revokeOtherSessions) {
				const result = await client.revokeOtherSessions()
				if (result.error) {
					throw new Error(result.error.message ?? "Could not revoke sessions")
				}
				return
			}

			await authFetch("/revoke-other-sessions", { method: "POST" })
		},
	})
}

interface EmailMfaRequestClient {
	emailMfa: { requestOtp: () => Promise<unknown> }
}

export function useRequestEmailMfaOtpMutation() {
	return useMutation({
		mutationFn: async () => (orpcClient as unknown as EmailMfaRequestClient).emailMfa.requestOtp(),
	})
}
