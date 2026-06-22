"use client"

import * as React from "react"
import { toast } from "sonner"

import type { UserProfile } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Textarea } from "@/core/components/ui/textarea"
import { useUpdateAuthProfileMutation } from "@/features/onboarding/api/profile-onboarding.hooks"

export function EnpProfessionalProfileStep({ profile }: { profile: UserProfile }) {
	const update = useUpdateAuthProfileMutation()
	const [namePrefix, setNamePrefix] = React.useState(profile.namePrefix ?? "")
	const [phone, setPhone] = React.useState(profile.phone ?? "")
	const [rollNumber, setRollNumber] = React.useState(profile.rollNumber ?? "")
	const [commissionExpiry, setCommissionExpiry] = React.useState(profile.commissionExpiry ?? "")
	const [regionProvinceCity, setRegionProvinceCity] = React.useState(
		profile.regionProvinceCity ?? ""
	)
	const [officeAddress, setOfficeAddress] = React.useState(profile.officeAddress ?? "")
	const [displayName, setDisplayName] = React.useState(profile.name ?? "")
	const [localErr, setLocalErr] = React.useState<string | null>(null)

	React.useEffect(() => {
		setNamePrefix(profile.namePrefix ?? "")
		setPhone(profile.phone ?? "")
		setRollNumber(profile.rollNumber ?? "")
		setCommissionExpiry(profile.commissionExpiry ?? "")
		setRegionProvinceCity(profile.regionProvinceCity ?? "")
		setOfficeAddress(profile.officeAddress ?? "")
		setDisplayName(profile.name ?? "")
	}, [profile])

	const save = () => {
		setLocalErr(null)
		const trimmedPhone = phone.trim()
		const trimmedRoll = rollNumber.trim()
		const trimmedRegion = regionProvinceCity.trim()
		const trimmedOffice = officeAddress.trim()
		if (!displayName.trim()) {
			setLocalErr("Add your full name as it should appear on records.")
			return
		}
		if (!trimmedPhone) {
			setLocalErr("Phone number is required.")
			return
		}
		if (!trimmedRoll) {
			setLocalErr("Roll number is required.")
			return
		}
		if (!commissionExpiry.trim()) {
			setLocalErr("Commission expiry date is required.")
			return
		}
		if (!trimmedRegion) {
			setLocalErr("Region / province / city is required.")
			return
		}
		if (!trimmedOffice) {
			setLocalErr("Full office address is required.")
			return
		}

		void update
			.mutateAsync({
				name: displayName.trim(),
				namePrefix: namePrefix.trim() || undefined,
				phone: trimmedPhone,
				rollNumber: trimmedRoll,
				commissionExpiry: commissionExpiry.trim(),
				regionProvinceCity: trimmedRegion,
				officeAddress: trimmedOffice,
			})
			.then(() => toast.success("Practice profile saved"))
			.catch(() => toast.error("Could not save your profile"))
	}

	return (
		<Card className="border-border/80 w-full shadow-md">
			<CardHeader className="space-y-1">
				<CardTitle className="text-xl">Practice profile</CardTitle>
				<CardDescription>
					Prefix, contact, roll number, commission expiry, jurisdiction, and office address —
					required before the certification course. Complete identity verification anytime from
					Profile.
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-5 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="name-prefix">Prefix (optional)</Label>
					<Input
						id="name-prefix"
						placeholder="e.g. Atty., Atty. / ENP"
						value={namePrefix}
						onChange={e => setNamePrefix(e.target.value)}
						autoComplete="honorific-prefix"
					/>
				</div>
				<div className="space-y-2 sm:col-span-2">
					<Label htmlFor="full-name">Full name</Label>
					<Input
						id="full-name"
						placeholder="e.g. Juan Miguel Reyes"
						value={displayName}
						onChange={e => setDisplayName(e.target.value)}
						autoComplete="name"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="phone">Phone</Label>
					<Input
						id="phone"
						type="tel"
						placeholder="+63 917 123 4567"
						value={phone}
						onChange={e => setPhone(e.target.value)}
						autoComplete="tel"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="roll">Roll No.</Label>
					<Input
						id="roll"
						placeholder="e.g. IBP roll / Roll of Attorneys No."
						value={rollNumber}
						onChange={e => setRollNumber(e.target.value)}
					/>
				</div>
				<div className="space-y-2 sm:col-span-2">
					<Label htmlFor="expiry">Commission expiry</Label>
					<Input
						id="expiry"
						type="date"
						placeholder="YYYY-MM-DD"
						title="Last valid date of your notarial commission"
						value={commissionExpiry}
						onChange={e => setCommissionExpiry(e.target.value)}
					/>
					<p className="text-muted-foreground text-xs">
						Use the calendar or enter the date in YYYY-MM-DD (end of your commission validity).
					</p>
				</div>
				<div className="space-y-2 sm:col-span-2">
					<Label htmlFor="region">Region / province / city</Label>
					<Input
						id="region"
						placeholder="e.g. Metro Manila — Makati City"
						value={regionProvinceCity}
						onChange={e => setRegionProvinceCity(e.target.value)}
					/>
				</div>
				<div className="space-y-2 sm:col-span-2">
					<Label htmlFor="office">Full office address</Label>
					<Textarea
						id="office"
						rows={4}
						value={officeAddress}
						onChange={e => setOfficeAddress(e.target.value)}
						placeholder="Building, street, barangay, postal code"
					/>
				</div>
				{localErr ? <p className="text-destructive text-sm sm:col-span-2">{localErr}</p> : null}
				<div className="sm:col-span-2">
					<Button
						type="button"
						size="lg"
						className="min-h-11"
						disabled={update.isPending}
						onClick={save}
					>
						{update.isPending ? "Saving…" : "Save and continue"}
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
