"use client"

import * as React from "react"
import { toast } from "sonner"

import type { EnbAccessRequest, EnbEntryLookupResult, UserProfile } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/core/components/ui/select"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/core/components/ui/table"
import { Textarea } from "@/core/components/ui/textarea"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { useNotaryDirectoryQuery } from "@/features/appointments/api/appointments.hooks"
import {
	EnbSignaturePad,
	type EnbSignaturePadHandle,
} from "@/features/appointments/components/meeting/enb-signature-pad"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import { isProfileKycVerified } from "@/features/kyc/lib/profile-kyc-gate"
import { defaultRequesterAddress } from "@/features/signed/components/request-ctc-modal"

import {
	useEnbAccessMyRequestsQuery,
	useLookupEnbEntryMutation,
	useSubmitVirtualEnbAccessMutation,
} from "../api/enb-access.hooks"

const ACK_TEXT =
	"I virtually request to inspect and/or copy entries in the Electronic Notarial Book described below and affirm that the information provided is true."

function outcomeBadge(outcome: EnbAccessRequest["outcome"]) {
	if (outcome === "granted") return <Badge className="text-[10px]">Granted</Badge>
	if (outcome === "refused")
		return (
			<Badge variant="destructive" className="text-[10px]">
				Refused
			</Badge>
		)
	return (
		<Badge variant="outline" className="text-[10px]">
			Pending
		</Badge>
	)
}

function defaultRequesterName(profile: UserProfile | undefined): string {
	return profile?.name?.trim() ?? ""
}

function EntryPreview({ lookup }: { lookup: EnbEntryLookupResult }) {
	return (
		<div className="bg-muted/40 space-y-1 rounded-md border px-3 py-2 text-xs">
			<p>
				<span className="text-muted-foreground">Notary:</span>{" "}
				<span className="font-medium">{lookup.enpName}</span>
			</p>
			<p>
				<span className="text-muted-foreground">Book:</span>{" "}
				<span className="font-mono font-medium">{lookup.bookNo}</span>
			</p>
			{lookup.entryNumber ? (
				<p>
					<span className="text-muted-foreground">Entry:</span>{" "}
					<span className="font-mono font-medium">{lookup.entryNumber}</span>
					{lookup.pageNo ? (
						<span className="text-muted-foreground"> · Page {lookup.pageNo}</span>
					) : null}
				</p>
			) : (
				<p className="text-muted-foreground">Book-level request (all entries in this book)</p>
			)}
			{lookup.title ? (
				<p>
					<span className="text-muted-foreground">Document:</span>{" "}
					<span className="font-medium">{lookup.title}</span>
				</p>
			) : null}
		</div>
	)
}

