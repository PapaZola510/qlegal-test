"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import { orpc } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
const api = orpc as any

export function useDocumentSigning(meetingId: string, _isEnp: boolean) {
	const queryClient = useQueryClient()

	const [signingDocumentId, setSigningDocumentId] = React.useState<string | null>(null)
	const [userConfirmedPlottedDocumentIds, setUserConfirmedPlottedDocumentIds] = React.useState(
		() => new Set<string>()
	)
	const [localSignedDocumentIds, setLocalSignedDocumentIds] = React.useState(
		() => new Set<string>()
	)

	const goToPlotter = React.useCallback(
		(documentId: string) => {
			window.open(
				`/appointments/${meetingId}/meeting/documents/${documentId}/plot`,
				"_blank"
			)
		},
		[meetingId]
	)

	const refetchDocumentSigners = React.useCallback(
		async (documentId: string) => {
			await queryClient.invalidateQueries({
				queryKey: api.session.listMeetingDocumentSigners.key({
					input: { meetingId, documentId },
				}),
			})
			await queryClient.invalidateQueries({
				queryKey: api.appointment.listAttachments.key({ input: { id: meetingId } }),
			})
		},
		[meetingId, queryClient]
	)

	const handleLocalSignSuccess = React.useCallback(
		async (documentId: string) => {
			setLocalSignedDocumentIds(prev => {
				const next = new Set(prev)
				next.add(documentId)
				return next
			})
			await refetchDocumentSigners(documentId)
		},
		[refetchDocumentSigners]
	)

	const isDocumentPlotted = React.useCallback(
		(documentId: string, serverPlotCompletedAt: string | null | undefined) => {
			return Boolean(serverPlotCompletedAt) || userConfirmedPlottedDocumentIds.has(documentId)
		},
		[userConfirmedPlottedDocumentIds]
	)

	const isLocallySigned = React.useCallback(
		(documentId: string) => localSignedDocumentIds.has(documentId),
		[localSignedDocumentIds]
	)

	return {
		goToPlotter,
		signingDocumentId,
		setSigningDocumentId,
		isDocumentPlotted,
		isLocallySigned,
		handleLocalSignSuccess,
	}
}
