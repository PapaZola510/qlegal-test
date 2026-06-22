"use client"

import type { MeetingPaymentStatus } from "@repo/contracts"

import { cn } from "@/core/lib/utils"

function formatFeePhp(amount: number): string {
	return `₱${amount.toLocaleString("en-PH")}`
}

export function MeetingPaymentStatusStrip({
	paymentStatus,
	role,
	className,
}: {
	paymentStatus: MeetingPaymentStatus
	role: "client" | "enp"
	className?: string
}) {
	if (!paymentStatus.required || paymentStatus.totalFeePhp <= 0) return null

	const paid = paymentStatus.paid

	return (
		<div
			className={cn(
				"rounded-md border px-3 py-2 text-xs leading-relaxed",
				paid
					? "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
					: "border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100",
				className
			)}
			role="status"
			aria-live="polite"
		>
			{paid ? (
				<p className="font-medium">
					{role === "enp" ? (
						<>
							Client payment received ({formatFeePhp(paymentStatus.totalFeePhp)}). You can end the
							session when ready.
						</>
					) : (
						<>Payment complete ({formatFeePhp(paymentStatus.totalFeePhp)}).</>
					)}
				</p>
			) : role === "enp" ? (
				<p>
					<span className="font-medium">Awaiting client payment</span>
					{" — "}
					{formatFeePhp(paymentStatus.totalFeePhp)} due via QRPH (Payment tab on the client&apos;s
					screen).
				</p>
			) : (
				<p>
					<span className="font-medium">Payment required:</span>{" "}
					{formatFeePhp(paymentStatus.totalFeePhp)}. Open the Payment tab to pay via QRPH.
				</p>
			)}
		</div>
	)
}
