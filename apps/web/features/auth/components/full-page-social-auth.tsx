"use client"

import * as React from "react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"

import { getApiUrl, getAppUrl } from "@/core/lib/utils"
import { authClient } from "@/services/better-auth/auth-client"
import { AuthBrandShell } from "@/features/auth/components/auth-brand-shell"
import { AuthSignInCard } from "@/features/auth/components/auth-sign-in-card"
import { clearBetterAuthBrowserCookies } from "@/features/auth/lib/clear-better-auth-cookies"
import { savePostLoginRedirect } from "@/features/auth/lib/post-login-redirect"
import { LandingAdminLoginDialog } from "@/features/landing/components/landing-admin-login-dialog"
import { LandingSuperAdminLoginDialog } from "@/features/landing/components/landing-super-admin-login-dialog"
import { env } from "@/env"

interface SSOErrorDetails {
	message: string
	code?: string
	status?: number | string
	name?: string
	endpoint?: string
}

function extractErrorDetails(raw: unknown, endpoint: string, fallback: string): SSOErrorDetails {
	if (raw && typeof raw === "object") {
		const err = raw as Record<string, unknown>
		const message =
			(typeof err.message === "string" && err.message) ||
			(typeof err.statusText === "string" && err.statusText) ||
			fallback
		return {
			message,
			code: typeof err.code === "string" ? err.code : undefined,
			status:
				typeof err.status === "number" || typeof err.status === "string" ? err.status : undefined,
			name: typeof err.name === "string" ? err.name : undefined,
			endpoint,
		}
	}
	return { message: fallback, endpoint }
}

interface FullPageSocialAuthProps {
	mode?: "login" | "register"
	/** After OAuth, return here (e.g. guest session lobby). Falls back to dashboard/onboarding. */
	postAuthRedirectPath?: string | null
}

function AuthColumnHeading({
	isRegister,
	heading,
	subtitle,
}: {
	isRegister: boolean
	heading: string
	subtitle: string
}) {
	const badgeLabel = isRegister ? "Get started in seconds" : "Sign in to qLegal"

	const title =
		heading === "Welcome back" ? (
			<>
				Welcome back to{" "}
				<span className="bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--secondary)] bg-clip-text text-transparent">
					QLegal
				</span>
			</>
		) : (
			<>
				Create your{" "}
				<span className="bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--secondary)] bg-clip-text text-transparent">
					QLegal
				</span>{" "}
				account
			</>
		)

	return (
		<div className="space-y-2 text-center sm:space-y-3 lg:space-y-4 lg:text-left">
			<span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--background)]/60 px-2 py-0.5 font-mono text-[10px] tracking-wide text-[var(--muted-foreground)] uppercase backdrop-blur sm:px-2.5 sm:py-1 sm:text-[11px]">
				<span
					className="inline-flex size-1.5 animate-pulse rounded-full bg-[var(--chart-5)]"
					aria-hidden="true"
				/>
				{badgeLabel}
			</span>
			<div className="space-y-1 sm:space-y-2">
				<h1 className="font-poppins text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl lg:text-4xl">
					{title}
				</h1>
				<p className="font-montserrat text-xs leading-snug text-balance text-[var(--muted-foreground)] sm:hidden">
					Email or Google. New users pick Attorney/ENP or Client in onboarding.
				</p>
				<p className="font-montserrat hidden text-sm leading-relaxed text-balance text-[var(--muted-foreground)] sm:block">
					{subtitle}
				</p>
			</div>
		</div>
	)
}

