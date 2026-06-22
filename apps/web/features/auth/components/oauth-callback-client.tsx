"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"

import { authClient } from "@/services/better-auth/auth-client"
import { orpcClient } from "@/services/orpc/client"
import { navigateToMfa } from "@/features/auth/lib/navigate-after-auth"
import { clearPendingOAuthRole } from "@/features/auth/lib/oauth-pending-role"

interface OAuthCallbackMfaClient {
	emailMfa: {
		requestOtp: () => Promise<{ expiresAt: string; resendAvailableAt: string }>
	}
	authProfile: {
		acceptTerms: () => Promise<{ acceptedAt: string }>
	}
}

export function OAuthCallbackClient() {
	const router = useRouter()
	const ran = React.useRef(false)
	const { data: session, isPending: sessionPending } = authClient.useSession()

	React.useEffect(() => {
		if (sessionPending || ran.current) return
		if (!session?.user?.id) {
			router.replace("/login")
			return
		}
		ran.current = true

		void (async () => {
			clearPendingOAuthRole()

			// If the user explicitly consented to terms before the OAuth redirect,
			// persist acceptance to the DB now so the dashboard modal is skipped.
			try {
				if (sessionStorage.getItem("ql-terms-consented") === "1") {
					sessionStorage.removeItem("ql-terms-consented")
					await (orpcClient as unknown as OAuthCallbackMfaClient).authProfile.acceptTerms()
				}
			} catch (error) {
				console.error("[OAuth] acceptTerms after consent flag failed", error)
			}

			try {
				await (orpcClient as unknown as OAuthCallbackMfaClient).emailMfa.requestOtp()
			} catch (error) {
				console.error("[OAuth] MFA OTP request failed after Google sign-in", error)
			}
			await navigateToMfa(router)
		})()
	}, [sessionPending, session?.user?.id, router])

	return (
		<div className="bg-background relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden">
			{/* Ambient background decoration */}
			<div
				className="pointer-events-none absolute inset-0 opacity-[0.1]"
				style={{
					background: "radial-gradient(circle at center, var(--primary) 0%, transparent 50%)",
				}}
			/>

			<motion.div
				className="relative z-10 flex flex-col items-center justify-center gap-6"
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.5, ease: "easeOut" }}
			>
				<div className="border-border bg-card relative flex size-20 items-center justify-center rounded-2xl border shadow-(--primary)/10 shadow-2xl">
					{/* Custom brand-colored spinner */}
					<motion.svg
						className="text-primary size-8"
						animate={{ rotate: 360 }}
						transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle
							className="opacity-20"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							strokeWidth="4"
						/>
						<path
							className="opacity-80"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						/>
					</motion.svg>
				</div>
				<p className="font-montserrat text-muted-foreground text-sm font-medium tracking-wide">
					Authenticating securely…
				</p>
			</motion.div>
		</div>
	)
}
