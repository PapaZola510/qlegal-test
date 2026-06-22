"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import type { CtcPaymentMethod, SignedDocument, UserProfile } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Card, CardContent } from "@/core/components/ui/card"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/core/components/ui/collapsible"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { orpc } from "@/services/orpc/client"
import { subscribeQlegalEvent } from "@/services/ws/ws-client"
import { NOTARIZATION_TYPE_LABELS } from "@/features/appointments/lib/labels"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import { VerifyDocumentLink } from "@/features/document-verification/components/verify-document-link"
import { isProfileKycVerified } from "@/features/kyc/lib/profile-kyc-gate"

import { useRequestCertifiedTrueCopyMutation, useSignedDocumentsQuery } from "../api/signed.hooks"
import { defaultRequesterAddress, RequestCtcModal } from "./request-ctc-modal"
import { CtcStatusBadge, SignedDocumentActions } from "./signed-document-actions"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
const signedApi = orpc as any

function formatCompletedAt(iso: string): string {
	try {
		return new Date(iso).toLocaleString("en-PH", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "numeric",
			minute: "2-digit",
		})
	} catch {
		return iso
	}
}

type GroupedSigned = {
	appointmentId: string
	enpName: string
	notarizationType: SignedDocument["notarizationType"]
	appointmentKind: SignedDocument["appointmentKind"]
	completedAt: string
	documents: SignedDocument[]
}