export function FullPageSocialAuth({
	mode = "login",
	postAuthRedirectPath,
}: FullPageSocialAuthProps) {
	const router = useRouter()
	const [viewMode, setViewMode] = React.useState<"login" | "register">(mode)
	const [isPending, setIsPending] = React.useState(false)
	const [errorDetails, setErrorDetails] = React.useState<SSOErrorDetails | null>(null)

	React.useEffect(() => {
		setViewMode(mode)
	}, [mode])

	const isRegister = viewMode === "register"

	const switchAuthMode = React.useCallback(
		(next: "login" | "register") => {
			setViewMode(next)
			setErrorDetails(null)
			const base = next === "register" ? "/register" : "/login"
			const href = postAuthRedirectPath
				? `${base}?redirect=${encodeURIComponent(postAuthRedirectPath)}`
				: base
			router.replace(href as Route, { scroll: false })
		},
		[postAuthRedirectPath, router]
	)

	const handleContinueWithGoogle = async () => {
		setIsPending(true)
		setErrorDetails(null)

		const apiUrl = getApiUrl()
		const endpoint = `${apiUrl}/auth/sign-in/social`
		try {
			clearBetterAuthBrowserCookies()
			if (postAuthRedirectPath) {
				savePostLoginRedirect(postAuthRedirectPath)
			}
			const callbackURL = `${getAppUrl()}/oauth/callback`
			console.info("[SSO] starting Google sign-in", {
				endpoint,
				callbackURL,
			})
			const result = await authClient.signIn.social({
				provider: "google",
				callbackURL,
			})
			if (result?.error) {
				console.error("[SSO] Google sign-in returned error", {
					error: result.error,
					endpoint,
					callbackURL,
				})
				setErrorDetails(
					extractErrorDetails(
						result.error,
						endpoint,
						"Sign-in failed. Please try again or contact support."
					)
				)
				setIsPending(false)
				return
			}
			console.info("[SSO] Google sign-in dispatched (awaiting redirect)", result)
		} catch (error) {
			const err = error as {
				name?: string
				message?: string
				status?: number | string
				code?: string
				body?: unknown
				cause?: unknown
			} | null
			console.error("[SSO] Google sign-in threw", {
				name: err?.name,
				message: err?.message,
				status: err?.status,
				code: err?.code,
				body: err?.body,
				cause: err?.cause,
				endpoint,
				raw: error,
			})
			setErrorDetails(
				extractErrorDetails(
					error,
					endpoint,
					"Unexpected error starting Google sign-in. Please try again."
				)
			)
			setIsPending(false)
		}
	}

	const heading = isRegister ? "Create your account" : "Welcome back"
	const subtitle = isRegister
		? "Sign up with email or Google. First-time users choose Attorney / ENP or Client during onboarding."
		: "Sign in with email or Google. First-time users choose Attorney / ENP or Client during onboarding."

	return (
		<AuthBrandShell
			footer={
				env.NODE_ENV === "development" ? (
					<div className="flex w-full flex-col gap-2">
						<LandingAdminLoginDialog isDevAccess compact />
						<LandingSuperAdminLoginDialog isDevAccess compact />
					</div>
				) : null
			}
		>
			<AuthColumnHeading isRegister={isRegister} heading={heading} subtitle={subtitle} />

			<AuthSignInCard
				viewMode={viewMode}
				postAuthRedirectPath={postAuthRedirectPath}
				onSwitchMode={switchAuthMode}
				errorDetails={errorDetails}
				isPending={isPending}
				onGoogleSignIn={() => void handleContinueWithGoogle()}
			/>

			<motion.p
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.5, delay: 1.2 }}
				className="font-montserrat text-center text-sm text-[var(--muted-foreground)]"
			>
				{viewMode === "register" ? (
					<>
						Already have an account?{" "}
						<Link
							href={
								(postAuthRedirectPath
									? `/login?redirect=${encodeURIComponent(postAuthRedirectPath)}`
									: "/login") as Route
							}
							className="font-semibold text-[var(--foreground)] underline-offset-4 transition-colors hover:text-[var(--primary)] hover:underline"
						>
							Sign in
						</Link>
					</>
				) : (
					<>
						New to qLegal?{" "}
						<Link
							href={
								(postAuthRedirectPath
									? `/register?redirect=${encodeURIComponent(postAuthRedirectPath)}`
									: "/register") as Route
							}
							className="font-semibold text-[var(--foreground)] underline-offset-4 transition-colors hover:text-[var(--primary)] hover:underline"
						>
							Create an account
						</Link>
					</>
				)}
			</motion.p>
		</AuthBrandShell>
	)
}
