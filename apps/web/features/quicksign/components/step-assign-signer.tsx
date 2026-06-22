"use client"

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"

import type { SignerPayload } from "../lib/fixtures"

interface StepAssignSignerProps {
	signer: SignerPayload
	onChange: (next: SignerPayload) => void
}

export function StepAssignSigner({
	signer,
	onChange,
}: StepAssignSignerProps) {
	return (
		<Card className="mx-auto max-w-lg">
			<CardHeader>
				<CardTitle>Assign Signer</CardTitle>
				<CardDescription>Enter the principal signer details for this QuickSign.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-1.5">
					<Label htmlFor="qs-signer-email">Email</Label>
					<Input
						id="qs-signer-email"
						type="email"
						placeholder="signer@example.com"
						value={signer.email}
						onChange={e => onChange({ ...signer, email: e.target.value })}
					/>
					<p className="text-muted-foreground text-xs">
						Use the email the principal will use for the signing session.
					</p>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<div className="space-y-1.5">
						<Label htmlFor="qs-signer-first">First Name</Label>
						<Input
							id="qs-signer-first"
							placeholder="Juan"
							value={signer.firstName}
							onChange={e => onChange({ ...signer, firstName: e.target.value })}
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="qs-signer-last">Last Name</Label>
						<Input
							id="qs-signer-last"
							placeholder="Dela Cruz"
							value={signer.lastName}
							onChange={e => onChange({ ...signer, lastName: e.target.value })}
						/>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
