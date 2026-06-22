"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/core/components/ui/alert-dialog"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent } from "@/core/components/ui/card"
import { AuthEmailCredentialsForm } from "@/features/auth/components/auth-email-credentials-form"
import { AuthModeSegment } from "@/features/auth/components/auth-mode-segment"
import { AuthWhatYouGetHover } from "@/features/auth/components/auth-what-you-get-hover"
import { LegalDocumentSheet } from "@/features/auth/components/legal-document-sheet"
import { TermsPrivacyNote } from "@/features/auth/components/terms-privacy-note"

import { GoogleIcon } from "./social-icons"

interface SSOErrorDetails {
	message: string
	code?: string
	status?: number | string
	name?: string
	endpoint?: string
}

interface AuthSignInCardProps {
	viewMode: "login" | "register"
	postAuthRedirectPath?: string | null
	onSwitchMode: (next: "login" | "register") => void
	errorDetails: SSOErrorDetails | null
	isPending: boolean
	onGoogleSignIn: () => void
}

export function AuthSignInCard({
	viewMode,
	postAuthRedirectPath,
	onSwitchMode,
	errorDetails,
	isPending,
	onGoogleSignIn,
}: AuthSignInCardProps) {
	const isRegister = viewMode === "register"
	const [emailRegisterConsented, setEmailRegisterConsented] = React.useState(false)
	const [googleRegisterConsented, setGoogleRegisterConsented] = React.useState(false)
	const [googleConsentDialogOpen, setGoogleConsentDialogOpen] = React.useState(false)

	React.useEffect(() => {
		if (!isRegister) {
			setEmailRegisterConsented(false)
			setGoogleRegisterConsented(false)
			setGoogleConsentDialogOpen(false)
		}
	}, [isRegister])

	const handleGoogleButtonClick = React.useCallback(() => {
		// For login mode: go straight to OAuth. If the user somehow never accepted
		// terms, the dashboard layout modal will catch them after sign-in.
		if (!isRegister) {
			onGoogleSignIn()
			return
		}

		// For register mode: require explicit consent before OAuth.
		if (googleRegisterConsented) {
			onGoogleSignIn()
			return
		}
		setGoogleConsentDialogOpen(true)
	}, [googleRegisterConsented, isRegister, onGoogleSignIn])

	const handleConfirmGoogleConsent = React.useCallback(() => {
		setGoogleRegisterConsented(true)
		setGoogleConsentDialogOpen(false)
		// Persist a flag so the OAuth callback can call acceptTerms after redirect.
		try {
			sessionStorage.setItem("ql-terms-consented", "1")
		} catch {
			// sessionStorage unavailable (e.g. private browsing restrictions) – ignore.
		}
		onGoogleSignIn()
	}, [onGoogleSignIn])

	return (
		<motion.div
			animate={errorDetails ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
			transition={{ duration: 0.35, ease: "easeInOut" }}
		>
			<Card className="relative w-full overflow-visible border-[var(--border)] bg-[var(--card)] shadow-xl shadow-black/5 dark:shadow-black/40">
				<motion.div
					aria-hidden="true"
					className="absolute inset-x-0 top-0 h-[3px]"
					style={{
						background:
							"linear-gradient(90deg, var(--primary) 0%, var(--accent) 33%, var(--secondary) 66%, var(--chart-4) 100%, var(--primary) 200%)",
						backgroundSize: "200% 100%",
					}}
					animate={{
						backgroundPosition: ["0% 0%", "-200% 0%"],
					}}
					transition={{
						duration: 12,
						repeat: Infinity,
						ease: "linear",
					}}
				/>

				<CardContent className="flex flex-col gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-6 lg:gap-6 lg:px-6 lg:py-8">
					<AuthModeSegment mode={viewMode} onChange={onSwitchMode} />

					<AuthEmailCredentialsForm
						mode={viewMode}
						postAuthRedirectPath={postAuthRedirectPath}
						consented={emailRegisterConsented}
						onConsentChange={setEmailRegisterConsented}
						onConsented={() => setEmailRegisterConsented(true)}
					/>

					<div className="flex items-center gap-3 font-mono text-[10px] tracking-widest text-[var(--muted-foreground)] uppercase">
						<div className="h-px flex-1 bg-[var(--border)] opacity-70" />
						<span>Or continue with</span>
						<div className="h-px flex-1 bg-[var(--border)] opacity-70" />
					</div>

					<AnimatePresence>
						{errorDetails && (
							<motion.div
								initial={{ opacity: 0, height: 0, y: -10 }}
								animate={{ opacity: 1, height: "auto", y: 0 }}
								exit={{ opacity: 0, height: 0, y: -10 }}
								className="flex gap-3 overflow-hidden rounded-r-md border-y border-r border-l-[4px] border-[var(--border)] border-[var(--destructive)] bg-[var(--destructive)]/8 p-4 text-left"
								role="alert"
								aria-live="polite"
							>
								<span className="shrink-0 text-[var(--destructive)]">
									<svg
										className="size-5 text-[var(--destructive)]"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={2}
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M12 9v4M12 17h.01" />
										<path
											d="M12 2L2 7v5c0 5.25 4.2 9.4 10 11 5.8-1.6 10-5.75 10-11V7L12 2z"
											fill="currentColor"
											fillOpacity={0.1}
										/>
									</svg>
								</span>
								<div className="min-w-0 flex-1">
									<p className="font-montserrat text-xs font-semibold text-[var(--destructive)]">
										{errorDetails.message}
									</p>
								</div>
							</motion.div>
						)}
					</AnimatePresence>

					<div className="transition-transform hover:scale-[1.02] active:scale-[0.98]">
						<Button
							className="font-montserrat relative flex h-10 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border-0 text-sm font-semibold text-white shadow-md sm:h-11 lg:h-12"
							style={{
								background:
									"linear-gradient(135deg, var(--primary) 0%, var(--accent) 40%, var(--secondary) 75%, var(--chart-4) 100%)",
								backgroundSize: "150% 150%",
							}}
							disabled={isPending}
							onClick={handleGoogleButtonClick}
						>
							<span className="z-10 flex size-5 shrink-0 items-center justify-center">
								<GoogleIcon />
							</span>
							<span className="z-10 font-bold tracking-wide">
								{isPending ? "Redirecting…" : "Continue with Google"}
							</span>
							<span className="pointer-events-none absolute inset-0 bg-white/0 transition-colors duration-200 hover:bg-white/10" />
						</Button>
					</div>

					<AlertDialog open={googleConsentDialogOpen} onOpenChange={setGoogleConsentDialogOpen}>
						<AlertDialogContent className="sm:max-w-md">
							<AlertDialogHeader>
								<AlertDialogTitle className="font-poppins">Data Privacy Consent</AlertDialogTitle>
								<AlertDialogDescription className="font-montserrat text-xs leading-relaxed">
									To register with Google you must acknowledge that your personal information will
									be collected and processed under Philippine law. Tap the links below to read the
									full documents.
								</AlertDialogDescription>
							</AlertDialogHeader>

							{/* Legal doc links */}
							<div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3">
								<div className="flex items-center gap-2">
									<span className="font-montserrat text-[11px] text-[var(--muted-foreground)]">
										1.{" "}
									</span>
									<LegalDocumentSheet document="ra10173" />
								</div>
								<div className="flex items-center gap-2">
									<span className="font-montserrat text-[11px] text-[var(--muted-foreground)]">
										2.{" "}
									</span>
									<LegalDocumentSheet document="enb-guidelines" />
								</div>
							</div>

							<div className="-mt-1">
								<TermsPrivacyNote
									id="google-terms-privacy-consent"
									consentRequired
									consented={googleRegisterConsented}
									onConsentChange={setGoogleRegisterConsented}
									onConsented={() => setGoogleRegisterConsented(true)}
								/>
							</div>

							<AlertDialogFooter>
								<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
								<AlertDialogAction
									disabled={isPending || !googleRegisterConsented}
									onClick={e => {
										e.preventDefault()
										handleConfirmGoogleConsent()
									}}
								>
									Continue with Google
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>

					<AuthWhatYouGetHover className="-mt-1 sm:-mt-2" />
				</CardContent>
			</Card>
		</motion.div>
	)
}
