"use client"

import * as React from "react"
import { toast } from "sonner"

import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import type { CtcComplianceForm, EnbAccessRequest } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
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

import {
	useCreateEnbAccessRequestMutation,
	useDecideEnbAccessRequestMutation,
} from "../api/registry.hooks"
import type { RegistryAct } from "../lib/fixtures"
import { CtcGrantComplianceDialog } from "./ctc-grant-compliance-dialog"

interface EnbAccessRequestsPanelProps {
	registryActOptions: { id: string; label: string }[]
	registryActs?: RegistryAct[]
	requests: EnbAccessRequest[]
	isLoading?: boolean
	isError?: boolean
	onRetry?: () => void
	openDecideRequestId?: string | null
	onOpenDecideRequestIdChange?: (id: string | null) => void
}

function outcomeBadge(outcome: EnbAccessRequest["outcome"]) {
	if (outcome === "granted") return <Badge>Granted</Badge>
	if (outcome === "refused") return <Badge variant="destructive">Refused</Badge>
	return <Badge variant="outline">Pending</Badge>
}

function ctcPaymentBadge(row: EnbAccessRequest) {
	if (!row.certifiedTrueCopy) {
		return <span className="text-muted-foreground text-xs">—</span>
	}

	if (row.requesterPaymentMethod !== "online") {
		return (
			<Badge variant="outline" className="text-[9px]">
				Cash
			</Badge>
		)
	}

	const status = row.ctcPaymentStatus
	if (status === "succeeded") {
		return (
			<Badge className="bg-emerald-600/90 text-[9px] hover:bg-emerald-600/90">Paid online</Badge>
		)
	}
	if (status === "processing" || status === "pending") {
		return (
			<Badge
				variant="outline"
				className="border-amber-500/50 bg-amber-500/15 text-[9px] text-amber-100"
			>
				Payment pending
			</Badge>
		)
	}
	if (status === "failed") {
		return (
			<Badge variant="destructive" className="text-[9px]">
				Payment failed
			</Badge>
		)
	}
	if (status === "cancelled") {
		return (
			<Badge variant="outline" className="text-[9px]">
				Payment cancelled
			</Badge>
		)
	}

	return (
		<Badge
			variant="outline"
			className="border-amber-500/50 bg-amber-500/15 text-[9px] text-amber-100"
		>
			Unpaid
		</Badge>
	)
}

