"use client"

import * as React from "react"
import Link from "next/link"
import { Alert02FreeIcons, AlertCircleFreeIcons } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { UserProfile } from "@repo/contracts"

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
} from "@/core/components/ui/alert-dialog"
import { buttonVariants } from "@/core/components/ui/button"
import { cn } from "@/core/lib/utils"
import {
	useDismissCommissionExpiryWarningMutation,
	useSnoozeCommissionExpiryWarningMutation,
} from "@/features/dashboard/api/commission-validation.hooks"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import { enpCommissionBlockedBody } from "@/features/dashboard/lib/enp-commission-gate"

type WarningUrgency = "moderate" | "high" | "critical"

function warningUrgency(tier: number): WarningUrgency {
	if (tier <= 3) return "critical"
	if (tier <= 10) return "high"
	return "moderate"
}

function urgencyStyles(urgency: WarningUrgency) {
	switch (urgency) {
		case "critical":
			return {
				shell: "border-destructive/50 ring-destructive/20",
				header: "border-destructive/30 bg-destructive/10",
				iconWrap: "bg-destructive/15 text-destructive",
				badge: "text-destructive",
				countdown: "text-destructive",
				callout: "border-destructive/30 bg-destructive/5",
				calloutTitle: "text-destructive",
				calloutBody: "text-destructive/90",
			}
		case "high":
			return {
				shell: "border-orange-500/50 ring-orange-500/15",
				header: "border-orange-500/30 bg-orange-500/10",
				iconWrap: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
				badge: "text-orange-700 dark:text-orange-300",
				countdown: "text-orange-600 dark:text-orange-400",
				callout: "border-orange-500/30 bg-orange-500/5",
				calloutTitle: "text-orange-800 dark:text-orange-200",
				calloutBody: "text-orange-700/90 dark:text-orange-300/90",
			}
		default:
			return {
				shell: "border-amber-500/50 ring-amber-500/15",
				header: "border-amber-500/30 bg-amber-500/10",
				iconWrap: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
				badge: "text-amber-700 dark:text-amber-300",
				countdown: "text-amber-600 dark:text-amber-400",
				callout: "border-amber-500/30 bg-amber-500/5",
				calloutTitle: "text-amber-900 dark:text-amber-100",
				calloutBody: "text-amber-800/90 dark:text-amber-200/90",
			}
	}
}

function commissionExpiryLabel(profile: UserProfile): string {
	return profile.commissionValidation?.commissionExpiry ?? profile.commissionExpiry ?? "—"
}

/** Modal hidden via dismiss/snooze but commission is still inside the 30-day warning window. */
function showCommissionSuppressedBanner(
	validation: NonNullable<UserProfile["commissionValidation"]>
): boolean {
	if (validation.blocked || validation.status === "expiring") return false
	const days = validation.daysRemaining
	return days !== null && days > 0 && days <= 30 && validation.warningTier === null
}

function commissionSuppressedBannerMessage(
	validation: NonNullable<UserProfile["commissionValidation"]>,
	expiryLabel: string
): string {
	const days = validation.daysRemaining
	if (days === null) {
		return `Your notarial commission is expiring soon (valid until ${expiryLabel}). Renew with the Supreme Court and update your profile.`
	}
	return `Your notarial commission expires in ${days} calendar day${days === 1 ? "" : "s"} (valid until ${expiryLabel}). Renew with the Supreme Court and update your profile.`
}

function commissionBannerClassName(variant: "header" | "sidebar") {
	if (variant === "sidebar") {
		return "border-destructive/40 bg-destructive/10 text-destructive flex min-w-0 flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs leading-snug font-medium sm:px-3 sm:py-2 sm:text-sm"
	}
	return "border-destructive/50 bg-destructive/15 text-destructive flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b px-4 py-2.5 text-center text-sm font-medium"
}

