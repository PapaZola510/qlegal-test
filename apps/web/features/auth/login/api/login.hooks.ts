"use client"

import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { authClient } from "@/services/better-auth/auth-client"
import { orpcClient } from "@/services/orpc/client"
import { sessionKeys } from "@/features/auth/api/session.hooks"
import { navigateToMfa } from "@/features/auth/lib/navigate-after-auth"

import type { Login } from "./login.schema"

export function useLoginMutation(options?: { postAuthRedirectPath?: string | null }) {
	const router = useRouter()
	const queryClient = useQueryClient()
	void options

	return useMutation({
		mutationFn: async (data: Login) => {
			const result = await authClient.signIn.email(data)
			if (result.error) {
				throw new Error(result.error.message || "Failed to sign in")
			}
			return result
		},
		onSuccess: async () => {
			queryClient.removeQueries()
			await queryClient.invalidateQueries({ queryKey: sessionKeys.all })
			// Trigger email MFA OTP on every login (best-effort).
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI inference gap
				await (orpcClient as any).emailMfa.requestOtp()
			} catch {
				// Ignore; /mfa page can request if needed.
			}
			await navigateToMfa(router)
		},
	})
}
