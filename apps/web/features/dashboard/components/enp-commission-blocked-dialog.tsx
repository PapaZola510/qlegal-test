"use client"

import Link from "next/link"

import type { UserProfile } from "@repo/contracts"

import { buttonVariants } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { cn } from "@/core/lib/utils"
import {
	enpCommissionBlockedBody,
	enpCommissionGateContextLine,
	type EnpCommissionGateContext,
} from "@/features/dashboard/lib/enp-commission-gate"

interface EnpCommissionBlockedDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	profile: UserProfile
	context?: EnpCommissionGateContext
}

export function EnpCommissionBlockedDialog({
	open,
	onOpenChange,
	profile,
	context = "generic",
}: EnpCommissionBlockedDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="ring-destructive/25 gap-0 p-0 ring-2 sm:max-w-md">
				<div className="border-destructive/30 bg-destructive/10 space-y-3 border-b px-5 py-5">
					<DialogHeader className="space-y-2 text-start">
						<p className="text-destructive text-[0.65rem] font-semibold tracking-wider uppercase">
							Notarial acts blocked
						</p>
						<DialogTitle className="text-destructive text-base">Commission not active</DialogTitle>
						<DialogDescription className="text-foreground/85 text-sm leading-relaxed">
							{enpCommissionGateContextLine(context)}
						</DialogDescription>
					</DialogHeader>
					<div className="border-destructive/30 bg-destructive/5 rounded-lg border px-4 py-3 text-sm">
						<p className="text-destructive/90 leading-relaxed">
							{enpCommissionBlockedBody(profile)}
						</p>
					</div>
				</div>
				<div className="px-5 py-4">
					<Link
						href="/profile?focus=notarial"
						onClick={() => onOpenChange(false)}
						className={cn(buttonVariants({ variant: "default" }), "h-9 w-full sm:w-auto")}
					>
						Go to profile
					</Link>
				</div>
			</DialogContent>
		</Dialog>
	)
}
