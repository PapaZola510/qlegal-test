"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { motion } from "motion/react"

import { authClient } from "@/services/better-auth/auth-client"
import { orpc, orpcClient } from "@/services/orpc/client"
import { sessionKeys } from "@/features/auth/api/session.hooks"
import { AuthBrandShell } from "@/features/auth/components/auth-brand-shell"
import { AuthOtpCard } from "@/features/auth/components/auth-otp-card"
import { AuthStepHeading } from "@/features/auth/components/auth-step-heading"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap vs contract router
const api = orpc as any

interface EmailVerificationClient {
	emailVerification: {
		status: () => Promise<{
			emailVerified: boolean
			expiresAt: string | null
			resendAvailableAt: string | null
		}>
		requestOtp: () => Promise<{ expiresAt: string; resendAvailableAt: string }>
		verifyOtp: (p: { otp: string }) => Promise<{ ok: true }>
	}
}

function msUntil(iso: string | null): number {
	if (!iso) return 0
	const t = new Date(iso).getTime()
	return Math.max(0, t - Date.now())
}

export function VerifyEmailClient() {
	const router = useRouter()
	const queryClient = useQueryClient()
	const [otp, setOtp] = React.useState("")
	const [tick, setTick] = React.useState(0)

	React.useEffect(() => {
		const id = window.setInterval(() => setTick(t => t + 1), 250)
		return () => window.clearInterval(id)
	}, [])

	const statusQuery = useQuery({
		...api.emailVerification.status.queryOptions(),
		retry: false,
		refetchOnWindowFocus: true,
	})

	const requestOtp = useMutation({
		mutationFn: async () =>
			(orpcClient as unknown as EmailVerificationClient).emailVerification.requestOtp(),
		onSuccess: async () => {
			await statusQuery.refetch()
		},
	})

	const verifyOtp = useMutation({
		mutationFn: async (payload: { otp: string }) =>
			(orpcClient as unknown as EmailVerificationClient).emailVerification.verifyOtp(payload),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: sessionKeys.all })
			await statusQuery.refetch()
			router.replace("/dashboard")
			router.refresh()
		},
	})

	const status = statusQuery.data as
		| { emailVerified: boolean; expiresAt: string | null; resendAvailableAt: string | null }
		| undefined

	React.useEffect(() => {
		if (!status || statusQuery.isPending) return
		if (status.emailVerified) {
			router.replace("/dashboard")
			router.refresh()
			return
		}
		if (!status.expiresAt && !requestOtp.isPending && !requestOtp.isSuccess) {
			requestOtp.mutate()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [status?.emailVerified, status?.expiresAt, statusQuery.isPending])

	const secondsLeft = status?.expiresAt ? Math.ceil(msUntil(status.expiresAt) / 1000) : 0
	const resendMs = status?.resendAvailableAt ? msUntil(status.resendAvailableAt) : 0
	const canResend = resendMs <= 0 && !requestOtp.isPending
	const expired = Boolean(status && !status.emailVerified && status.expiresAt && secondsLeft <= 0)
	const busy = statusQuery.isPending || requestOtp.isPending

	const handleSignOut = React.useCallback(async () => {
		try {
			await authClient.signOut()
		} catch (error) {
			console.error("[Verify-Email] sign-out failed", error)
		}
		await queryClient.invalidateQueries({ queryKey: sessionKeys.all })
		router.replace("/login")
		router.refresh()
	}, [queryClient, router])

	return (
		<AuthBrandShell desktopAlign="center">
			<AuthStepHeading
				badge="Verify your email"
				title={
					<>
						Confirm your{" "}
						<span className="bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--secondary)] bg-clip-text text-transparent">
							email address
						</span>
					</>
				}
				subtitle="We sent a 6-digit verification code to your inbox. Enter it below to finish setting up your account."
			/>

			<AuthOtpCard
				otp={otp}
				onOtpChange={setOtp}
				expiresAtIso={status?.expiresAt ?? null}
				secondsLeft={secondsLeft}
				expired={expired}
				busy={busy}
				verifyDisabled={otp.trim().length !== 6 || verifyOtp.isPending || expired}
				verifyLoading={verifyOtp.isPending}
				verifyLabel="Verify email"
				verifyingLabel="Verifying…"
				onVerify={() => verifyOtp.mutate({ otp })}
				verifyError={verifyOtp.error}
				canResend={canResend}
				resendMs={resendMs}
				resendLoading={requestOtp.isPending}
				onResend={() => requestOtp.mutate()}
				preparingLabel="Preparing your verification code…"
			/>

			<p className="text-muted-foreground text-center text-xs">
				If you don’t see the email, check your spam folder. For local dev without SMTP/Resend
				configured, the code may be logged by the backend email adapter.
			</p>

			<motion.p
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.5, delay: 0.4 }}
				className="font-montserrat text-center text-sm text-[var(--muted-foreground)]"
			>
				Wrong account?{" "}
				<Link
					href="/login"
					onClick={e => {
						e.preventDefault()
						void handleSignOut()
					}}
					className="font-semibold text-[var(--foreground)] underline-offset-4 transition-colors hover:text-[var(--primary)] hover:underline"
				>
					Sign out
				</Link>
			</motion.p>

			<span className="hidden">{tick}</span>
		</AuthBrandShell>
	)
}
