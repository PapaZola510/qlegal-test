"use client"

import * as React from "react"
import { Edit02Icon, Loading03Icon, UserMultiple02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type {
	ListMeetingDocumentSignerAssignmentsResult,
	ListMeetingDocumentSignersResult,
} from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { cn } from "@/core/lib/utils"

import {
	useListMeetingDocumentSignerAssignmentsQuery,
	useListMeetingDocumentSignersQuery,
	useSetMeetingDocumentSignersMutation,
} from "../../../api/meeting.hooks"
import { AssignedSignerList } from "./assigned-signer-list"
import type { SignerParticipant, SignerRole } from "./meeting-signer-types"
import { SignerManagementModal } from "./signer-management-modal"

function assignmentRolesFromApi(
	assignments: { userId: string; role: "notary" | "principal" | "witness" }[]
): Record<string, SignerRole> {
	const out: Record<string, SignerRole> = {}
	for (const a of assignments) {
		if (a.role === "witness") out[a.userId] = "witness"
		else if (a.role === "principal") out[a.userId] = "principal"
	}
	return out
}

export const DocumentActions = React.memo(function DocumentActions({
	meetingId,
	documentId,
	participants,
	participantsLoaded,
	isEnp,
	enpUserId,
	currentUserId,
	currentUserEmail,
	signingComplete = false,
	onPlotSignature,
	onSignClick,
	isLocallySigned,
	isSigningThisDocument,
	isDocumentPlotted,
}: {
	meetingId: string
	documentId: string
	participants: SignerParticipant[]
	participantsLoaded: boolean
	isEnp: boolean
	enpUserId: string | undefined
	currentUserId: string | undefined
	currentUserEmail: string | undefined
	signingComplete?: boolean
	onPlotSignature: (documentId: string) => void
	onSignClick: (email: string, documentId: string) => void
	isLocallySigned: (documentId: string) => boolean
	isSigningThisDocument: boolean
	isDocumentPlotted: boolean
}) {
	const [isSignerModalOpen, setIsSignerModalOpen] = React.useState(false)

	const assignmentsQ = useListMeetingDocumentSignerAssignmentsQuery(meetingId, documentId)
	const signersQ = useListMeetingDocumentSignersQuery(meetingId, documentId, {
		pollWhileSigning: true,
	})
	const setSigners = useSetMeetingDocumentSignersMutation(meetingId, documentId)

	const assignments = assignmentsQ.data as ListMeetingDocumentSignerAssignmentsResult | undefined
	const signersResult = signersQ.data as ListMeetingDocumentSignersResult | undefined
	const signersStatusLoading = signersQ.isPending && signersResult === undefined

	const signerUserIds = React.useMemo(() => {
		const rows = assignments?.signers ?? []
		return [...rows].sort((a, b) => a.signingOrder - b.signingOrder).map(s => s.userId)
	}, [assignments])

	const signerRoles = React.useMemo(
		() => assignmentRolesFromApi(assignments?.signers ?? []),
		[assignments]
	)

	const rosterSigners = React.useMemo(() => {
		const rows = signersResult?.signers ?? []
		if (!isLocallySigned(documentId) || !currentUserId) return rows
		return rows.map(s => (s.userId === currentUserId ? { ...s, status: "signed" as const } : s))
	}, [currentUserId, documentId, isLocallySigned, signersResult?.signers])
	const allSignersDone = signingComplete || (signersResult?.completed ?? false)

	const currentUserIndex = React.useMemo(() => {
		if (!currentUserId) return -1
		return signerUserIds.indexOf(currentUserId)
	}, [currentUserId, signerUserIds])

	const isCurrentUserSigner = currentUserIndex >= 0

	const currentUserSigned = React.useMemo(() => {
		if (isLocallySigned(documentId)) return true
		if (!currentUserId) return false
		const row = rosterSigners.find(s => s.userId === currentUserId)
		return row?.status === "signed"
	}, [currentUserId, documentId, isLocallySigned, rosterSigners])

	const internalPreviousSignersHaveSigned = React.useMemo(() => {
		if (currentUserIndex <= 0) return true
		const priorIds = signerUserIds.slice(0, currentUserIndex)
		return priorIds.every(id => {
			const row = rosterSigners.find(s => s.userId === id)
			return row?.status === "signed"
		})
	}, [currentUserIndex, rosterSigners, signerUserIds])

	const isUsersTurnToSign =
		isCurrentUserSigner &&
		!currentUserSigned &&
		internalPreviousSignersHaveSigned &&
		!allSignersDone

	const isWaitingForEnpToPlot = !isEnp && isCurrentUserSigner && !isDocumentPlotted

	const enpMustPlotFirst = isEnp && isCurrentUserSigner && !isDocumentPlotted

	const userNotInSignerList = Boolean(currentUserId) && !isCurrentUserSigner
	const hasNoSignersSelected = signerUserIds.length === 0

	const showSignDocument =
		isDocumentPlotted &&
		isCurrentUserSigner &&
		!currentUserSigned &&
		!allSignersDone

	const handleSignersChange = React.useCallback(
		async (userIds: string[], roles: Record<string, SignerRole>) => {
			const signers = userIds.map(userId => {
				if (userId === enpUserId) {
					return { userId, role: "notary" as const }
				}
				return {
					userId,
					role: (roles[userId] === "witness" ? "witness" : "principal") as "principal" | "witness",
				}
			})
			try {
				await setSigners.mutateAsync({ signers })
			} catch (e) {
				throw new Error(getOrpcMutationErrorMessage(e, "Could not save signers."))
			}
		},
		[enpUserId, setSigners]
	)

	const showAddSigners =
		isEnp &&
		participantsLoaded &&
		signerUserIds.length === 0 &&
		Boolean(enpUserId)

	const showAssignedList = signerUserIds.length > 0 && rosterSigners.length > 0

	const showPlotSignature =
		!signersStatusLoading &&
		isEnp &&
		signerUserIds.length > 0 &&
		!isDocumentPlotted

	const signLoading = isSigningThisDocument

	const statusMessage = React.useMemo(() => {
		if (allSignersDone || signersStatusLoading) return null
		if (userNotInSignerList && signerUserIds.length > 0) {
			return "Add yourself as a signer to sign this document."
		}
		if (isUsersTurnToSign) return "Your turn to sign."
		if (isWaitingForEnpToPlot) return "Waiting for ENP to plot signature fields."
		if (enpMustPlotFirst) return "Plot signature fields before signing."
		if (currentUserSigned) return "You signed — waiting on others."
		if (currentUserIndex > 0 && !internalPreviousSignersHaveSigned) {
			return "Wait for earlier signers to finish."
		}
		if (isDocumentPlotted && !showPlotSignature) {
			return "Waiting for signers in order."
		}
		return null
	}, [
		allSignersDone,
		currentUserIndex,
		currentUserSigned,
		enpMustPlotFirst,
		internalPreviousSignersHaveSigned,
		isDocumentPlotted,
		isWaitingForEnpToPlot,
		isUsersTurnToSign,
		showPlotSignature,
		signerUserIds.length,
		signersStatusLoading,
		userNotInSignerList,
	])

	const statusTone = React.useMemo(() => {
		if (isUsersTurnToSign) return "text-blue-600 dark:text-blue-500"
		if (currentUserSigned) return "text-green-600 dark:text-green-500"
		return "text-amber-600 dark:text-amber-500"
	}, [currentUserSigned, isUsersTurnToSign])

	if (hasNoSignersSelected && !showAddSigners) return null

	return (
		<div className="space-y-2.5">
			{signersStatusLoading ? (
				<p className="text-muted-foreground text-xs">Loading signing status…</p>
			) : null}

			{showAddSigners ? (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-9 w-full text-xs"
					onClick={() => setIsSignerModalOpen(true)}
				>
					<HugeiconsIcon icon={UserMultiple02Icon} className="mr-1.5 size-3.5" strokeWidth={2} />
					Add Signers
				</Button>
			) : null}

			{showAssignedList ? (
				<AssignedSignerList signers={rosterSigners} compact={allSignersDone} />
			) : null}

			{statusMessage ? (
				<p className={cn("text-xs leading-relaxed font-medium", statusTone)}>{statusMessage}</p>
			) : null}

			{showPlotSignature ? (
				<Button
					type="button"
					variant="default"
					size="sm"
					className="h-9 w-full text-xs"
					onClick={() => onPlotSignature(documentId)}
				>
					<HugeiconsIcon icon={Edit02Icon} className="mr-1.5 size-3.5" strokeWidth={2} />
					Plot Signature
				</Button>
			) : null}

			{showSignDocument ? (
				<Button
					type="button"
					variant="default"
					size="sm"
					className="h-9 w-full text-xs"
					disabled={!isUsersTurnToSign || signLoading}
					onClick={() => {
						if (!currentUserEmail) return
						onSignClick(currentUserEmail, documentId)
					}}
				>
					{signLoading ? (
						<HugeiconsIcon
							icon={Loading03Icon}
							className={cn("mr-1.5 size-3.5 animate-spin")}
							strokeWidth={2}
						/>
					) : (
						<HugeiconsIcon icon={Edit02Icon} className="mr-1.5 size-3.5" strokeWidth={2} />
					)}
					{signLoading ? "Signing…" : "Sign Document"}
				</Button>
			) : null}

			{showAddSigners ? (
				<SignerManagementModal
					participants={participants}
					signerUserIds={signerUserIds}
					signerRoles={signerRoles}
					isOpen={isSignerModalOpen}
					onOpenChange={setIsSignerModalOpen}
					isEnp={isEnp}
					onSignersChange={handleSignersChange}
				/>
			) : null}
		</div>
	)
})
