"use client"

import * as React from "react"
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

import { PdfViewer } from "./pdf-viewer"

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

interface PageDim {
	originalWidth: number
	originalHeight: number
	renderedWidth: number
	renderedHeight: number
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
	const resolved = React.use(params)
	const meetingId = resolved.id
	const documentId = resolved.documentId
	const [isConfirming, setIsConfirming] = React.useState(false)
	const [selectedSignerEmail, setSelectedSignerEmail] = React.useState<string | null>(null)
	const [plottedFields, setPlottedFields] = React.useState<PlacedField[]>([])
	const [containerWidth, setContainerWidth] = React.useState(0)
	const pageDimsRef = React.useRef<Record<number, PageDim>>({})

	const containerRef = React.useRef<HTMLDivElement>(null)

	const assignmentsQ = useListMeetingDocumentSignerAssignmentsQuery(meetingId, documentId)
	const participantsQ = useMeetingSignerParticipantsQuery(meetingId)
	const signersQ = useListMeetingDocumentSignersQuery(meetingId, documentId)

	const loading = assignmentsQ.isLoading || participantsQ.isLoading || signersQ.isLoading

	React.useEffect(() => {
		if (loading) return
		const el = containerRef.current
		if (!el) return
		const observer = new ResizeObserver(entries => {
			for (const entry of entries) {
				setContainerWidth(entry.contentRect.width)
			}
		})
		observer.observe(el)
		return () => observer.disconnect()
	}, [loading])

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

	const pdfUrl = React.useMemo(
		() => `${env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")}/v1/files/${documentId}`,
		[documentId]
	)

	const handleDocumentLoad = React.useCallback((_np: number) => {
		// page count tracked internally by PdfViewer
	}, [])

	const handlePageLoad = React.useCallback((pageNumber: number, dim: PageDim) => {
		pageDimsRef.current[pageNumber] = dim
	}, [])

	const handlePageClick = React.useCallback(
		(pageNumber: number, e: React.MouseEvent<HTMLDivElement>) => {
			if (!selectedSignerEmail) return

			const dim = pageDimsRef.current[pageNumber]
			if (!dim) return

			const rect = e.currentTarget.getBoundingClientRect()
			const cssClickX = e.clientX - rect.left
			const cssClickY = e.clientY - rect.top

			const scaleX = dim.originalWidth / dim.renderedWidth
			const scaleY = dim.originalHeight / dim.renderedHeight

			// pdf-lib drawImage positions by bottom-left corner.
			// Center the field box on the click point.
			const pdfX = (cssClickX - BOX_W / 2) * scaleX
			const pdfY = dim.originalHeight - (cssClickY + BOX_H / 2) * scaleY
			const pdfW = BOX_W * scaleX
			const pdfH = BOX_H * scaleY

			setPlottedFields(prev => [
				...prev,
				{
					signerEmail: selectedSignerEmail,
					pageIndex: pageNumber - 1,
					x: Math.max(0, Math.round(pdfX)),
					y: Math.max(0, Math.round(pdfY)),
					width: Math.round(pdfW),
					height: Math.round(pdfH),
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
			await (orpcClient as any).session.markMeetingDocumentPlotted({
				meetingId,
				documentId,
				signatureFields: fields,
			})
			toast.success("Signature fields plotted. Signing can now begin.")
			window.close()
		} catch (e) {
			console.error("Plot confirm error:", e)
			toast.error(getOrpcMutationErrorMessage(e, "Could not confirm plotting."))
		} finally {
			setIsConfirming(false)
		}
	}, [meetingId, documentId, plottedFields, projectId])

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
					onClick={() => window.close()}
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
					<div ref={containerRef} className="w-[70%] shrink-0">
						<div className="h-[80vh] overflow-y-auto relative rounded-lg border bg-muted/20">
							{containerWidth > 0 ? (
								<PdfViewer
									pdfUrl={pdfUrl}
									containerWidth={containerWidth}
									selectedSignerEmail={selectedSignerEmail}
									plottedFields={plottedFields}
									signerInfoByEmail={signerInfoByEmail}
									onDocumentLoad={handleDocumentLoad}
									onPageClick={handlePageClick}
									onPageLoad={handlePageLoad}
									onRemoveField={handleRemoveField}
								/>
							) : (
								<div className="flex items-center justify-center h-full">
									<Spinner />
								</div>
							)}
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
														· Pg {field.pageIndex + 1} ({Math.round(field.x)},{" "}
														{Math.round(field.y)})
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
							Note: Signatures will be stamped into the placed fields upon signing. Click a signer
							name, then click on the PDF page to place their field.
						</div>

						<div className="mt-auto pt-2">
							<Button
								type="button"
								size="lg"
								className="w-full text-sm font-semibold"
								disabled={isConfirming || sortedSigners.length === 0 || plottedFields.length === 0}
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
