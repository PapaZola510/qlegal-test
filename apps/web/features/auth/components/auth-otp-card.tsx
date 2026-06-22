"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"

import { Button } from "@/core/components/ui/button"
import { Card, CardContent } from "@/core/components/ui/card"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/core/components/ui/input-otp"
import { Spinner } from "@/core/components/ui/spinner"
import { cn } from "@/core/lib/utils"

interface AuthOtpCardProps {
	otp: string
	onOtpChange: (next: string) => void
	expiresAtIso: string | null
	secondsLeft: number
	expired: boolean
	busy: boolean
	verifyDisabled: boolean
	verifyLoading: boolean
	verifyLabel: string
	verifyingLabel: string
	onVerify: () => void
	verifyError: unknown | null
	canResend: boolean
	resendMs: number
	resendLoading: boolean
	onResend: () => void
	preparingLabel: string
	noActiveCodeMessage?: string
}

function formatSeconds(totalSeconds: number): string {
	const s = Math.max(0, Math.floor(totalSeconds))
	const m = Math.floor(s / 60)
	const r = s % 60
	return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
}

/**
 * Shared OTP card body used by /mfa and /verify-email. Matches the visual
 * language of the login card: card with animated gradient header strip,
 * OTP slots, gradient primary button, secondary resend button.
 */
export function AuthOtpCard({
	otp,
	onOtpChange,
	expiresAtIso,
	secondsLeft,
	expired,
	busy,
	verifyDisabled,
	verifyLoading,
	verifyLabel,
	verifyingLabel,
	onVerify,
	verifyError,
	canResend,
	resendMs,
	resendLoading,
	onResend,
	preparingLabel,
	noActiveCodeMessage,
}: AuthOtpCardProps) {
	const hasError = Boolean(verifyError) || expired
	const hasActiveCode = Boolean(expiresAtIso)
	return (
		<motion.div
			animate={hasError ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
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

				<CardContent className="flex flex-col gap-4 px-4 py-5 sm:gap-5 sm:px-5 sm:py-6 lg:gap-6 lg:px-6 lg:py-7">
					<div className="space-y-1.5">
						<p className="font-montserrat text-sm leading-relaxed text-[var(--muted-foreground)]">
							{!hasActiveCode && noActiveCodeMessage ? (
								noActiveCodeMessage
							) : (
								<>
									Enter the 6-digit code we sent to your email. The code expires in{" "}
									<span
										className={cn(
											"font-mono font-medium tabular-nums",
											expired ? "text-[var(--destructive)]" : "text-[var(--foreground)]"
										)}
									>
										{expiresAtIso ? formatSeconds(secondsLeft) : "05:00"}
									</span>
									.
								</>
							)}
						</p>
					</div>

					{busy ? (
						<div className="text-muted-foreground flex items-center gap-3 text-sm">
							<Spinner className="h-4 w-4" />
							<span>{preparingLabel}</span>
						</div>
					) : null}

					<div className="flex flex-col items-center gap-3">
						<InputOTP
							maxLength={6}
							value={otp}
							onChange={onOtpChange}
							disabled={verifyLoading}
							autoFocus
							inputMode="numeric"
							pattern="[0-9]*"
							containerClassName="cursor-text"
						>
							<InputOTPGroup className="gap-1 sm:gap-1.5">
								{Array.from({ length: 6 }).map((_, i) => (
									<InputOTPSlot
										key={i}
										index={i}
										className="size-10 rounded-md border-l text-base font-semibold tabular-nums shadow-sm sm:size-11 sm:text-lg"
									/>
								))}
							</InputOTPGroup>
						</InputOTP>

						<AnimatePresence>
							{verifyError ? (
								<motion.div
									initial={{ opacity: 0, height: 0, y: -10 }}
									animate={{ opacity: 1, height: "auto", y: 0 }}
									exit={{ opacity: 0, height: 0, y: -10 }}
									className="flex w-full gap-3 overflow-hidden rounded-r-md border-y border-r border-l-[4px] border-[var(--border)] border-[var(--destructive)] bg-[var(--destructive)]/8 p-3 text-left"
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
											{verifyError instanceof Error ? verifyError.message : "Verification failed."}
										</p>
									</div>
								</motion.div>
							) : null}
						</AnimatePresence>

						{!verifyError && expired ? (
							<p className="font-montserrat w-full text-left text-xs font-semibold text-[var(--destructive)]">
								Your code has expired. Please request a new one.
							</p>
						) : null}
					</div>

					<div className="flex flex-col gap-2.5 sm:gap-3">
						<div className="transition-transform hover:scale-[1.01] active:scale-[0.99]">
							<Button
								type="button"
								onClick={onVerify}
								disabled={verifyDisabled}
								className="font-montserrat relative flex h-10 w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg border-0 text-sm font-semibold text-white shadow-md sm:h-11 lg:h-12"
								style={{
									background:
										"linear-gradient(135deg, var(--primary) 0%, var(--accent) 40%, var(--secondary) 75%, var(--chart-4) 100%)",
									backgroundSize: "150% 150%",
								}}
							>
								<span className="z-10 font-bold tracking-wide">
									{verifyLoading ? verifyingLabel : verifyLabel}
								</span>
								<span className="pointer-events-none absolute inset-0 bg-white/0 transition-colors duration-200 hover:bg-white/10" />
							</Button>
						</div>

						<Button
							type="button"
							variant="outline"
							onClick={onResend}
							disabled={!canResend}
							className="font-montserrat h-10 w-full cursor-pointer rounded-lg text-sm font-medium sm:h-11"
						>
							{resendLoading
								? "Sending…"
								: resendMs > 0
									? `Resend available in ${formatSeconds(Math.ceil(resendMs / 1000))}`
									: "Resend code"}
						</Button>
					</div>
				</CardContent>
			</Card>
		</motion.div>
	)
}
