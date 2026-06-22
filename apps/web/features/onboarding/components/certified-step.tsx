"use client"

import Link from "next/link"

import { Alert, AlertDescription, AlertTitle } from "@/core/components/ui/alert"
import { Button, buttonVariants } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"

export function CertifiedStep() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Congratulations! You are now certified.</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<Alert>
						<AlertTitle>ENP Certification Complete</AlertTitle>
						<AlertDescription>
							You have successfully completed the Electronic Notary Public certification process.
							Your certificate is now available for download.
						</AlertDescription>
					</Alert>

					<div className="bg-muted/30 rounded-lg border p-6 text-center">
						<div className="space-y-3">
							<div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
								<svg
									className="size-8 text-green-600 dark:text-green-400"
									fill="none"
									viewBox="0 0 24 24"
									strokeWidth={2}
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z"
									/>
								</svg>
							</div>
							<p className="text-lg font-semibold">Electronic Notary Public</p>
							<p className="text-muted-foreground text-sm">Certificate ID: CERT-2024-001</p>
						</div>
					</div>

					<div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
						<Button onClick={() => alert("Download PDF (fixture)")}>Download PDF</Button>
						<Button variant="outline" onClick={() => alert("Email sent (fixture)")}>
							Email me a copy
						</Button>
					</div>
				</CardContent>
			</Card>

			<div className="flex justify-center">
				<Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
					Go to Dashboard
				</Link>
			</div>
		</div>
	)
}
