"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type {
	ListMeetingDocumentSignerAssignmentsResult,
	ListMeetingDocumentSignersResult,
	MeetingSignerParticipant,
} from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { Spinner } from "@/core/components/ui/spinner"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { cn } from "@/core/lib/utils"
import { orpcClient } from "@/services/orpc/client"
import {
	useListMeetingDocumentSignerAssignmentsQuery,
	useListMeetingDocumentSignersQuery,
	useMeetingSignerParticipantsQuery,
} from "@/features/appointments/api/meeting.hooks"
import { env } from "@/env"

const BOX_W = 200
const BOX_H = 60

interface PlacedField {
	signerEmail: string
	pageIndex: number
	x: number
	y: number
	width: number
	height: number
}

interface SignerDisplayInfo {
	displayName: string
	roleSuffix: string
	color: "attorney" | "signee"
}

function roleLabel(role: string): string {
	switch (role) {
		case "notary":
			return "Notary"
		case "principal":
			return "Principal"
		case "witness":
			return "Witness"
		default:
			return role
	}
}

function buildSignerInfoByEmail(
	assignments: ListMeetingDocumentSignerAssignmentsResult | undefined,
	participants: MeetingSignerParticipant[]
): Map<string, SignerDisplayInfo> {
	const map = new Map<string, SignerDisplayInfo>()
	if (!assignments?.signers) return map

	const partByUserId = new Map<string, MeetingSignerParticipant>()
	for (const p of participants) {
		partByUserId.set(p.userId, p)
	}

	for (const s of assignments.signers) {
		const part = partByUserId.get(s.userId)
		if (!part) continue
		const isNotary = s.role === "notary" || part.role === "enp"
		map.set(part.email, {
			displayName: part.displayName,
			roleSuffix: isNotary ? "Attorney" : "Signee",
			color: isNotary ? "attorney" : "signee",
		})
	}
	return map
}

