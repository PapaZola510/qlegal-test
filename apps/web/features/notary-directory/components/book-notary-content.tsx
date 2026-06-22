"use client"

import * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/core/components/ui/alert"
import { Button } from "@/core/components/ui/button"

import { getNotaryById } from "../lib/fixtures"
import { AppointmentRequestForm } from "./appointment-request-form"

interface BookNotaryContentProps {
	notaryId: string
}

export function BookNotaryContent({ notaryId }: BookNotaryContentProps) {
	const [done, setDone] = React.useState(false)
	const notary = getNotaryById(notaryId)

	if (!notary) {
		return (
			<div className="mx-auto max-w-lg py-10">
				<Alert variant="destructive">
					<AlertTitle>Notary Not Found</AlertTitle>
					<AlertDescription>
						The invite link is invalid or the notary ID &ldquo;{notaryId}&rdquo; does not exist.
						Please check the link and try again.
					</AlertDescription>
				</Alert>
			</div>
		)
	}

	if (done) {
		return (
			<div className="mx-auto max-w-lg py-10 text-center">
				<div className="text-primary mb-2 text-3xl">✓</div>
				<h2 className="text-lg font-semibold">All Done</h2>
				<p className="text-muted-foreground mt-1 text-sm">
					Your appointment request has been submitted. You can close this page or{" "}
					<Button variant="link" className="h-auto p-0" render={<a href="/find-notary" />}>
						browse more notaries
					</Button>
					.
				</p>
			</div>
		)
	}

	return (
		<div className="mx-auto max-w-2xl">
			<AppointmentRequestForm
				notary={notary}
				onCancel={() => (window.location.href = "/find-notary")}
				onSubmitted={() => setDone(true)}
			/>
		</div>
	)
}