export function EnbAccessRequestsPanel({
	registryActOptions,
	registryActs = [],
	requests,
	isLoading = false,
	isError = false,
	onRetry,
	openDecideRequestId = null,
	onOpenDecideRequestIdChange,
}: EnbAccessRequestsPanelProps) {
	const createMutation = useCreateEnbAccessRequestMutation()
	const decideMutation = useDecideEnbAccessRequestMutation()

	const [createOpen, setCreateOpen] = React.useState(false)
	const [decideTarget, setDecideTarget] = React.useState<EnbAccessRequest | null>(null)
	const [refusalReason, setRefusalReason] = React.useState("")

	const [requestType, setRequestType] = React.useState<"inspect" | "copy">("inspect")
	const [registryActId, setRegistryActId] = React.useState("")
	const [bookNo, setBookNo] = React.useState("")
	const [requesterName, setRequesterName] = React.useState("")
	const [requesterAddress, setRequesterAddress] = React.useState("")
	const [lawfulPurpose, setLawfulPurpose] = React.useState("")

	const rows = requests
	const pendingCtcCount = rows.filter(r => r.certifiedTrueCopy && r.outcome === "pending").length

	React.useEffect(() => {
		if (!openDecideRequestId) return
		const match = rows.find(r => r.id === openDecideRequestId)
		if (match) {
			setDecideTarget(match)
			onOpenDecideRequestIdChange?.(null)
		}
	}, [openDecideRequestId, onOpenDecideRequestIdChange, rows])

	async function submitCreate() {
		if (!requesterName.trim() || !requesterAddress.trim() || !lawfulPurpose.trim()) {
			toast.error("Requester name, address, and lawful purpose are required")
			return
		}
		if (!registryActId.trim() && !bookNo.trim()) {
			toast.error("Link to a registry entry or specify a book number")
			return
		}
		try {
			await createMutation.mutateAsync({
				requestType,
				registryActId: registryActId.trim() || undefined,
				bookNo: bookNo.trim() || undefined,
				requesterName: requesterName.trim(),
				requesterAddress: requesterAddress.trim(),
				lawfulPurpose: lawfulPurpose.trim(),
			})
			toast.success("ENB access request logged")
			setCreateOpen(false)
			setRequesterName("")
			setRequesterAddress("")
			setLawfulPurpose("")
			setRegistryActId("")
			setBookNo("")
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not log request")
		}
	}

	const linkedRegistryAct = decideTarget?.registryActId
		? registryActs.find(a => a.id === decideTarget.registryActId)
		: undefined

	async function submitDecision(
		outcome: "granted" | "refused",
		opts?: {
			ctcCompliance?: CtcComplianceForm
			enpSignatureImageData?: string
			refusalReason?: string
		}
	) {
		if (!decideTarget) return
		const resolvedRefusalReason = opts?.refusalReason ?? refusalReason
		if (outcome === "refused" && !resolvedRefusalReason.trim()) {
			toast.error("Refusal reason is required")
			return
		}
		try {
			await decideMutation.mutateAsync({
				id: decideTarget.id,
				outcome,
				refusalReason: outcome === "refused" ? resolvedRefusalReason.trim() : undefined,
				ctcCompliance: opts?.ctcCompliance,
				enpSignatureImageData: opts?.enpSignatureImageData,
			})
			toast.success(outcome === "granted" ? "Request granted" : "Request refused and recorded")
			setDecideTarget(null)
			setRefusalReason("")
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not update request"))
		}
	}

	return (
		<div id="enb-access-requests" className="scroll-mt-6 space-y-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h3 className="text-sm font-semibold">ENB inspect / copy requests</h3>
					<p className="text-muted-foreground text-xs">
						Principal certified true copy requests, virtual inspect/copy requests through the ENF,
						and physically logged requests (ENB Rule c).
					</p>
					{pendingCtcCount > 0 ? (
						<p className="text-primary mt-1 text-xs font-medium">
							{pendingCtcCount} certified true copy request
							{pendingCtcCount === 1 ? "" : "s"} awaiting your decision
						</p>
					) : null}
				</div>
				<Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
					Log request
				</Button>
			</div>

			{isError ? (
				<div className="bg-destructive/10 text-destructive border-destructive/30 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
					<span>Could not load ENB access requests.</span>
					{onRetry ? (
						<Button size="sm" variant="outline" onClick={() => onRetry()}>
							Retry
						</Button>
					) : null}
				</div>
			) : isLoading ? (
				<p className="text-muted-foreground text-sm">Loading access requests…</p>
			) : rows.length === 0 ? (
				<p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
					No inspect or copy requests yet. Principals can submit virtual requests from{" "}
					<strong className="text-foreground font-medium">ENB Access</strong>, certified true copy
					requests from <strong className="text-foreground font-medium">Signed</strong>, or you can
					log an in-person request with{" "}
					<strong className="text-foreground font-medium">Log request</strong>.
				</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Date</TableHead>
							<TableHead>Requester</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>Entry</TableHead>
							<TableHead>Payment</TableHead>
							<TableHead>Outcome</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map(row => (
							<TableRow
								key={row.id}
								className={
									row.certifiedTrueCopy && row.outcome === "pending" ? "bg-primary/5" : undefined
								}
							>
								<TableCell className="text-xs">
									{new Date(row.requestedAt).toLocaleDateString()}
								</TableCell>
								<TableCell className="text-xs">{row.requesterName}</TableCell>
								<TableCell className="text-xs">
									<div className="flex flex-wrap items-center gap-1">
										<span className="capitalize">{row.requestType}</span>
										{row.certifiedTrueCopy ? (
											<Badge variant="secondary" className="text-[9px]">
												CTC
											</Badge>
										) : row.requesterUserId ? (
											<Badge variant="outline" className="text-[9px]">
												Virtual
											</Badge>
										) : (
											<Badge variant="outline" className="text-[9px]">
												In person
											</Badge>
										)}
									</div>
								</TableCell>
								<TableCell className="font-mono text-xs">
									{row.entryNumber ?? row.bookNo ?? "—"}
								</TableCell>
								<TableCell>{ctcPaymentBadge(row)}</TableCell>
								<TableCell>{outcomeBadge(row.outcome)}</TableCell>
								<TableCell>
									{row.outcome === "pending" ? (
										<div className="flex flex-col items-end gap-1">
											<Button size="sm" variant="outline" onClick={() => setDecideTarget(row)}>
												Decide
											</Button>
										</div>
									) : row.refusalReason ? (
										<span className="text-muted-foreground text-xs">{row.refusalReason}</span>
									) : null}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}

			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Log ENB access request</DialogTitle>
						<DialogDescription>
							Record the requesting party, lawful purpose, and scope of the request.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<div className="space-y-2">
							<Label>Request type</Label>
							<Select
								value={requestType}
								onValueChange={v => setRequestType(v as "inspect" | "copy")}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="inspect">Inspect</SelectItem>
									<SelectItem value="copy">Copy</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Registry entry (optional)</Label>
							<Select value={registryActId} onValueChange={v => setRegistryActId(v ?? "")}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{registryActOptions.map(opt => (
										<SelectItem key={opt.id} value={opt.id}>
											{opt.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="enb-book">Book no. (if not linked to entry)</Label>
							<Input id="enb-book" value={bookNo} onChange={e => setBookNo(e.target.value)} />
						</div>
						<div className="space-y-2">
							<Label htmlFor="requester-name">Requester name</Label>
							<Input
								id="requester-name"
								value={requesterName}
								onChange={e => setRequesterName(e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="requester-address">Requester address</Label>
							<Textarea
								id="requester-address"
								value={requesterAddress}
								onChange={e => setRequesterAddress(e.target.value)}
								rows={2}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="lawful-purpose">Lawful purpose</Label>
							<Textarea
								id="lawful-purpose"
								value={lawfulPurpose}
								onChange={e => setLawfulPurpose(e.target.value)}
								rows={3}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setCreateOpen(false)}>
							Cancel
						</Button>
						<Button disabled={createMutation.isPending} onClick={() => void submitCreate()}>
							{createMutation.isPending ? "Saving…" : "Save request"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{decideTarget?.certifiedTrueCopy ? (
				<CtcGrantComplianceDialog
					open={Boolean(decideTarget)}
					onOpenChange={open => !open && setDecideTarget(null)}
					request={decideTarget}
					registryAct={linkedRegistryAct}
					isSubmitting={decideMutation.isPending}
					onGrant={({ ctcCompliance, enpSignatureImageData }) =>
						void submitDecision("granted", { ctcCompliance, enpSignatureImageData })
					}
					onRefuse={reason => void submitDecision("refused", { refusalReason: reason })}
				/>
			) : (
				<Dialog open={Boolean(decideTarget)} onOpenChange={open => !open && setDecideTarget(null)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Decide access request</DialogTitle>
							<DialogDescription>
								{decideTarget?.requesterName} — {decideTarget?.lawfulPurpose}
							</DialogDescription>
						</DialogHeader>
						{decideTarget?.requesterAddress ? (
							<p className="text-muted-foreground text-xs">
								<span className="font-medium">Address:</span> {decideTarget.requesterAddress}
							</p>
						) : null}
						{decideTarget?.registryActTitle ? (
							<p className="text-muted-foreground text-xs">
								<span className="font-medium">Document:</span> {decideTarget.registryActTitle}
								{decideTarget.entryNumber ? ` · ${decideTarget.entryNumber}` : ""}
							</p>
						) : null}
						<div className="space-y-2">
							<Label htmlFor="refusal-reason">Refusal reason (required if refusing)</Label>
							<Textarea
								id="refusal-reason"
								value={refusalReason}
								onChange={e => setRefusalReason(e.target.value)}
								rows={3}
							/>
						</div>
						<DialogFooter className="gap-2 sm:gap-0">
							<Button
								variant="outline"
								disabled={decideMutation.isPending}
								onClick={() => void submitDecision("granted")}
							>
								Grant
							</Button>
							<Button
								variant="destructive"
								disabled={decideMutation.isPending}
								onClick={() => void submitDecision("refused")}
							>
								Refuse
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</div>
	)
}
