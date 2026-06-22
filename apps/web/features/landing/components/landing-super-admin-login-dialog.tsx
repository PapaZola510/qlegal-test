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
import { LandingSuperAdminLoginForm } from "@/features/landing/components/landing-super-admin-login-form"

export function LandingSuperAdminLoginDialog({
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
		triggerId ??
		(isDevAccess ? "auth-dev-super-admin-login-trigger" : "landing-super-admin-login-trigger")

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
								"flex w-full cursor-pointer items-center justify-between rounded-xl border border-dashed border-indigo-500/35 bg-indigo-500/5 font-mono tracking-wider text-indigo-300 uppercase transition-all duration-200 select-none hover:border-indigo-500/60 hover:bg-indigo-500/10 hover:shadow-md hover:shadow-indigo-500/5 active:scale-[0.98]",
								compact ? "h-9 px-3 text-[10px]" : "h-12 px-4 text-[11px]"
							)}
						>
							<div className="flex items-center gap-2">
								<span className="relative flex size-2 shrink-0">
									<span className="absolute inline-flex size-full animate-ping rounded-full bg-indigo-400 opacity-60" />
									<span className="relative inline-flex size-2 rounded-full bg-indigo-400" />
								</span>
								<span className="font-bold">Super Admin Dev</span>
							</div>
							<svg
								className="size-4 text-indigo-400/60"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2.5}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
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
							Super Admin sign-in
						</Button>
					)
				}
			/>
			<DialogContent className="border-border/80 bg-background/95 overflow-hidden rounded-2xl border p-6 shadow-2xl backdrop-blur-lg sm:max-w-md">
				<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600" />

				<DialogHeader className="space-y-3 pb-2 text-left">
					<div className="flex items-center gap-3">
						<span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/10 bg-indigo-500/10 text-indigo-400">
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
									d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
								/>
							</svg>
						</span>
						<div>
							<DialogTitle className="font-poppins text-foreground flex items-center gap-2 text-xl font-bold tracking-tight">
								Super Admin sign-in
							</DialogTitle>
							<span className="rounded border border-indigo-500/30 bg-indigo-500/5 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-indigo-400 uppercase">
								Super Admin
							</span>
						</div>
					</div>
					<DialogDescription className="font-montserrat pt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
						Platform super administrator access. On local bootstrap, use{" "}
						<span className="text-foreground bg-foreground/5 rounded px-1 py-0.5 font-mono font-semibold dark:bg-white/5">
							superadmin
						</span>{" "}
						with your seeded password.
					</DialogDescription>
				</DialogHeader>

				<div className="py-2">
					<LandingSuperAdminLoginForm onSuccess={() => setOpen(false)} />
				</div>
			</DialogContent>
		</Dialog>
	)
}