export default function DocumentPlotPage({
	params,
}: {
	params: Promise<{ id: string; documentId: string }>
}) {
	const router = useRouter()
	const resolved = React.use(params)
	const meetingId = resolved.id
	const documentId = resolved.documentId
	const [isConfirming, setIsConfirming] = React.useState(false)
	const [selectedSignerEmail, setSelectedSignerEmail] = React.useState<string | null>(null)
	const [plottedFields, setPlottedFields] = React.useState<PlacedField[]>([])

	const surfaceRef = React.useRef<HTMLDivElement>(null)

	const assignmentsQ = useListMeetingDocumentSignerAssignmentsQuery(meetingId, documentId)
	const participantsQ = useMeetingSignerParticipantsQuery(meetingId)
	const signersQ = useListMeetingDocumentSignersQuery(meetingId, documentId)

	const assignments = assignmentsQ.data as ListMeetingDocumentSignerAssignmentsResult | undefined
	const participants = (participantsQ.data as MeetingSignerParticipant[] | undefined) ?? []
	const signersResult = signersQ.data as ListMeetingDocumentSignersResult | undefined
	const projectId = signersResult?.projectId ?? null

	const participantEmailByUserId = React.useMemo(() => {
		const map = new Map<string, string>()
		for (const p of participants) {
			map.set(p.userId, p.email)
		}
		return map
	}, [participants])

	const participantNameByUserId = React.useMemo(() => {
		const map = new Map<string, string>()
		for (const p of participants) {
			map.set(p.userId, p.displayName)
		}
		return map
	}, [participants])

	const signerInfoByEmail = React.useMemo(
		() => buildSignerInfoByEmail(assignments, participants),
		[assignments, participants]
	)

	const sortedSigners = React.useMemo(() => {
		if (!assignments?.signers) return []
		return [...assignments.signers].sort((a, b) => a.signingOrder - b.signingOrder)
	}, [assignments])

	const pdfUrl = `${env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")}/v1/files/${documentId}`

	const handleSurfaceClick = React.useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (!selectedSignerEmail) return

			const rect = e.currentTarget.getBoundingClientRect()
			const rawX = e.clientX - rect.left - BOX_W / 2
			const rawY = e.clientY - rect.top - BOX_H / 2

			const surfaceW = e.currentTarget.scrollWidth
			const surfaceH = e.currentTarget.scrollHeight

			const x = Math.max(0, Math.min(rawX, surfaceW - BOX_W))
			const y = Math.max(0, Math.min(rawY, surfaceH - BOX_H))

			setPlottedFields(prev => [
				...prev,
				{
					signerEmail: selectedSignerEmail,
					pageIndex: 0,
					x,
					y,
					width: BOX_W,
					height: BOX_H,
				},
			])
		},
		[selectedSignerEmail]
	)

	const handleRemoveField = React.useCallback((index: number) => {
		setPlottedFields(prev => prev.filter((_, i) => i !== index))
	}, [])

	const handleConfirm = React.useCallback(async () => {
		setIsConfirming(true)
		try {
			if (!projectId) {
				throw new Error("Project ID not found. Ensure signers are assigned.")
			}
			const fields = plottedFields.map(f => ({
				signerEmail: f.signerEmail,
				pageIndex: f.pageIndex,
				x: Math.max(0, Math.round(f.x)),
				y: Math.max(0, Math.round(f.y)),
				width: Math.round(f.width),
				height: Math.round(f.height),
			}))
			await (orpcClient as any).quicksign.saveSignatureFields({
				id: projectId,
				fields,
			})
			await (orpcClient as any).session.markMeetingDocumentPlotted({
				meetingId,
				documentId,
			})
			toast.success("Signature fields plotted. Signing can now begin.")
			router.push(`/appointments/${meetingId}/meeting`)
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not confirm plotting."))
		} finally {
			setIsConfirming(false)
		}
	}, [meetingId, documentId, plottedFields, projectId, router])

	const loading = assignmentsQ.isLoading || participantsQ.isLoading || signersQ.isLoading

	return (
		<div className="mx-auto flex min-h-dvh flex-col gap-4 p-4">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-sm font-semibold">Plot Signature Fields</h1>
					<p className="text-muted-foreground text-xs">
						Click a signer name, then click on the PDF to place their signature field.
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="text-xs"
					disabled={isConfirming}
					onClick={() => router.back()}
				>
					Back
				</Button>
			</div>

			{loading ? (
				<div className="flex flex-1 items-center justify-center">
					<p className="text-muted-foreground text-xs">Loading signer information…</p>
				</div>
			) : (
				<div className="flex flex-1 gap-4 overflow-hidden">
					<div className="w-[70%] shrink-0">
						<div className="h-[80vh] overflow-y-auto relative rounded-lg border bg-muted/20">
							<div
								ref={surfaceRef}
								className={cn(
									"relative w-full",
									selectedSignerEmail ? "cursor-crosshair" : "cursor-default"
								)}
								onClick={handleSurfaceClick}
							>
								<div className="relative w-full" style={{ minHeight: "2000px" }}>
									<iframe
										src={pdfUrl}
										className="pointer-events-none absolute inset-0 h-full w-full rounded-lg"
										title="Document preview"
									/>
								</div>
								{plottedFields.map((field, i) => {
									const info = signerInfoByEmail.get(field.signerEmail)
									const isAttorney = info?.color === "attorney"
									return (
										<div
											key={i}
											className={cn(
												"absolute flex items-center justify-center rounded border-2",
												isAttorney
													? "border-blue-500 bg-blue-500/15"
													: "border-emerald-500 bg-emerald-500/15"
											)}
											style={{
												left: field.x,
												top: field.y,
												width: field.width,
												height: field.height,
											}}
										>
											<button
												type="button"
												className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow hover:bg-red-600"
												onClick={e => {
													e.stopPropagation()
													handleRemoveField(i)
												}}
												title="Remove field"
											>
												&times;
											</button>
											<span
												className={cn(
													"px-1 text-[10px] font-semibold leading-tight",
													isAttorney
														? "text-blue-700 dark:text-blue-300"
														: "text-emerald-700 dark:text-emerald-300"
												)}
											>
												{info
													? `${info.displayName} — ${info.roleSuffix}`
													: field.signerEmail}
											</span>
										</div>
									)
								})}
							</div>
						</div>
					</div>

					<div className="flex min-w-0 flex-1 flex-col gap-4">
						<Card className="shadow-sm">
							<CardHeader className="px-4 pt-4 pb-2">
								<CardTitle className="text-sm font-semibold">Signers</CardTitle>
								<CardDescription className="text-xs">
									Click a name, then click the PDF to place their field
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-2 px-4 pb-4">
								{sortedSigners.length === 0 ? (
									<p className="text-muted-foreground text-xs">
										No signers assigned yet. Add signers before plotting.
									</p>
								) : (
									sortedSigners.map((s, i) => {
										const email = participantEmailByUserId.get(s.userId) ?? ""
										const isSelected = selectedSignerEmail === email
										return (
											<button
												type="button"
												key={s.userId}
												className={cn(
													"flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-all",
													isSelected
														? "border-primary bg-primary/10 shadow-sm"
														: "border-border hover:border-foreground/30 hover:bg-muted/50"
												)}
												onClick={() => setSelectedSignerEmail(isSelected ? null : email)}
											>
												<span
													className={cn(
														"flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
														isSelected
															? "bg-primary text-primary-foreground"
															: "text-muted-foreground bg-muted"
													)}
												>
													{i + 1}
												</span>
												<div className="min-w-0 flex-1">
													<p className="truncate text-sm font-medium leading-snug">
														{participantNameByUserId.get(s.userId) ?? "Signer"}
													</p>
													<p className="text-muted-foreground text-xs">{roleLabel(s.role)}</p>
												</div>
											</button>
										)
									})
								)}
							</CardContent>
						</Card>

						<Card className="shadow-sm">
							<CardHeader className="px-4 pt-4 pb-2">
								<CardTitle className="text-sm font-semibold">
									Placed Fields ({plottedFields.length})
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-1.5 px-4 pb-4">
								{plottedFields.length === 0 ? (
									<p className="text-muted-foreground text-xs">
										No fields placed yet. Select a signer and click the PDF.
									</p>
								) : (
									plottedFields.map((field, i) => {
										const info = signerInfoByEmail.get(field.signerEmail)
										const label = info
											? `${info.displayName} — ${info.roleSuffix}`
											: field.signerEmail
										return (
											<div
												key={i}
												className="border-border flex items-center justify-between gap-2 rounded border px-2.5 py-1.5"
											>
												<span className="min-w-0 truncate text-xs">
													<span className="font-medium">{label}</span>
													<span className="text-muted-foreground">
														{" "}
														· ({Math.round(field.x)}, {Math.round(field.y)})
													</span>
												</span>
												<button
													type="button"
													className="text-destructive hover:text-destructive/80 shrink-0 text-xs font-medium"
													onClick={() => handleRemoveField(i)}
												>
													Remove
												</button>
											</div>
										)
									})
								)}
							</CardContent>
						</Card>

						<div className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 rounded-md border px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
							👉 Note: Signatures will be stamped into the placed fields upon signing. Drag the
							fields by placing them via PDF clicks.
						</div>

						<div className="mt-auto pt-2">
							<Button
								type="button"
								size="lg"
								className="w-full text-sm font-semibold"
								disabled={isConfirming || sortedSigners.length === 0}
								onClick={() => void handleConfirm()}
							>
								{isConfirming ? (
									<>
										<Spinner className="mr-2" />
										Confirming…
									</>
								) : (
									"Confirm & Mark Plotted"
								)}
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
