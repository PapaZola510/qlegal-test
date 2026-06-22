"use client"

import * as React from "react"
import Link from "next/link"

import { Button, buttonVariants } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"

import { CLIENT_STEPS, FIXTURE_CLIENT_PROFILE } from "../lib/fixtures"
import { HorizontalStepper } from "./horizontal-stepper"

export function ClientOnboarding() {
	const [step, setStep] = React.useState(0)
	const [form, setForm] = React.useState(FIXTURE_CLIENT_PROFILE)

	if (step >= CLIENT_STEPS.length) {
		return (
			<div className="mx-auto max-w-2xl space-y-6">
				<HorizontalStepper steps={CLIENT_STEPS} currentIndex={CLIENT_STEPS.length} />
				<Card>
					<CardHeader>
						<CardTitle>You&apos;re all set!</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground text-sm">
							Your profile is complete. You can now access the dashboard to start using qLegal
							services.
						</p>
						<Link href="/dashboard" className={buttonVariants()}>
							Go to Dashboard
						</Link>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<HorizontalStepper
				steps={CLIENT_STEPS}
				currentIndex={step}
				onStepClick={i => i < step && setStep(i)}
			/>

			<Card>
				<CardHeader>
					<CardTitle>Your Profile</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label htmlFor="c-firstName">First Name</Label>
							<Input
								id="c-firstName"
								value={form.firstName}
								onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="c-lastName">Last Name</Label>
							<Input
								id="c-lastName"
								value={form.lastName}
								onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="c-email">Email</Label>
							<Input
								id="c-email"
								type="email"
								value={form.email}
								onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="c-phone">Phone</Label>
							<Input
								id="c-phone"
								value={form.phone}
								onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			<div className="flex justify-end">
				<Button onClick={() => setStep(1)}>Save &amp; Continue</Button>
			</div>
		</div>
	)
}
