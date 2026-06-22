"use client"

import { motion } from "motion/react"

import { cn } from "@/core/lib/utils"

interface AuthModeSegmentProps {
	mode: "login" | "register"
	onChange: (mode: "login" | "register") => void
	className?: string
}

export function AuthModeSegment({ mode, onChange, className }: AuthModeSegmentProps) {
	return (
		<div
			className={cn(
				"relative grid grid-cols-2 gap-1 rounded-full border border-[var(--border)] bg-[var(--muted)]/25 p-1 shadow-inner",
				className
			)}
			role="tablist"
			aria-label="Sign in or sign up"
		>
			{(["login", "register"] as const).map(option => {
				const active = mode === option
				return (
					<button
						key={option}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onChange(option)}
						className={cn(
							"relative z-10 rounded-full px-3 py-2 text-sm font-semibold transition-colors duration-200 sm:px-4 sm:py-2.5",
							active
								? "text-white"
								: "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
						)}
					>
						{active && (
							<motion.span
								layoutId="auth-mode-segment-pill"
								className="absolute inset-0 -z-10 rounded-full shadow-md"
								style={{
									background:
										"linear-gradient(135deg, var(--primary) 0%, var(--accent) 45%, var(--secondary) 100%)",
								}}
								transition={{ type: "spring", stiffness: 400, damping: 30 }}
							/>
						)}
						<span className="font-montserrat relative z-10">
							{option === "login" ? "Sign in" : "Sign up"}
						</span>
					</button>
				)
			})}
		</div>
	)
}
