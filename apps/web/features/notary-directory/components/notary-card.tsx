"use client"

import { Avatar, AvatarFallback } from "@/core/components/ui/avatar"
import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/core/components/ui/card"

import { NOTARIZATION_TYPES, type NotaryProfile } from "../lib/fixtures"

interface NotaryCardProps {
	notary: NotaryProfile
	onViewProfile: (notary: NotaryProfile) => void
	onRequestAppointment: (notary: NotaryProfile) => void
}

function getInitials(first: string, last: string) {
	return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()
}

function formatFee(fee: number) {
	return `₱${fee.toLocaleString()}`
}

function getSpecLabel(value: string) {
	return NOTARIZATION_TYPES.find(t => t.value === value)?.label ?? value
}

export function NotaryCard({ notary, onViewProfile, onRequestAppointment }: NotaryCardProps) {
	return (
		<Card className="flex flex-col">
			<CardHeader>
				<div className="flex items-start gap-3">
					<Avatar className="size-10 shrink-0">
						<AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
							{getInitials(notary.firstName, notary.lastName)}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<CardTitle className="truncate text-sm">
							{notary.firstName} {notary.lastName}
						</CardTitle>
						<p className="text-muted-foreground mt-0.5 text-xs">
							{notary.city}, {notary.province}
						</p>
					</div>
					{notary.isAvailable ? (
						<Badge variant="secondary" className="shrink-0 text-[10px]">
							Available
						</Badge>
					) : (
						<Badge variant="outline" className="shrink-0 text-[10px]">
							Unavailable
						</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent className="flex-1 space-y-3">
				<div className="flex items-center gap-3 text-xs">
					<span className="text-muted-foreground">
						★ {notary.rating} ({notary.reviewCount})
					</span>
					<span className="text-muted-foreground">·</span>
					<span className="text-muted-foreground">{notary.yearsExperience} yrs exp</span>
					<span className="text-muted-foreground">·</span>
					<span className="font-medium">{formatFee(notary.baseFee)}</span>
				</div>
				<div className="flex flex-wrap gap-1">
					{notary.specializations.slice(0, 3).map(s => (
						<Badge key={s} variant="outline" className="text-[10px] font-normal">
							{getSpecLabel(s)}
						</Badge>
					))}
					{notary.specializations.length > 3 && (
						<Badge variant="outline" className="text-[10px] font-normal">
							+{notary.specializations.length - 3}
						</Badge>
					)}
				</div>
				<p className="text-muted-foreground line-clamp-2 text-xs">{notary.bio}</p>
			</CardContent>
			<CardFooter className="gap-2">
				<Button
					variant="outline"
					size="sm"
					className="flex-1"
					onClick={() => onViewProfile(notary)}
				>
					View Profile
				</Button>
				<Button
					size="sm"
					className="flex-1"
					disabled={!notary.isAvailable}
					onClick={() => onRequestAppointment(notary)}
				>
					Book
				</Button>
			</CardFooter>
		</Card>
	)
}