function groupByAppointment(docs: SignedDocument[]): GroupedSigned[] {
	const map = new Map<string, GroupedSigned>()
	for (const doc of docs) {
		const existing = map.get(doc.appointmentId)
		if (existing) {
			existing.documents.push(doc)
			if (new Date(doc.completedAt).getTime() > new Date(existing.completedAt).getTime()) {
				existing.completedAt = doc.completedAt
			}
			continue
		}
		map.set(doc.appointmentId, {
			appointmentId: doc.appointmentId,
			enpName: doc.enpName,
			notarizationType: doc.notarizationType,
			appointmentKind: doc.appointmentKind,
			completedAt: doc.completedAt,
			documents: [doc],
		})
	}
	return [...map.values()].sort(
		(a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
	)
}

export function SignedContent() {
	const queryClient = useQueryClient()
	const profileQ = useAuthProfileMeQuery()
	const profile = profileQ.data as UserProfile | undefined
	const isClient = profile?.role === "client"
	const kycVerified = isProfileKycVerified(profile?.identityStatus)

	const listQ = useSignedDocumentsQuery(Boolean(isClient && !profileQ.isPending))
	const requestCtc = useRequestCertifiedTrueCopyMutation()
	const [ctcTarget, setCtcTarget] = React.useState<SignedDocument | null>(null)

	React.useEffect(() => {
		if (!isClient) return
		const offUpdated = subscribeQlegalEvent("appointments:updated", payload => {
			if (payload.status === "ended") {
				void queryClient.invalidateQueries({
					queryKey: signedApi.signed.listDocuments.key(),
				})
			}
		})
		const offPayment = subscribeQlegalEvent("signed:ctc-payment-updated", () => {
			void queryClient.invalidateQueries({
				queryKey: signedApi.signed.listDocuments.key(),
			})
		})
		return () => {
			offUpdated()
			offPayment()
		}
	}, [isClient, queryClient])
	const grouped = React.useMemo(() => {
		const docs = Array.isArray(listQ.data) ? (listQ.data as SignedDocument[]) : []
		return groupByAppointment(docs)
	}, [listQ.data])

	async function submitCtcRequest(input: {
		requesterAddress: string
		lawfulPurpose: string
		paymentMethod: CtcPaymentMethod
	}) {
		if (!ctcTarget) return
		try {
			await requestCtc.mutateAsync({
				appointmentId: ctcTarget.appointmentId,
				documentFileId: ctcTarget.documentFileId,
				...input,
			})
			if (input.paymentMethod === "online") {
				toast.success(
					"Certified true copy request sent. Pay from this page after your notary approves."
				)
			} else {
				toast.success("Certified true copy request sent to your notary.")
			}
			setCtcTarget(null)
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not submit your request."))
		}
	}

	if (profileQ.isPending) {
		return (
			<Card>
				<CardContent className="text-muted-foreground py-10 text-sm">Loading…</CardContent>
			</Card>
		)
	}

	if (!isClient) {
		return (
			<Card>
				<CardContent className="text-muted-foreground py-10 text-sm">
					Signed documents are available on client accounts.
				</CardContent>
			</Card>
		)
	}

	if (listQ.isError) {
		return (
			<Card>
				<CardContent className="text-destructive py-10 text-sm">
					Unable to load signed documents. Please try again.
				</CardContent>
			</Card>
		)
	}

	if (listQ.isLoading) {
		return (
			<Card>
				<CardContent className="text-muted-foreground py-10 text-sm">
					Loading signed documents…
				</CardContent>
			</Card>
		)
	}

	if (grouped.length === 0) {
		return (
			<Card>
				<CardContent className="text-muted-foreground py-10 text-sm">
					Signed documents will appear here after your notarization session is complete.
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="space-y-3">
			<div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
				<p className="text-muted-foreground">
					Request a certified true copy for each document you need. View and download unlock after
					your notary approves. Online payments are collected on this page before access is granted.
				</p>
				<VerifyDocumentLink variant="secondary">Verify a document</VerifyDocumentLink>
			</div>

			{grouped.map(group => (
				<Collapsible key={group.appointmentId} defaultOpen>
					<Card>
						<CollapsibleTrigger className="hover:bg-muted/40 flex w-full items-start justify-between gap-3 rounded-t-xl px-4 py-4 text-left transition-colors">
							<div className="min-w-0 space-y-1">
								<p className="text-sm font-medium">
									{NOTARIZATION_TYPE_LABELS[group.notarizationType] ?? group.notarizationType}
								</p>
								<p className="text-muted-foreground text-xs">
									ENP: {group.enpName} · {formatCompletedAt(group.completedAt)}
								</p>
							</div>
							<div className="flex shrink-0 flex-col items-end gap-2">
								<Badge variant="secondary" className="text-[10px]">
									{group.documents.length} document
									{group.documents.length === 1 ? "" : "s"}
								</Badge>
								{group.appointmentKind === "quicksign" ? (
									<Badge variant="outline" className="text-[10px]">
										QuickSign
									</Badge>
								) : null}
							</div>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<CardContent className="border-t pt-0 pb-4">
								<ul className="divide-border divide-y">
									{group.documents.map(doc => (
										<li
											key={doc.id}
											className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
										>
											<div className="min-w-0 flex-1 space-y-1">
												{doc.ctcRequest ? <CtcStatusBadge ctc={doc.ctcRequest} /> : null}
												<p className="text-sm leading-snug font-medium break-words">
													{doc.documentTitle}
												</p>
												{doc.documentType ? (
													<p className="text-muted-foreground text-xs">{doc.documentType}</p>
												) : null}
											</div>
											<div className="shrink-0 sm:max-w-[min(100%,20rem)]">
												<SignedDocumentActions
													appointmentId={doc.appointmentId}
													documentFileId={doc.documentFileId}
													documentTitle={doc.documentTitle}
													ctcRequest={doc.ctcRequest}
													onRequestCertifiedTrueCopy={() => setCtcTarget(doc)}
												/>
											</div>
										</li>
									))}
								</ul>
							</CardContent>
						</CollapsibleContent>
					</Card>
				</Collapsible>
			))}

			<RequestCtcModal
				open={Boolean(ctcTarget)}
				onOpenChange={open => !open && setCtcTarget(null)}
				documentTitle={ctcTarget?.documentTitle ?? ""}
				enpName={ctcTarget?.enpName ?? "your notary"}
				defaultAddress={defaultRequesterAddress(profile)}
				kycVerified={kycVerified}
				isSubmitting={requestCtc.isPending}
				onSubmit={submitCtcRequest}
			/>
		</div>
	)
}