export function EnpCommissionExpiryNotice({ variant = "header" }: { variant?: "header" | "sidebar" }) {
	const profileQ = useAuthProfileMeQuery()
	const dismiss = useDismissCommissionExpiryWarningMutation()
	const snooze = useSnoozeCommissionExpiryWarningMutation()
	const profile = profileQ.data
	const validation = profile?.role === "enp" ? profile.commissionValidation : null

	const [warningOpen, setWarningOpen] = React.useState(false)
	const [blockedOpen, setBlockedOpen] = React.useState(false)

	React.useEffect(() => {
		if (!validation) {
			setWarningOpen(false)
			setBlockedOpen(false)
			return
		}
		if (validation.blocked) {
			setWarningOpen(false)
			setBlockedOpen(true)
			return
		}
		if (validation.status === "expiring" && validation.warningTier !== null) {
			setBlockedOpen(false)
			setWarningOpen(true)
			return
		}
		setWarningOpen(false)
		setBlockedOpen(false)
	}, [validation])

	if (!profile || profile.role !== "enp" || !validation) return null

	const warningTier = validation.warningTier
	const urgency = warningTier !== null ? warningUrgency(warningTier) : "moderate"
	const styles = urgencyStyles(urgency)
	const expiryLabel = commissionExpiryLabel(profile)
	const daysRemaining = validation.daysRemaining ?? warningTier
	const suppressedBanner = showCommissionSuppressedBanner(validation)

	return (
		<>
			{validation.blocked ? (
				<div role="alert" className={commissionBannerClassName(variant)}>
					<HugeiconsIcon icon={Alert02FreeIcons} className="size-3.5 shrink-0 sm:size-4" strokeWidth={2} />
					<span>{enpCommissionBlockedBody(profile)}</span>
				</div>
			) : suppressedBanner ? (
				<div role="alert" className={commissionBannerClassName(variant)}>
					<HugeiconsIcon icon={Alert02FreeIcons} className="size-3.5 shrink-0 sm:size-4" strokeWidth={2} />
					<span>{commissionSuppressedBannerMessage(validation, expiryLabel)}</span>
					<Link
						href="/profile?focus=notarial"
						className="font-semibold underline underline-offset-2"
					>
						Update profile
					</Link>
				</div>
			) : null}

			<AlertDialog open={warningOpen && warningTier !== null} onOpenChange={setWarningOpen}>
				<AlertDialogContent
					aria-labelledby="enp-commission-warning-title"
					aria-describedby="enp-commission-warning-desc"
					className={cn(
						"w-[calc(100vw-2rem)] !max-w-[34rem] gap-0 p-0 ring-2 sm:!max-w-[34rem]",
						styles.shell
					)}
				>
					<div className={cn("space-y-4 border-b px-5 py-5", styles.header)}>
						<div className="flex gap-3">
							<span
								className={cn(
									"inline-flex size-10 shrink-0 items-center justify-center rounded-full ring-2 ring-current/20",
									styles.iconWrap
								)}
								aria-hidden
							>
								<HugeiconsIcon icon={Alert02FreeIcons} className="size-5" strokeWidth={2} />
							</span>
							<div className="min-w-0 flex-1 space-y-1">
								<p
									className={cn(
										"text-[0.65rem] font-semibold tracking-wider uppercase",
										styles.badge
									)}
								>
									ENP Commission Status Validation
								</p>
								<div className="flex flex-wrap items-baseline gap-x-2">
									<span
										className={cn("text-3xl leading-none font-bold tabular-nums", styles.countdown)}
									>
										{warningTier ?? "—"}
									</span>
									<span className="text-foreground text-sm font-semibold">
										day{(warningTier ?? 0) === 1 ? "" : "s"} remaining
									</span>
								</div>
								<h2
									id="enp-commission-warning-title"
									className="text-foreground text-sm font-semibold"
								>
									Commission expiring soon
								</h2>
								<p
									id="enp-commission-warning-desc"
									className="text-foreground/80 text-sm leading-relaxed"
								>
									Valid until <span className="font-semibold">{expiryLabel}</span>
									{daysRemaining !== null && daysRemaining !== warningTier ? (
										<> · ~{daysRemaining} calendar days left</>
									) : null}
									. Renew with the Supreme Court and update your profile.
								</p>
							</div>
						</div>

						<div className={cn("rounded-lg border px-4 py-3", styles.callout)}>
							<div className="flex gap-2.5">
								<HugeiconsIcon
									icon={AlertCircleFreeIcons}
									className={cn("mt-0.5 size-4 shrink-0", styles.badge)}
									strokeWidth={2}
									aria-hidden
								/>
								<div className="min-w-0 text-sm">
									<p className={cn("font-semibold", styles.calloutTitle)}>Action required</p>
									<ol
										className={cn(
											"mt-1.5 ml-4 list-decimal space-y-1 leading-relaxed",
											styles.calloutBody
										)}
									>
										<li>Renew with the Supreme Court.</li>
										<li>Update your ENP profile validity date.</li>
										<li>Confirm credentials before performing notarial acts.</li>
									</ol>
								</div>
							</div>
						</div>
					</div>

					<div className="space-y-3 px-5 py-4">
						<p className="text-muted-foreground text-xs leading-relaxed">
							You can still use the platform during this warning period. Notarial acts will be
							blocked once your commission expires.
						</p>
						<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
							<Link
								href="/profile?focus=notarial"
								className={cn(buttonVariants({ size: "default" }), "h-9 w-full sm:w-auto")}
								onClick={() => setWarningOpen(false)}
							>
								Update profile
							</Link>
							<AlertDialogCancel
								disabled={snooze.isPending || dismiss.isPending}
								className="h-9 w-full sm:w-auto"
								variant="outline"
								onClick={event => {
									event.preventDefault()
									void snooze.mutateAsync().then(() => setWarningOpen(false))
								}}
							>
								{snooze.isPending ? "Saving…" : "Remind me later"}
							</AlertDialogCancel>
							<AlertDialogAction
								disabled={dismiss.isPending || snooze.isPending || warningTier === null}
								variant="ghost"
								className="text-muted-foreground hover:text-foreground h-9 w-full px-3 sm:w-auto"
								onClick={event => {
									event.preventDefault()
									if (warningTier === null) return
									void dismiss
										.mutateAsync({ warningDay: warningTier })
										.then(() => setWarningOpen(false))
								}}
							>
								{dismiss.isPending ? "Saving…" : "Dismiss for now"}
							</AlertDialogAction>
						</div>
						<p className="text-muted-foreground text-[0.65rem] leading-snug">
							Remind me later hides this notice for 24 hours. Dismiss for now hides it until the
							next warning milestone (or until you update your commission expiry date).
						</p>
					</div>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog open={blockedOpen} onOpenChange={setBlockedOpen}>
				<AlertDialogContent
					aria-labelledby="enp-commission-blocked-title"
					aria-describedby="enp-commission-blocked-desc"
					className="ring-destructive/25 w-[calc(100vw-2rem)] !max-w-[34rem] gap-0 p-0 ring-2 sm:!max-w-[34rem]"
				>
					<div className="border-destructive/30 bg-destructive/10 space-y-4 border-b px-5 py-5">
						<div className="flex gap-3">
							<span
								className="bg-destructive/15 text-destructive ring-destructive/25 inline-flex size-10 shrink-0 items-center justify-center rounded-full ring-2"
								aria-hidden
							>
								<HugeiconsIcon icon={Alert02FreeIcons} className="size-5" strokeWidth={2} />
							</span>
							<div className="min-w-0 flex-1 space-y-1">
								<p className="text-destructive text-[0.65rem] font-semibold tracking-wider uppercase">
									Notarial acts blocked
								</p>
								<h2
									id="enp-commission-blocked-title"
									className="text-destructive text-base font-bold"
								>
									Commission not active
								</h2>
								<p
									id="enp-commission-blocked-desc"
									className="text-foreground/85 text-sm leading-relaxed"
								>
									{enpCommissionBlockedBody(profile)}
								</p>
							</div>
						</div>
						<div className="border-destructive/30 bg-destructive/5 rounded-lg border px-4 py-3 text-sm">
							<p className="text-destructive font-semibold">Notarial acts disabled</p>
							<p className="text-destructive/90 mt-1 leading-relaxed">
								Appointments, QuickSign, registry sync, and related ENP actions are unavailable
								until your commission is renewed.
							</p>
						</div>
					</div>

					<div className="px-5 py-4">
						<Link
							href="/profile?focus=notarial"
							className={cn(buttonVariants({ size: "default" }), "h-9 w-full sm:w-auto")}
							onClick={() => setBlockedOpen(false)}
						>
							Go to profile
						</Link>
					</div>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