export function EnbAccessRequestContent() {
	const profileQ = useAuthProfileMeQuery()
	const profile = profileQ.data as UserProfile | undefined
	const kycVerified = isProfileKycVerified(profile?.identityStatus)
	const isClient = profile?.role === "client"

	const directoryQ = useNotaryDirectoryQuery({})
	const myRequestsQ = useEnbAccessMyRequestsQuery(!profileQ.isPending)
	const lookupMutation = useLookupEnbEntryMutation()
	const submitMutation = useSubmitVirtualEnbAccessMutation()

	const padRef = React.useRef<EnbSignaturePadHandle | null>(null)
	const [enpUserId, setEnpUserId] = React.useState("")
	const [bookNo, setBookNo] = React.useState("")
	const [entryNumber, setEntryNumber] = React.useState("")
	const [requestType, setRequestType] = React.useState<"inspect" | "copy">("inspect")
	const [requesterName, setRequesterName] = React.useState("")
	const [requesterAddress, setRequesterAddress] = React.useState("")
	const [lawfulPurpose, setLawfulPurpose] = React.useState("")
	const [lookup, setLookup] = React.useState<EnbEntryLookupResult | null>(null)
	const [formError, setFormError] = React.useState<string | null>(null)

	React.useEffect(() => {
		if (!profile) return
		setRequesterName(defaultRequesterName(profile))
		setRequesterAddress(defaultRequesterAddress(profile))
	}, [profile])

	React.useEffect(() => {
		setLookup(null)
	}, [enpUserId, bookNo, entryNumber])

	const notaries = directoryQ.data ?? []
	const myRequests = Array.isArray(myRequestsQ.data) ? myRequestsQ.data : []
	const virtualRequests = myRequests.filter(r => !r.certifiedTrueCopy)

	async function handleLookup() {
		if (!enpUserId.trim() || !bookNo.trim()) {
			toast.error("Select a notary and enter a book number first.")
			return
		}
		try {
			const result = await lookupMutation.mutateAsync({
				enpUserId: enpUserId.trim(),
				bookNo: bookNo.trim(),
				entryNumber: entryNumber.trim() || undefined,
			})
			setLookup(result)
		} catch (e) {
			setLookup(null)
			toast.error(getOrpcMutationErrorMessage(e, "Could not find that ENB entry."))
		}
	}

	async function handleSubmit() {
		setFormError(null)
		if (!enpUserId.trim() || !bookNo.trim()) {
			setFormError("Select a notary and enter a book number.")
			return
		}
		if (!lookup) {
			setFormError("Look up the book or entry before submitting.")
			return
		}
		if (!requesterName.trim() || !requesterAddress.trim() || !lawfulPurpose.trim()) {
			setFormError("Name, address, and lawful purpose are required.")
			return
		}
		const signatureImageData = padRef.current?.getSignatureDataUrl()
		if (!signatureImageData) {
			setFormError("Draw your e-signature in the pad above.")
			return
		}

		try {
			await submitMutation.mutateAsync({
				enpUserId: enpUserId.trim(),
				registryActId: lookup.registryActId ?? undefined,
				bookNo: bookNo.trim(),
				entryNumber: entryNumber.trim() || undefined,
				requestType,
				requesterName: requesterName.trim(),
				requesterAddress: requesterAddress.trim(),
				lawfulPurpose: lawfulPurpose.trim(),
				signatureImageData,
			})
			toast.success("Virtual ENB access request sent to the notary.")
			setLookup(null)
			setLawfulPurpose("")
			padRef.current?.clear()
		} catch (e) {
			setFormError(getOrpcMutationErrorMessage(e, "Could not submit your request."))
		}
	}

	if (profileQ.isPending) {
		return <p className="text-muted-foreground text-sm">Loading…</p>
	}

	return (
		<div className="space-y-6">
			<div className="bg-muted/40 rounded-lg border px-4 py-3 text-sm">
				<p className="text-muted-foreground">
					Under ENB Rule (c), you may{" "}
					<strong className="text-foreground font-medium">virtually request</strong> to inspect or
					copy entries in an Electronic Notarial Book through the ENF. Your notary reviews and
					grants or refuses the request — the same workflow as appearing in person.
				</p>
			</div>

			{isClient && !kycVerified ? (
				<p className="text-destructive text-sm" role="alert">
					Complete identity verification on your Profile before submitting a virtual ENB access
					request.
				</p>
			) : null}

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Submit virtual inspect / copy request</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="enb-notary">Notary (ENP)</Label>
							<Select value={enpUserId} onValueChange={v => setEnpUserId(v ?? "")}>
								<SelectTrigger id="enb-notary" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{notaries.map(n => (
										<SelectItem key={n.id} value={n.id}>
											{n.firstName} {n.lastName}
											{n.city ? ` · ${n.city}` : ""}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="enb-book">Book number</Label>
							<Input
								id="enb-book"
								value={bookNo}
								onChange={e => setBookNo(e.target.value)}
								placeholder="e.g. ENB-2026-01"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="enb-entry">Entry number (optional)</Label>
							<Input
								id="enb-entry"
								value={entryNumber}
								onChange={e => setEntryNumber(e.target.value)}
								placeholder="e.g. 16-016-06-2026"
							/>
							<p className="text-muted-foreground text-[11px]">
								Leave blank to request access to the whole book.
							</p>
						</div>

						<div className="space-y-2 sm:col-span-2">
							<Button
								type="button"
								variant="secondary"
								size="sm"
								disabled={lookupMutation.isPending || !enpUserId || !bookNo.trim()}
								onClick={() => void handleLookup()}
							>
								{lookupMutation.isPending ? "Looking up…" : "Look up entry"}
							</Button>
						</div>
					</div>

					{lookup ? <EntryPreview lookup={lookup} /> : null}

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="enb-request-type">Request type</Label>
							<Select
								value={requestType}
								onValueChange={v => setRequestType(v as "inspect" | "copy")}
							>
								<SelectTrigger id="enb-request-type">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="inspect">Inspect</SelectItem>
									<SelectItem value="copy">Copy</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="space-y-1.5">
						<p className="text-muted-foreground text-xs">Acknowledgment</p>
						<div className="bg-muted/40 rounded-md border px-3 py-2">
							<p className="text-xs leading-relaxed">{ACK_TEXT}</p>
						</div>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="enb-name">Your name</Label>
							<Input
								id="enb-name"
								value={requesterName}
								onChange={e => setRequesterName(e.target.value)}
							/>
						</div>
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="enb-address">Your address</Label>
							<Textarea
								id="enb-address"
								value={requesterAddress}
								onChange={e => setRequesterAddress(e.target.value)}
								rows={2}
							/>
						</div>
						<div className="space-y-2 sm:col-span-2">
							<Label htmlFor="enb-purpose">Lawful purpose</Label>
							<Textarea
								id="enb-purpose"
								value={lawfulPurpose}
								onChange={e => setLawfulPurpose(e.target.value)}
								placeholder="e.g. Court subpoena compliance, title transfer, due diligence"
								rows={3}
							/>
						</div>
					</div>

					<EnbSignaturePad
						ref={padRef}
						disabled={submitMutation.isPending || (isClient && !kycVerified)}
					/>

					{formError ? (
						<p className="text-destructive text-xs" role="alert">
							{formError}
						</p>
					) : null}

					<Button
						type="button"
						disabled={submitMutation.isPending || !lookup || (isClient && !kycVerified)}
						onClick={() => void handleSubmit()}
					>
						{submitMutation.isPending ? "Submitting…" : "Submit virtual request"}
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Your ENB access requests</CardTitle>
				</CardHeader>
				<CardContent>
					{myRequestsQ.isLoading ? (
						<p className="text-muted-foreground text-sm">Loading your requests…</p>
					) : virtualRequests.length === 0 ? (
						<p className="text-muted-foreground text-sm">
							No virtual inspect or copy requests yet. Certified true copy requests from Signed
							documents appear on your notary&apos;s registry separately.
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Date</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Entry</TableHead>
									<TableHead>Outcome</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{virtualRequests.map(row => (
									<TableRow key={row.id}>
										<TableCell className="text-xs">
											{new Date(row.requestedAt).toLocaleDateString()}
										</TableCell>
										<TableCell className="text-xs capitalize">{row.requestType}</TableCell>
										<TableCell className="font-mono text-xs">
											{row.entryNumber ?? row.bookNo ?? "—"}
										</TableCell>
										<TableCell>{outcomeBadge(row.outcome)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
