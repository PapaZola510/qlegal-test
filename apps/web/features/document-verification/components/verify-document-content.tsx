"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { Alert, AlertDescription, AlertTitle } from "@/core/components/ui/alert"
import { Badge } from "@/core/components/ui/badge"
import { Button, buttonVariants } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/core/components/ui/tabs"
import { cn } from "@/core/lib/utils"

import {
	getCertificateOfCompletionUrl,
	verifyDocumentByCode,
	verifyDocumentByUpload,
	type VerifyDocumentResponse,
} from "../lib/verify-document-api"

const MAX_PDF_MB = 20

export function VerifyDocumentContent() {
	const searchParams = useSearchParams()
	const [code, setCode] = React.useState(() => searchParams.get("code") ?? "")
	const [actNumber, setActNumber] = React.useState(() => searchParams.get("actNumber") ?? "")
	const [file, setFile] = React.useState<File | null>(null)
	const [loading, setLoading] = React.useState(false)
	const [error, setError] = React.useState<string | null>(null)
	const [result, setResult] = React.useState<VerifyDocumentResponse | null>(null)
	const [certificateOpen, setCertificateOpen] = React.useState(false)
	const codeFromUrl = searchParams.get("code")?.trim()
	const [tab, setTab] = React.useState<"code" | "upload">(() => (codeFromUrl ? "code" : "upload"))

	React.useEffect(() => {
		const fromUrlCode = searchParams.get("code")
		const fromUrlAct = searchParams.get("actNumber")
		if (fromUrlCode) setCode(fromUrlCode)
		if (fromUrlAct) setActNumber(fromUrlAct)
		if (fromUrlCode?.trim()) setTab("code")
	}, [searchParams])

	async function runVerify(mode: "code" | "upload") {
		setError(null)
		setResult(null)
		setCertificateOpen(false)
		setLoading(true)
		try {
			if (mode === "code") {
				if (!code.trim()) {
					setError("Enter the document code from the notarized PDF or QR.")
					return
				}
				const data = await verifyDocumentByCode({
					code: code.trim(),
					actNumber: actNumber.trim() || undefined,
				})
				setResult(data)
			} else {
				if (!file) {
					setError("Choose a PDF file to upload.")
					return
				}
				if (file.size > MAX_PDF_MB * 1024 * 1024) {
					setError(`PDF must be ${MAX_PDF_MB}MB or smaller.`)
					return
				}
				const data = await verifyDocumentByUpload({ file })
				setResult(data)
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Verification failed.")
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="mx-auto max-w-lg space-y-6">
			<div className="space-y-2 text-center">
				<h1 className="text-2xl font-semibold tracking-tight">Verify Notarized Document</h1>
				<p className="text-muted-foreground text-sm">
					Confirm that a notarized PDF from Quanby Legal is authentic and untampered.
				</p>
				<p className="text-muted-foreground text-xs">
					The <strong>document code</strong> is assigned when notarization completes.
					Find it on the sealed PDF, in the QR, or in your{" "}
					<a href="/registry" className="underline underline-offset-2">
						Notarial Book
					</a>{" "}
					entry (expand a row). You can also upload the PDF without the code.
				</p>
				<p className="text-muted-foreground text-xs">
					<a href="/verify" className="underline underline-offset-2">
						Verify an ENP certificate
					</a>{" "}
					instead
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Document verification</CardTitle>
					<CardDescription className="text-xs">
						Upload the notarized PDF (max {MAX_PDF_MB}MB), or switch to document code if you have
						the code from the sealed PDF or QR.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Tabs value={tab} onValueChange={v => setTab(v as "code" | "upload")}>
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="upload">Upload PDF</TabsTrigger>
							<TabsTrigger value="code">Document code</TabsTrigger>
						</TabsList>

						<TabsContent value="upload" className="mt-4 space-y-3">
							<div className="space-y-1.5">
								<Label htmlFor="pdf-file">Notarized PDF</Label>
								<Input
									id="pdf-file"
									type="file"
									accept="application/pdf,.pdf"
									onChange={e => setFile(e.target.files?.[0] ?? null)}
								/>
							</div>
							<Button
								type="button"
								className="w-full"
								disabled={loading}
								onClick={() => void runVerify("upload")}
							>
								{loading ? "Verifying…" : "Upload and verify"}
							</Button>
						</TabsContent>

						<TabsContent value="code" className="mt-4 space-y-3">
							<div className="space-y-1.5">
								<Label htmlFor="doc-code">Document code</Label>
								<Input
									id="doc-code"
									placeholder="e.g. DCMMKVRK737H6H"
									value={code}
									onChange={e => setCode(e.target.value)}
									autoComplete="off"
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="act-number">Act number (optional)</Label>
								<Input
									id="act-number"
									placeholder="Registry act number"
									value={actNumber}
									onChange={e => setActNumber(e.target.value)}
									autoComplete="off"
								/>
							</div>
							<Button
								type="button"
								className="w-full"
								disabled={loading}
								onClick={() => void runVerify("code")}
							>
								{loading ? "Verifying…" : "Verify by code"}
							</Button>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			{error ? (
				<Alert variant="destructive">
					<AlertTitle>Verification error</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			{result ? (
				result.isValid ? (
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-sm">
								Document verified
								<Badge>Authentic</Badge>
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 text-sm">
							<p className="text-muted-foreground">{result.message}</p>
							<div className="grid gap-3">
								{result.documentCode ? (
									<>
										<div className="flex justify-between gap-4">
											<span className="text-muted-foreground shrink-0">Document code</span>
											<span className="text-right font-mono">{result.documentCode}</span>
										</div>
										<Separator />
									</>
								) : null}
								{result.actNumber ? (
									<>
										<div className="flex justify-between gap-4">
											<span className="text-muted-foreground">Act number</span>
											<span className="font-mono">{result.actNumber}</span>
										</div>
										<Separator />
									</>
								) : null}
								{result.title ? (
									<>
										<div className="flex justify-between gap-4">
											<span className="text-muted-foreground">Title</span>
											<span className="text-right">{result.title}</span>
										</div>
										<Separator />
									</>
								) : null}
								{result.enpName ? (
									<>
										<div className="flex justify-between gap-4">
											<span className="text-muted-foreground">Notary</span>
											<span className="text-right font-medium">{result.enpName}</span>
										</div>
										<Separator />
									</>
								) : null}
								<div className="flex justify-between gap-4">
									<span className="text-muted-foreground">Verified at</span>
									<span>{new Date(result.verifiedAt).toLocaleString()}</span>
								</div>
							</div>
							{result.verificationDetails ? (
								<div className="space-y-3 border-t pt-3">
									<p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
										Verification details
									</p>
									{result.verificationDetails.documentName ? (
										<div className="flex justify-between gap-4 text-sm">
											<span className="text-muted-foreground shrink-0">Document</span>												<span className="text-right">{result.verificationDetails.documentName}</span>
										</div>
									) : null}
									{result.verificationDetails.projectName ? (
										<div className="flex justify-between gap-4 text-sm">
											<span className="text-muted-foreground shrink-0">Project</span>												<span className="text-right">{result.verificationDetails.projectName}</span>
										</div>
									) : null}
									{result.verificationDetails.projectReferenceNumber ? (
										<div className="flex justify-between gap-4 text-sm">
											<span className="text-muted-foreground shrink-0">Reference</span>
											<span className="text-right font-mono">													{result.verificationDetails.projectReferenceNumber}
											</span>
										</div>
									) : null}
									{result.verificationDetails.verificationDate ? (
										<div className="flex justify-between gap-4 text-sm">
											<span className="text-muted-foreground shrink-0">verified</span>
											<span className="text-right">															{new Date(result.verificationDetails.verificationDate).toLocaleString()}
											</span>
										</div>
									) : null}
									{result.verificationDetails.signers.length > 0 ? (
										<div className="space-y-2">
											<p className="text-muted-foreground text-xs">Signers</p>
											<ul className="space-y-2 text-sm">													{result.verificationDetails.signers.map(signer => (
													<li
														key={`${signer.email}-${signer.signedAt ?? ""}`}
														className="rounded-md border px-3 py-2"
													>
														<p className="font-medium">{signer.name}</p>
														<p className="text-muted-foreground text-xs">{signer.email}</p>
														<p className="text-muted-foreground mt-1 text-xs">
															{signer.status}
															{signer.signedAt
																? ` · ${new Date(signer.signedAt).toLocaleString()}`
																: ""}
														</p>
													</li>
												))}
											</ul>
										</div>
									) : null}
								</div>
							) : null}
							{result.hasCertificateOfCompletion && result.certificateAccessKey ? (
								<div className="flex flex-col gap-2 pt-2 sm:flex-row">
									<Button
										type="button"
										variant="default"
										className="flex-1"
										onClick={() => setCertificateOpen(true)}
									>
										View Certificate of Completion
									</Button>
									<a
										href={getCertificateOfCompletionUrl(result.certificateAccessKey, {
											download: true,
										})}
										download="certificate-of-completion.pdf"
										className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
									>
										Download certificate
									</a>
								</div>
							) : null}
						</CardContent>
					</Card>
				) : (
					<Alert variant="destructive">
						<AlertTitle>Not verified</AlertTitle>
						<AlertDescription>
							{result.reason ??
								result.message ??
								"This document could not be verified as an authentic notarized instrument from our platform."}
						</AlertDescription>
					</Alert>
				)
			) : null}

			<p className="text-muted-foreground text-center text-xs">
				Verification is performed against our notarial records. Lookups are rate-limited per IP.
			</p>

			{result?.isValid && result.certificateAccessKey && result.hasCertificateOfCompletion ? (
				<Dialog open={certificateOpen} onOpenChange={setCertificateOpen}>
					<DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 p-0 sm:max-w-4xl">
						<DialogHeader className="border-b px-4 py-3">
							<DialogTitle className="text-sm">Certificate of Completion</DialogTitle>
							<DialogDescription className="text-xs">
								Official audit trail for this notarized document (signature timestamps,
								authentication key, and recipient activity).
							</DialogDescription>
						</DialogHeader>
						<div className="min-h-0 flex-1 p-2">
							<iframe
								title="Certificate of Completion"
								src={getCertificateOfCompletionUrl(result.certificateAccessKey)}
								className="bg-muted h-[min(70vh,720px)] w-full rounded-md border"
							/>
						</div>
						<div className="flex justify-end gap-2 border-t px-4 py-3">
							<a
								href={getCertificateOfCompletionUrl(result.certificateAccessKey, {
									download: true,
								})}
								download="certificate-of-completion.pdf"
								className={buttonVariants({ variant: "outline" })}
							>
								Download PDF
							</a>
							<Button type="button" onClick={() => setCertificateOpen(false)}>
								Close
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			) : null}
		</div>
	)
}
