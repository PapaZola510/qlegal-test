"use client"

import * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/core/components/ui/alert"
import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"

import { lookupCertificate, type CertificateData } from "../lib/fixtures"

interface VerifyCertificateContentProps {
	initialId: string
}

export function VerifyCertificateContent({ initialId }: VerifyCertificateContentProps) {
	const [searchId, setSearchId] = React.useState(initialId || "")
	const [result, setResult] = React.useState<CertificateData | null | undefined>(() => {
		if (initialId) return lookupCertificate(initialId)
		return undefined
	})

	function handleSearch(e: React.FormEvent) {
		e.preventDefault()
		if (!searchId.trim()) return
		const found = lookupCertificate(searchId)
		setResult(found)
	}

	return (
		<div className="mx-auto max-w-lg space-y-6">
			<div className="space-y-2 text-center">
				<h1 className="text-2xl font-semibold tracking-tight">Verify Certificate</h1>
				<p className="text-muted-foreground text-sm">
					Confirm the authenticity of an Electronic Notary Public certificate.
				</p>
				<p className="text-muted-foreground text-xs">
					<a href="/verify/document" className="underline underline-offset-2">
						Verify a notarized document (PDF)
					</a>{" "}
					instead
				</p>
			</div>

			{/* Search */}
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Search by Certificate ID</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSearch} className="flex gap-2">
						<div className="flex-1 space-y-1.5">
							<Label htmlFor="cert-id" className="sr-only">
								Certificate ID
							</Label>
							<Input
								id="cert-id"
								placeholder="e.g. CERT-2024-001"
								value={searchId}
								onChange={e => setSearchId(e.target.value)}
							/>
						</div>
						<Button type="submit" className="self-end">
							Verify
						</Button>
					</form>
					<p className="text-muted-foreground mt-2 text-xs">
						Try:{" "}
						<code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">
							CERT-2024-001
						</code>{" "}
						(valid) or{" "}
						<code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">
							CERT-2024-002
						</code>{" "}
						(expired)
					</p>
				</CardContent>
			</Card>

			{/* Result */}
			{result !== undefined && (
				<>
					{result === null ? (
						<Alert variant="destructive">
							<AlertTitle>Certificate Not Found</AlertTitle>
							<AlertDescription>
								No certificate matching &ldquo;{searchId}&rdquo; was found in our records. Please
								double-check the ID and try again.
							</AlertDescription>
						</Alert>
					) : result.status === "valid" ? (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-sm">
									Certificate Details
									<Badge>Valid</Badge>
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="grid gap-3 text-sm">
									<div className="flex justify-between">
										<span className="text-muted-foreground">Certificate ID</span>
										<span className="font-mono">{result.id}</span>
									</div>
									<Separator />
									<div className="flex justify-between">
										<span className="text-muted-foreground">Holder</span>
										<span className="font-medium">{result.holderName}</span>
									</div>
									<Separator />
									<div className="flex justify-between">
										<span className="text-muted-foreground">Type</span>
										<span>{result.certificateType}</span>
									</div>
									<Separator />
									<div className="flex justify-between">
										<span className="text-muted-foreground">Issued</span>
										<span>{result.issuedDate}</span>
									</div>
									<Separator />
									<div className="flex justify-between">
										<span className="text-muted-foreground">Expires</span>
										<span>{result.expiryDate}</span>
									</div>
								</div>
							</CardContent>
						</Card>
					) : (
						<Alert variant="destructive">
							<AlertTitle>Certificate Invalid / Expired</AlertTitle>
							<AlertDescription>
								The certificate <strong>{result.id}</strong> issued to{" "}
								<strong>{result.holderName}</strong> has expired on {result.expiryDate}. It is no
								longer valid for notarial acts.
							</AlertDescription>
						</Alert>
					)}
				</>
			)}

			{/* Rate-limit copy */}
			<p className="text-muted-foreground text-center text-xs">
				Verification lookups are rate-limited. If you are unable to verify, please wait a few
				minutes before trying again.
			</p>
		</div>
	)
}
