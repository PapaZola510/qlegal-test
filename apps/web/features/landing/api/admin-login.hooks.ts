"use client"

import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { getApiUrl } from "@/core/lib/utils"
import { authClient } from "@/services/better-auth/auth-client"
import { sessionKeys } from "@/features/auth/api/session.hooks"
import { ADMIN_LANDING_EMAIL, resolveAdminLandingEmail } from "@/features/landing/lib/admin-login"

async function syncDevAdminPlatformRole(): Promise<void> {
	const res = await fetch(`${getApiUrl()}/dev/sync-admin-role`, {
		method: "POST",
		credentials: "include",
	})
	if (!res.ok) {
		const text = await res.text().catch(() => "")
		throw new Error(text || "Failed to grant admin platform role")
	}
}

export function useAdminLandingLoginMutation() {
	const router = useRouter()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: { username: string; password: string }) => {
			const email = resolveAdminLandingEmail(input.username)
			const signIn = await authClient.signIn.email({
				email,
				password: input.password,
			})
			if (!signIn.error) {
				if (email === ADMIN_LANDING_EMAIL) {
					await syncDevAdminPlatformRole()
				}
				return signIn
			}

			const signUp = await authClient.signUp.email({
				email,
				password: input.password,
				name: "Electronic Notary Administrator",
			})
			if (signUp.error) {
				throw new Error(
					signUp.error.message || signIn.error.message || "Failed to sign in as admin"
				)
			}

			const retry = await authClient.signIn.email({ email, password: input.password })
			if (retry.error) {
				throw new Error(retry.error.message || "Admin account created but sign-in failed")
			}
			if (email === ADMIN_LANDING_EMAIL) {
				await syncDevAdminPlatformRole()
			}
			return retry
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: sessionKeys.all })
			router.push("/admin")
			router.refresh()
		},
	})
}
