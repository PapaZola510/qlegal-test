"use client"

import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { authClient } from "@/services/better-auth/auth-client"
import { orpcClient } from "@/services/orpc/client"
import { sessionKeys } from "@/features/auth/api/session.hooks"
import { navigateToMfa } from "@/features/auth/lib/navigate-after-auth"

import type { Register } from "./register.schema"

export function useRegisterMutation(options?: { postAuthRedirectPath?: string | null }) {
	const router = useRouter()
	const queryClient = useQueryClient()
	void options

	return useMutation({
		mutationFn: async (data: Register) => {
			const result = await authClient.signUp.email(data)
			if (result.error) {
				throw new Error(result.error.message || "Failed to sign up")
			}
			return result
		},
		onSuccess: async () => {
			queryClient.removeQueries()
			await queryClient.invalidateQueries({ queryKey: sessionKeys.all })
			// Record T&C acceptance — user explicitly checked the box before submitting.
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				await (orpcClient as any).authProfile.acceptTerms()
			} catch {
				// Best-effort; the layout gate will catch any users who slip through.
			}
			// Fire-and-forget: request OTP after registration so the email arrives quickly.
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI inference gap
				await (orpcClient as any).emailMfa.requestOtp()
			} catch {
				// Ignore (e.g. rate limit) — the verify page can request when needed.
			}
			await navigateToMfa(router)
		},
	})
}
