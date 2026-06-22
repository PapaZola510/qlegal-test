"use client"

import type { MeetingFeeBreakdown } from "@repo/contracts"

import { cn } from "@/core/lib/utils"

function formatFeePhp(amount: number): string {
	return `₱${amount.toLocaleString("en-PH")}`
}

function BreakdownRow({
	label,
	amount,
	hint,
	className,
}: {
	label: string
	amount: number
	hint?: string
	className?: string
}) {
	return (
		<div className={cn("flex items-start justify-between gap-3", className)}>
			<span className="text-muted-foreground min-w-0 font-sans leading-snug">
				{label}
				{hint ? <span className="mt-0.5 block text-[10px]">{hint}</span> : null}
			</span>
			<span className="shrink-0 tabular-nums">{formatFeePhp(amount)}</span>
		</div>
	)
}

export function MeetingFeeBreakdownView({
	breakdown,
	compact = false,
	className,
}: {
	breakdown: MeetingFeeBreakdown
	compact?: boolean
	className?: string
}) {
	return (
		<div
			className={cn("space-y-2 font-mono text-xs", compact ? "text-[11px]" : "text-xs", className)}
			aria-label="Session fee breakdown"
		>
			<BreakdownRow label="Notarial fee" amount={breakdown.notarialFeePhp} />
			<BreakdownRow label="Convenience fee (5%)" amount={breakdown.convenienceFeePhp} />
			<BreakdownRow label="Processing fee" amount={breakdown.processingFeePhp} hint="QRPH" />
			<BreakdownRow label="VAT (12%)" amount={breakdown.vatPhp} />
			<div
				className={cn(
					"border-foreground/15 flex items-baseline justify-between gap-3 border-t pt-2",
					compact && "pt-1.5"
				)}
			>
				<span className="text-foreground font-sans text-xs font-semibold tracking-wide uppercase">
					Total
				</span>
				<span className={cn("font-semibold tabular-nums", compact ? "text-sm" : "text-base")}>
					{formatFeePhp(breakdown.totalPhp)}
				</span>
			</div>
		</div>
	)
}
