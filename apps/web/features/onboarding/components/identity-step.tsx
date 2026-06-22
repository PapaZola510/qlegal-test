"use client"

import { Alert, AlertDescription, AlertTitle } from "@/core/components/ui/alert"
import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Separator } from "@/core/components/ui/separator"

import type { IdentityVerificationStatus } from "../lib/fixtures"

interface IdentityStepProps {
	status: IdentityVerificationStatus
	onContinue: () => void
	onRetake: () => void
}

const STATUS_CONFIG: Record<
	IdentityVerificationStatus,
	{
		badge: string
		variant: "default" | "secondary" | "destructive" | "outline"
		description: string
	}
> = {
	pending: {
		badge: "Pending",
		variant: "secondary",
		description:
			"Your identity verification is being processed. This usually takes 1-2 business days. You'll be notified once it's complete.",
	},
	verified: {
		badge: "Verified",
		variant: "default",
		description:
			"Your identity has been successfully verified. You may proceed to the certification exam.",
	},
	failed: {
		badge: "Failed",
		variant: "destructive",
		description:
			"Identity verification was unsuccessful. Please retake the verification process with a valid government-issued ID.",
	},
	needs_review: {
		badge: "Needs Review",
		variant: "outline",
		description:
			"Your submission requires manual review. An administrator will review your documents within 3-5 business days.",
	},
}

export function IdentityStep({ status, onContinue, onRetake }: IdentityStepProps) {
	const config = STATUS_CONFIG[status]

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						Identity Verification
						<Badge variant={config.variant}>{config.badge}</Badge>
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-muted-foreground text-sm">{config.description}</p>

					{status === "pending" && (
						<div className="bg-muted/50 rounded-lg border border-dashed p-8 text-center">
							<div className="text-muted-foreground space-y-2">
								<div className="mx-auto size-12 animate-pulse rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800" />
								<p className="text-sm font-medium">Processing verification…</p>
								<p className="text-xs">Upload your ID and take a selfie to verify your identity.</p>
							</div>
						</div>
					)}

					{status === "verified" && (
						<Alert>
							<AlertTitle>All checks passed</AlertTitle>
							<AlertDescription>
								Government ID verified • Selfie matched • Liveness confirmed
							</AlertDescription>
						</Alert>
					)}

					{(status === "failed" || status === "needs_review") && (
						<Alert variant={status === "failed" ? "destructive" : "default"}>
							<AlertTitle>
								{status === "failed" ? "Verification failed" : "Under review"}
							</AlertTitle>
							<AlertDescription>
								{status === "failed"
									? "The document submitted could not be verified. Please ensure you use a clear, non-expired government ID."
									: "A reviewer is examining your submission. No action is needed at this time."}
							</AlertDescription>
						</Alert>
					)}
				</CardContent>
			</Card>

			<Separator />

			<div className="flex justify-end gap-2">
				{(status === "failed" || status === "needs_review") && (
					<Button variant="outline" onClick={onRetake}>
						Retake Verification
					</Button>
				)}
				<Button disabled={status !== "verified"} onClick={onContinue}>
					{status === "verified" ? "Continue to Exam" : "Awaiting Verification"}
				</Button>
			</div>
		</div>
	)
}
