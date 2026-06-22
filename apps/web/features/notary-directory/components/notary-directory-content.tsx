"use client"

import * as React from "react"

import { ErrorState, LoadingState } from "@/core/components/shared-states"
import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { Label } from "@/core/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/core/components/ui/select"
import { Slider } from "@/core/components/ui/slider"
import {
	useNotaryDirectoryQuery,
	type NotaryDirectoryEntry,
} from "@/features/appointments/api/appointments.hooks"

import { PROVINCES, type NotaryProfile } from "../lib/fixtures"
import { AppointmentRequestForm } from "./appointment-request-form"
import { NotaryCard } from "./notary-card"
import { NotaryProfileSheet } from "./notary-profile-sheet"

const MAX_SLIDER_FEE = 1000
const FEE_STEP = 50

function mapDirectoryEntryToNotary(entry: NotaryDirectoryEntry): NotaryProfile {
	return {
		id: entry.id,
		firstName: entry.firstName,
		lastName: entry.lastName,
		email: entry.email,
		phone: "Hidden until booking",
		avatarUrl: null,
		npn: "Registered ENP",
		commissionArea: entry.province || entry.city || "Philippines",
		city: entry.city,
		province: entry.province,
		specializations: entry.specializations,
		rating: entry.rating,
		reviewCount: entry.reviewCount,
		baseFee: entry.baseFee,
		availableModes: entry.availableModes.map(mode => (mode === "in_person" ? "in-person" : mode)),
		bio: "Registered ENP listed in the verified notary directory.",
		yearsExperience: 0,
		isAvailable: true,
	}
}

export function NotaryDirectoryContent() {
	const [province, setProvince] = React.useState("")
	const [maxFee, setMaxFee] = React.useState(MAX_SLIDER_FEE)

	const [profileNotary, setProfileNotary] = React.useState<NotaryProfile | null>(null)
	const [profileOpen, setProfileOpen] = React.useState(false)
	const [bookingNotary, setBookingNotary] = React.useState<NotaryProfile | null>(null)
	const directoryQuery = useNotaryDirectoryQuery({
		maxBaseFee: maxFee < MAX_SLIDER_FEE ? maxFee : undefined,
	})

	const notaries = React.useMemo(
		() =>
			(directoryQuery.data ?? [])
				.filter(entry => {
					if (!province) return true
					return entry.province === province
				})
				.map(mapDirectoryEntryToNotary),
		[directoryQuery.data, province]
	)

	function openProfile(notary: NotaryProfile) {
		setProfileNotary(notary)
		setProfileOpen(true)
	}

	function startBooking(notary: NotaryProfile) {
		setBookingNotary(notary)
		setProfileOpen(false)
	}

	function clearFilters() {
		setProvince("")
		setMaxFee(MAX_SLIDER_FEE)
	}

	return (
		<>
			{/* Filters */}
			<div className="bg-muted/40 rounded-lg border p-4">
				<div className="flex flex-wrap items-end gap-4">
					<div className="w-44 space-y-1.5">
						<Label className="text-xs">Province / City</Label>
						<Select value={province} onValueChange={v => setProvince(v ?? "")}>
							<SelectTrigger className="w-full">
								{province ? <SelectValue /> : <span className="text-muted-foreground">Any</span>}
							</SelectTrigger>
							<SelectContent>
								{PROVINCES.map(p => (
									<SelectItem key={p} value={p}>
										{p}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="w-56 space-y-1.5">
						<Label className="text-xs">
							Max Fee: {maxFee >= MAX_SLIDER_FEE ? "Any" : `₱${maxFee.toLocaleString()}`}
						</Label>
						<Slider
							min={0}
							max={MAX_SLIDER_FEE}
							step={FEE_STEP}
							value={[maxFee]}
							onValueChange={v => {
								const arr = Array.isArray(v) ? v : [v]
								setMaxFee(arr[0] ?? MAX_SLIDER_FEE)
							}}
						/>
					</div>

					<Button variant="ghost" size="sm" onClick={clearFilters}>
						Clear Filters
					</Button>
				</div>
			</div>

			{directoryQuery.isPending ? (
				<LoadingState message="Loading registered ENPs..." />
			) : directoryQuery.isError ? (
				<ErrorState
					message="Could not fetch registered ENPs right now. Please try again."
					onRetry={() => void directoryQuery.refetch()}
				/>
			) : (
				<>
					{/* Results count */}
					<p className="text-muted-foreground text-sm">
						{notaries.length} registered ENP{notaries.length !== 1 ? "s" : ""} found
					</p>

					{/* Grid */}
					{notaries.length === 0 ? (
						<div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center text-sm">
							No registered ENPs match your filters. Try adjusting your search criteria.
						</div>
					) : (
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{notaries.map(n => (
								<NotaryCard
									key={n.id}
									notary={n}
									onViewProfile={openProfile}
									onRequestAppointment={startBooking}
								/>
							))}
						</div>
					)}
				</>
			)}

			{/* Profile sheet */}
			<NotaryProfileSheet
				notary={profileNotary}
				open={profileOpen}
				onOpenChange={setProfileOpen}
				onRequestAppointment={startBooking}
			/>

			<Dialog open={bookingNotary !== null} onOpenChange={open => !open && setBookingNotary(null)}>
				<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>Request Appointment</DialogTitle>
						<DialogDescription>
							Book a notarization session with a registered ENP.
						</DialogDescription>
					</DialogHeader>
					{bookingNotary && (
						<AppointmentRequestForm
							notary={bookingNotary}
							onCancel={() => setBookingNotary(null)}
							onSubmitted={() => setBookingNotary(null)}
						/>
					)}
				</DialogContent>
			</Dialog>
		</>
	)
}
