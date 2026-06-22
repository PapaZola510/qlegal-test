"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"

import { FIXTURE_ENP_PROFILE, type EnpProfile } from "../lib/fixtures"

interface ProfileStepProps {
	onComplete: () => void
}

export function ProfileStep({ onComplete }: ProfileStepProps) {
	const [form, setForm] = React.useState<EnpProfile>(FIXTURE_ENP_PROFILE)

	function update(field: keyof EnpProfile, value: string) {
		setForm(prev => ({ ...prev, [field]: value }))
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Personal Information</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 sm:grid-cols-3">
						<div className="space-y-1.5">
							<Label htmlFor="firstName">First Name</Label>
							<Input
								id="firstName"
								value={form.firstName}
								onChange={e => update("firstName", e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="middleName">Middle Name</Label>
							<Input
								id="middleName"
								value={form.middleName}
								onChange={e => update("middleName", e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="lastName">Last Name</Label>
							<Input
								id="lastName"
								value={form.lastName}
								onChange={e => update("lastName", e.target.value)}
							/>
						</div>
					</div>
					<div className="mt-4 grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								value={form.email}
								onChange={e => update("email", e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="phone">Phone</Label>
							<Input
								id="phone"
								value={form.phone}
								onChange={e => update("phone", e.target.value)}
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Notarial Credentials</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label htmlFor="rollNumber">Roll Number</Label>
							<Input
								id="rollNumber"
								value={form.rollNumber}
								onChange={e => update("rollNumber", e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="npn">Notary Public Number (NPN)</Label>
							<Input id="npn" value={form.npn} onChange={e => update("npn", e.target.value)} />
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="ptrNumber">PTR Number</Label>
							<Input
								id="ptrNumber"
								value={form.ptrNumber}
								onChange={e => update("ptrNumber", e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="ibpNumber">IBP Number</Label>
							<Input
								id="ibpNumber"
								value={form.ibpNumber}
								onChange={e => update("ibpNumber", e.target.value)}
							/>
						</div>
						<div className="space-y-1.5 sm:col-span-2">
							<Label htmlFor="mcleNumber">MCLE Compliance Number</Label>
							<Input
								id="mcleNumber"
								value={form.mcleNumber}
								onChange={e => update("mcleNumber", e.target.value)}
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Addresses</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4">
						<div className="space-y-1.5">
							<Label htmlFor="officeAddress">Office Address</Label>
							<Input
								id="officeAddress"
								value={form.officeAddress}
								onChange={e => update("officeAddress", e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="residentialAddress">Residential Address</Label>
							<Input
								id="residentialAddress"
								value={form.residentialAddress}
								onChange={e => update("residentialAddress", e.target.value)}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="commissionArea">Commission Area</Label>
							<Input
								id="commissionArea"
								value={form.commissionArea}
								onChange={e => update("commissionArea", e.target.value)}
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			<Separator />

			<div className="flex justify-end">
				<Button onClick={onComplete}>Save &amp; Continue</Button>
			</div>
		</div>
	)
}
