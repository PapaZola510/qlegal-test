"use client"

import * as React from "react"

interface AuthStepHeadingProps {
	badge: string
	title: React.ReactNode
	subtitle: string
}

/**
 * Heading block used on auth-flow pages (MFA, email verification) — matches
 * the typography rhythm of the login/register screen so all auth steps look
 * like one product surface.
 */
export function AuthStepHeading({ badge, title, subtitle }: AuthStepHeadingProps) {
	return (
		<div className="space-y-2 text-center sm:space-y-3 lg:space-y-4 lg:text-left">
			<span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--background)]/60 px-2 py-0.5 font-mono text-[10px] tracking-wide text-[var(--muted-foreground)] uppercase backdrop-blur sm:px-2.5 sm:py-1 sm:text-[11px]">
				<span
					className="inline-flex size-1.5 animate-pulse rounded-full bg-[var(--chart-5)]"
					aria-hidden="true"
				/>
				{badge}
			</span>
			<div className="space-y-1 sm:space-y-2">
				<h1 className="font-poppins text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl lg:text-4xl">
					{title}
				</h1>
				<p className="font-montserrat text-sm leading-relaxed text-balance text-[var(--muted-foreground)]">
					{subtitle}
				</p>
			</div>
		</div>
	)
}
