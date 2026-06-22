"use client"

import type { Route } from "next"
import Link from "next/link"

import type { UserProfile } from "@repo/contracts"

import { buttonVariants } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { cn } from "@/core/lib/utils"
import { profilePath } from "@/features/profile/lib/profile-routes"

import { profileKycGateMessage } from "../lib/profile-kyc-gate"

interface ProfileKycRequiredCardProps {
	profile: UserProfile
	context: "booking" | "lobby" | "respond"
	backHref?: Route
	backLabel?: string
}

export function ProfileKycRequiredCard({
	profile,
	context,
	backHref,
	backLabel = "Back",
}: ProfileKycRequiredCardProps) {
	return (
		<Card className="border-border/80">
			<CardHeader>
				<CardTitle className="text-base">Identity verification required</CardTitle>
				<CardDescription>{profileKycGateMessage(profile.role, context)}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-wrap gap-3">
				<Link
					href={profilePath(profile.role, { hashKyc: true })}
					className={cn(buttonVariants({ variant: "default" }))}
				>
					Go to Profile verification
				</Link>
				{backHref ? (
					<Link href={backHref} className={cn(buttonVariants({ variant: "outline" }))}>
						{backLabel}
					</Link>
				) : null}
			</CardContent>
		</Card>
	)
}
