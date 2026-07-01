"use client"

import type { UserProfile } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { cn } from "@/core/lib/utils"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { useHyperVergeSdk } from "@/features/kyc/hooks/use-hyperverge-sdk"
import { identityExpiryRenewalDescription } from "@/features/kyc/lib/identity-reverification-copy"

function statusLabel(status: UserProfile["identityStatus"]): string {
	switch (status) {
		case "verified":
			return "Verified"
		case "pending":
			return "In progress"
		case "rejected":
			return "Declined"
		case "expired":
			return "Expired"
		default:
			return "Not started"
	}
}

function formatGovernmentIdExpiry(ymd: string): string {
	const [y, m, d] = ymd.split("-").map(Number)
	if (!y || !m || !d) return ymd
	return new Date(y, m - 1, d).toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
	})
}

function governmentIdExpiryReminderBadge(profile: UserProfile): {
	label: string
	variant: "destructive" | "secondary"
} | null {
	const validation = profile.governmentIdValidation
	if (!profile.governmentIdExpiry || !validation) return null
	if (validation.blocked) {
		return { label: "ID expired", variant: "destructive" }
	}
	if (validation.status === "expiring" && validation.daysRemaining !== null) {
		const days = validation.daysRemaining
		return {
			label:
				days === 1
					? "Expires in 1 day — renew ID & re-verify"
					: `Expires in ${days} days — renew ID & re-verify`,
			variant: "secondary",
		}
	}
	return null
}

export function IdentityVerificationCard({
	profile,
	onRefetch,
	className,
	variant = "full",
}: {
	profile: UserProfile
	onRefetch: () => void
	className?: string
	variant?: "full" | "status" | "government-id"
}) {
	const hv = useHyperVergeSdk({ skipExpiryGate: true })
	const renewalPending =
		profile.identityStatus === "unverified" &&
		profile.identityLastExpiredAt !== null &&
		profile.identityLastExpiredAt !== undefined &&
		String(profile.identityLastExpiredAt).length > 0

	const govIdBlocked = profile.governmentIdValidation?.blocked === true
	const canStart =
		profile.identityStatus === "unverified" ||
		profile.identityStatus === "pending" ||
		profile.identityStatus === "rejected" ||
		profile.identityStatus === "expired" ||
		govIdBlocked

	const description = renewalPending
		? identityExpiryRenewalDescription(profile.identityVerificationValidityDays)
		: profile.identityStatus === "verified"
			? profile.role === "client"
				? "Your identity is verified. You can book appointments, send messages, and manage documents on the platform."
				: profile.role === "admin" || profile.role === "super_admin"
					? "Your identity is verified. You can host commission hearings and access compliance-sensitive admin actions."
					: profile.role === "sub_org_admin"
						? "Your identity is verified. You can review commission applications and host summary hearings."
						: "Your identity is verified. You meet the platform requirements for electronic notarization."
			: profile.role === "client"
				? "Verify your identity with HyperVerge to protect your bookings, messages, and documents on the platform."
				: profile.role === "admin" ||
					 profile.role === "super_admin" ||
					 profile.role === "sub_org_admin"
					? "Complete HyperVerge identity verification before hosting commission hearings or other compliance-sensitive actions."
					: "Complete HyperVerge identity verification to satisfy platform requirements for electronic notarization."

	const managesGovernmentIdExpiry = profile.role === "enp" || profile.role === "client"
	const identityVerified = profile.identityStatus === "verified"
	const govIdReminder = identityVerified ? governmentIdExpiryReminderBadge(profile) : null

	const statusSection = (
		<>
			<div className="space-y-1">
				<p className="text-muted-foreground text-xs font-medium">Status</p>
				<Badge variant="outline" className="w-fit">
					{statusLabel(profile.identityStatus)}
				</Badge>
			</div>
			{canStart ? (
				<Button
					type="button"
					size="lg"
					className="min-h-11 w-full sm:w-auto"
					disabled={hv.isLoading}
					onClick={() => void hv.launch().then(() => onRefetch())}
				>
					{hv.isLoading
						? "Opening verification…"
						: govIdBlocked
							? "Verify with renewed ID"
							: "Start verification"}
				</Button>
			) : null}
			{hv.error ? <p className="text-destructive text-xs break-words">{hv.error}</p> : null}
		</>
	)

	const governmentIdSection =
		managesGovernmentIdExpiry && identityVerified ? (
			profile.governmentIdExpiry ? (
				<div className="bg-muted/40 rounded-md border px-3 py-2.5">
					<p className="text-muted-foreground text-xs font-medium">Captured from verified ID</p>
					<div className="mt-1 flex flex-wrap items-center gap-2">
						<p className="text-sm font-medium">{formatGovernmentIdExpiry(profile.governmentIdExpiry)}</p>
						{govIdReminder ? (
							<Badge variant={govIdReminder.variant} className="w-fit">
								{govIdReminder.label}
							</Badge>
						) : null}
					</div>
					<p className="text-muted-foreground mt-2 text-xs leading-relaxed">
						This date is set from your HyperVerge verification and cannot be edited here. Complete
						verification again if it does not match your physical ID.
					</p>
				</div>
			) : (
				<p className="text-muted-foreground text-sm leading-relaxed">
					We could not read an expiration date from your ID during verification. Run identity
					verification again with a clear photo of your government-issued ID.
				</p>
			)
		) : (
			<p className="text-muted-foreground text-sm leading-relaxed">
				Complete identity verification to capture your government ID expiration date.
			</p>
		)

	if (variant === "status") {
		return (
			<Card id="profile-kyc-verification" className={cn("border-border/80 shadow-sm", className)}>
				<CardHeader>
					<CardTitle className="text-base">Identity verification</CardTitle>
					<CardDescription className="line-clamp-3 leading-relaxed">{description}</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">{statusSection}</CardContent>
			</Card>
		)
	}

	if (variant === "government-id") {
		return (
			<Card className={cn("border-border/80 shadow-sm", className)}>
				<CardHeader>
					<CardTitle className="text-base">Government ID expiration</CardTitle>
					<CardDescription className="leading-relaxed">
						Expiration date captured from your verified government ID.
					</CardDescription>
				</CardHeader>
				<CardContent>{governmentIdSection}</CardContent>
			</Card>
		)
	}

	return (
		<Card id="profile-kyc-verification" className={cn("border-border/80 shadow-md", className)}>
			<CardHeader>
				<CardTitle className="text-base">Identity verification</CardTitle>
				<CardDescription className="leading-relaxed">{description}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{statusSection}
				{managesGovernmentIdExpiry && identityVerified ? (
					<div className="space-y-3 border-t pt-4">
						<p className="text-sm font-medium">Government ID expiration</p>
						{governmentIdSection}
					</div>
				) : null}
			</CardContent>
		</Card>
	)
}
