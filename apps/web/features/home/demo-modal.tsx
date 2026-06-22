"use client"

import type { Route } from "next"
import Link from "next/link"

import { Button, buttonVariants } from "@/core/components/ui/button"
import { cn } from "@/core/lib/utils"

interface DemoModalProps {
	open: boolean
	onClose: () => void
}

export function DemoModal({ open, onClose }: DemoModalProps) {
	if (!open) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="demo-modal-title"
				className="bg-background w-full max-w-lg rounded-lg border p-6 shadow-xl"
			>
				<h2 id="demo-modal-title" className="text-2xl font-bold tracking-tight">
					Request a walkthrough
				</h2>
				<p className="text-muted-foreground mt-2 text-sm leading-relaxed">
					Create an account to explore QLegal workflows or sign in if your organization already has
					access.
				</p>
				<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
					<Button type="button" variant="ghost" onClick={onClose}>
						Close
					</Button>
					<Link
						href={"/login" as Route}
						className={cn(buttonVariants({ variant: "outline" }), "sm:w-auto")}
					>
						Sign in
					</Link>
					<Link href={"/register" as Route} className={cn(buttonVariants(), "sm:w-auto")}>
						Create account
					</Link>
				</div>
			</div>
		</div>
	)
}
