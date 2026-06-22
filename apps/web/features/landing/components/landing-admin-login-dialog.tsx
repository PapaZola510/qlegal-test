"use client"

import * as React from "react"
import type { VariantProps } from "class-variance-authority"

import { Button, type buttonVariants } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/core/components/ui/dialog"
import { cn } from "@/core/lib/utils"
import { LandingAdminLoginForm } from "@/features/landing/components/landing-admin-login-form"

export function LandingAdminLoginDialog({
	variant = "ghost",
	size = "sm",
	isDevAccess = false,
	compact = false,
	triggerId,
}: {
	variant?: VariantProps<typeof buttonVariants>["variant"]
	size?: VariantProps<typeof buttonVariants>["size"]
	isDevAccess?: boolean
	compact?: boolean
	triggerId?: string
}) {
	const [open, setOpen] = React.useState(false)
	const stableTriggerId =
		triggerId ?? (isDevAccess ? "auth-dev-admin-login-trigger" : "landing-admin-login-trigger")

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				id={stableTriggerId}
				render={
					isDevAccess ? (
						<Button
							type="button"
							variant="outline"
							size={compact ? "sm" : "lg"}
							className={cn(
								"flex w-full cursor-pointer items-center justify-between rounded-xl border border-dashed border-amber-500/35 bg-amber-500/5 font-mono tracking-wider text-amber-400 uppercase transition-all duration-200 select-none hover:border-amber-500/60 hover:bg-amber-500/10 hover:shadow-md hover:shadow-amber-500/5 active:scale-[0.98]",
								compact ? "h-9 px-3 text-[10px]" : "h-12 px-4 text-[11px]"
							)}
						>
							<div className="flex items-center gap-2">
								<span className="relative flex size-2 shrink-0">
									<span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60" />
									<span className="relative inline-flex size-2 rounded-full bg-amber-400" />
								</span>
								<span className="font-bold">ENA Dev Access</span>
							</div>
							<svg
								className="size-4 text-amber-400/60"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2.5}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
								/>
							</svg>
						</Button>
					) : (
						<Button
							type="button"
							variant={variant}
							size={size}
							className="font-montserrat hover:bg-foreground/5 font-semibold transition-all active:scale-95 dark:hover:bg-white/5"
						>
							ENA sign-in
						</Button>
					)
				}
			/>
			<DialogContent className="border-border/80 bg-background/95 overflow-hidden rounded-2xl border p-6 shadow-2xl backdrop-blur-lg sm:max-w-md">
				{/* Top glowing bar */}
				<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--primary)] via-[var(--accent)] to-[var(--secondary)]" />

				<DialogHeader className="space-y-3 pb-2 text-left">
					<div className="flex items-center gap-3">
						<span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--primary)]/10 bg-[var(--primary)]/10 text-[var(--primary)]">
							<svg
								className="size-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2.5}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
								/>
							</svg>
						</span>
						<div>
							<DialogTitle className="font-poppins text-foreground flex items-center gap-2 text-xl font-bold tracking-tight">
								ENA sign-in
							</DialogTitle>
							<span className="rounded border border-amber-500/30 bg-amber-500/5 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-amber-500 uppercase">
								Electronic Notary Administrator
							</span>
						</div>
					</div>
					<DialogDescription className="font-montserrat pt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
						Sign in as an Electronic Notary Administrator. On local bootstrap, use{" "}
						<span className="text-foreground bg-foreground/5 rounded px-1 py-0.5 font-mono font-semibold dark:bg-white/5">
							admin
						</span>{" "}
						with your seeded password.
					</DialogDescription>
				</DialogHeader>

				<div className="py-2">
					<LandingAdminLoginForm onSuccess={() => setOpen(false)} />
				</div>
			</DialogContent>
		</Dialog>
	)
}
