"use client"

import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { getApiUrl } from "@/core/lib/utils"
import { authClient } from "@/services/better-auth/auth-client"
import { sessionKeys } from "@/features/auth/api/session.hooks"
import {
	resolveSuperAdminLandingEmail,
	SUPER_ADMIN_LANDING_EMAIL,
} from "@/features/landing/lib/super-admin-login"

async function syncDevSuperAdminPlatformRole(): Promise<void> {
	const res = await fetch(`${getApiUrl()}/dev/sync-admin-role`, {
		method: "POST",
		credentials: "include",
	})
	if (!res.ok) {
		const text = await res.text().catch(() => "")
		throw new Error(text || "Failed to grant super admin platform role")
	}
}

export function useSuperAdminLandingLoginMutation() {
	const router = useRouter()
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: { username: string; password: string }) => {
			const email = resolveSuperAdminLandingEmail(input.username)
			const signIn = await authClient.signIn.email({
				email,
				password: input.password,
			})
			if (!signIn.error) {
				if (email === SUPER_ADMIN_LANDING_EMAIL) {
					await syncDevSuperAdminPlatformRole()
				}
				return signIn
			}

			const signUp = await authClient.signUp.email({
				email,
				password: input.password,
				name: "Super Admin",
			})
			if (signUp.error) {
				throw new Error(
					signUp.error.message || signIn.error.message || "Failed to sign in as super admin"
				)
			}

			const retry = await authClient.signIn.email({ email, password: input.password })
			if (retry.error) {
				throw new Error(retry.error.message || "Super admin account created but sign-in failed")
			}
			if (email === SUPER_ADMIN_LANDING_EMAIL) {
				await syncDevSuperAdminPlatformRole()
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
