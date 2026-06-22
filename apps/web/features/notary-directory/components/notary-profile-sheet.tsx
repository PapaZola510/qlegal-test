"use client"

import { Avatar, AvatarFallback } from "@/core/components/ui/avatar"
import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Separator } from "@/core/components/ui/separator"
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/core/components/ui/sheet"

import { NOTARIZATION_TYPES, SESSION_MODES, type NotaryProfile } from "../lib/fixtures"

interface NotaryProfileSheetProps {
	notary: NotaryProfile | null
	open: boolean
	onOpenChange: (open: boolean) => void
	onRequestAppointment: (notary: NotaryProfile) => void
}

function getInitials(first: string, last: string) {
	return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()
}

function label(value: string, list: { value: string; label: string }[]) {
	return list.find(i => i.value === value)?.label ?? value
}

export function NotaryProfileSheet({
	notary,
	open,
	onOpenChange,
	onRequestAppointment,
}: NotaryProfileSheetProps) {
	if (!notary) return null

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="overflow-y-auto">
				<SheetHeader>
					<div className="flex items-center gap-3">
						<Avatar className="size-12">
							<AvatarFallback className="bg-primary/10 text-primary font-semibold">
								{getInitials(notary.firstName, notary.lastName)}
							</AvatarFallback>
						</Avatar>
						<div>
							<SheetTitle>
								{notary.firstName} {notary.lastName}
							</SheetTitle>
							<SheetDescription>
								{notary.city}, {notary.province}
							</SheetDescription>
						</div>
					</div>
				</SheetHeader>

				<div className="space-y-5 px-4">
					{/* Status */}
					<div className="flex items-center gap-2">
						{notary.isAvailable ? (
							<Badge variant="secondary">Available</Badge>
						) : (
							<Badge variant="outline">Unavailable</Badge>
						)}
						<span className="text-muted-foreground text-xs">
							★ {notary.rating} · {notary.reviewCount} reviews
						</span>
					</div>

					{/* Bio */}
					<p className="text-sm leading-relaxed">{notary.bio}</p>

					<Separator />

					{/* Details grid */}
					<div className="grid gap-3 text-sm">
						<div className="flex justify-between">
							<span className="text-muted-foreground">NPN</span>
							<span className="font-mono text-xs">{notary.npn}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Commission Area</span>
							<span>{notary.commissionArea}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Experience</span>
							<span>{notary.yearsExperience} years</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Base Fee</span>
							<span className="font-medium">₱{notary.baseFee.toLocaleString()}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Email</span>
							<span className="text-xs">{notary.email}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted-foreground">Phone</span>
							<span className="text-xs">{notary.phone}</span>
						</div>
					</div>

					<Separator />

					{/* Specializations */}
					<div className="space-y-2">
						<h4 className="text-xs font-medium tracking-wide uppercase">Specializations</h4>
						<div className="flex flex-wrap gap-1">
							{notary.specializations.map(s => (
								<Badge key={s} variant="outline" className="text-[10px] font-normal">
									{label(s, NOTARIZATION_TYPES)}
								</Badge>
							))}
						</div>
					</div>

					{/* Modes */}
					<div className="space-y-2">
						<h4 className="text-xs font-medium tracking-wide uppercase">Available Modes</h4>
						<div className="flex flex-wrap gap-1">
							{notary.availableModes.map(m => (
								<Badge key={m} variant="secondary" className="text-[10px] font-normal">
									{label(m, SESSION_MODES)}
								</Badge>
							))}
						</div>
					</div>
				</div>

				<SheetFooter>
					<Button
						className="w-full"
						disabled={!notary.isAvailable}
						onClick={() => {
							onRequestAppointment(notary)
							onOpenChange(false)
						}}
					>
						Request Appointment
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	)
}
