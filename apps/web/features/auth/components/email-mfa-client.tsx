"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { motion } from "motion/react"

import { authClient } from "@/services/better-auth/auth-client"
import { orpc, orpcClient } from "@/services/orpc/client"
import { destroyQlegalSocket } from "@/services/ws/ws-client"
import { sessionKeys } from "@/features/auth/api/session.hooks"
import { AuthBrandShell } from "@/features/auth/components/auth-brand-shell"
import { AuthOtpCard } from "@/features/auth/components/auth-otp-card"
import { AuthStepHeading } from "@/features/auth/components/auth-step-heading"
import { clearBetterAuthBrowserCookies } from "@/features/auth/lib/clear-better-auth-cookies"
import { navigateAfterAuth } from "@/features/auth/lib/navigate-after-auth"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap vs contract router
const api = orpc as any

type EmailMfaOtpWindow = {
	expiresAt: string
	resendAvailableAt: string
}

interface EmailMfaClientApi {
	emailMfa: {
		status: () => Promise<{
			mfaVerified: boolean
			expiresAt: string | null
			resendAvailableAt: string | null
		}>
		requestOtp: () => Promise<{ expiresAt: string; resendAvailableAt: string }>
		verifyOtp: (p: { otp: string }) => Promise<{ ok: true }>
	}
}

function msUntilFrom(iso: string | null, nowMs: number): number {
	if (!iso) return 0
	const t = new Date(iso).getTime()
	return Math.max(0, t - nowMs)
}

export function EmailMfaClient() {
	const router = useRouter()
	const queryClient = useQueryClient()
	const [otp, setOtp] = React.useState("")
	const [nowMs, setNowMs] = React.useState(() => Date.now())
	const [lastKnownOtpWindow, setLastKnownOtpWindow] = React.useState<EmailMfaOtpWindow | null>(null)
	const navigatedAfterVerificationRef = React.useRef(false)

	React.useEffect(() => {
		const id = window.setInterval(() => setNowMs(Date.now()), 1000)
		return () => window.clearInterval(id)
	}, [])

	const statusQuery = useQuery({
		...api.emailMfa.status.queryOptions(),
		retry: false,
		refetchOnWindowFocus: true,
	})

	const navigateAfterVerification = React.useCallback(async () => {
		if (navigatedAfterVerificationRef.current) return
		navigatedAfterVerificationRef.current = true
		await navigateAfterAuth(router, null, { documentReload: true })
	}, [router])

	const verifyOtp = useMutation({
		mutationFn: async (payload: { otp: string }) =>
			(orpcClient as unknown as EmailMfaClientApi).emailMfa.verifyOtp(payload),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: sessionKeys.all })
			await statusQuery.refetch()
			await navigateAfterVerification()
		},
	})

	const requestOtp = useMutation({
		mutationFn: async () => (orpcClient as unknown as EmailMfaClientApi).emailMfa.requestOtp(),
		onSuccess: async result => {
			setOtp("")
			verifyOtp.reset()
			setLastKnownOtpWindow(result)
			setNowMs(Date.now())
			await statusQuery.refetch()
		},
	})

	const status = statusQuery.data as
		| { mfaVerified: boolean; expiresAt: string | null; resendAvailableAt: string | null }
		| undefined
	const expiresAtIso = status?.expiresAt ?? lastKnownOtpWindow?.expiresAt ?? null
	const resendAvailableAtIso =
		status?.resendAvailableAt ?? lastKnownOtpWindow?.resendAvailableAt ?? null

	React.useEffect(() => {
		if (!status || statusQuery.isPending) return
		if (status.mfaVerified) {
			void navigateAfterVerification()
		}
	}, [status?.mfaVerified, statusQuery.isPending, navigateAfterVerification])

	React.useEffect(() => {
		const expiresAt = status?.expiresAt
		const resendAvailableAt = status?.resendAvailableAt
		if (!expiresAt || !resendAvailableAt) return

		const latestOtpWindow: EmailMfaOtpWindow = { expiresAt, resendAvailableAt }
		setLastKnownOtpWindow(current => {
			if (
				current?.expiresAt === latestOtpWindow.expiresAt &&
				current.resendAvailableAt === latestOtpWindow.resendAvailableAt
			) {
				return current
			}
			return latestOtpWindow
		})
	}, [status?.expiresAt, status?.resendAvailableAt])

	const secondsLeft = expiresAtIso ? Math.ceil(msUntilFrom(expiresAtIso, nowMs) / 1000) : 0
	const resendMs = resendAvailableAtIso ? msUntilFrom(resendAvailableAtIso, nowMs) : 0
	const canResend = resendMs <= 0 && !requestOtp.isPending
	const expired = Boolean(status && !status.mfaVerified && expiresAtIso && secondsLeft <= 0)
	const busy = statusQuery.isPending || requestOtp.isPending
	const hasKnownOtpWindow = Boolean(expiresAtIso)

	const handleSignOut = React.useCallback(async () => {
		try {
			await authClient.signOut()
		} catch (error) {
			console.error("[MFA] sign-out failed", error)
		}
		clearBetterAuthBrowserCookies()
		destroyQlegalSocket()
		queryClient.clear()
		window.location.replace("/login")
	}, [queryClient])

	return (
		<AuthBrandShell desktopAlign="center">
			<AuthStepHeading
				badge="Security step"
				title={
					<>
						Multi‑factor{" "}
						<span className="bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--secondary)] bg-clip-text text-transparent">
							authentication
						</span>
					</>
				}
				subtitle="One more step. Confirm the 6-digit code we sent to your registered email to keep your account secure."
			/>

			<AuthOtpCard
				otp={otp}
				onOtpChange={setOtp}
				expiresAtIso={expiresAtIso}
				secondsLeft={secondsLeft}
				expired={expired}
				busy={busy}
				verifyDisabled={
					otp.trim().length !== 6 || verifyOtp.isPending || expired || !hasKnownOtpWindow
				}
				verifyLoading={verifyOtp.isPending}
				verifyLabel="Continue"
				verifyingLabel="Verifying…"
				onVerify={() => verifyOtp.mutate({ otp })}
				verifyError={expired ? null : verifyOtp.error}
				canResend={canResend}
				resendMs={resendMs}
				resendLoading={requestOtp.isPending}
				onResend={() => requestOtp.mutate()}
				preparingLabel="Preparing your MFA code…"
				noActiveCodeMessage="No active code is available. Select Resend code to receive a new one."
			/>

			<motion.p
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.5, delay: 0.4 }}
				className="font-montserrat text-center text-sm text-[var(--muted-foreground)]"
			>
				Not your account?{" "}
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
		</AuthBrandShell>
	)
}
