"use client"

import * as React from "react"
import type { Route } from "next"
import { useRouter, useSearchParams } from "next/navigation"

import {
	notarialAttestationTextFor,
	type Appointment,
	type IenAttestationRole,
	type ListIenAttestationsResponse,
	type ResolveIenSignUrlResponse,
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
import { authClient } from "@/services/better-auth/auth-client"
import { useAppointmentQuery } from "@/features/appointments/api/appointments.hooks"
import {
	useListAppointmentIenAttestationsQuery,
	useRecordAppointmentIenAttestationMutation,
	useResolveIenSignUrlMutation,
} from "@/features/appointments/api/ien-attestation.hooks"
import { IenAttestationPrompt } from "@/features/appointments/components/ien-attestation-prompt"
import { IEN_ATTESTATION_ROLE_LABELS } from "@/features/appointments/lib/ien-attestation-texts"
import { savePostLoginRedirect } from "@/features/auth/lib/post-login-redirect"

function parseRole(value: string | null): IenAttestationRole {
	if (value === "enp" || value === "witness" || value === "principal") return value
	return "principal"
}

export function IenSignRouteEntry({ appointmentId }: { appointmentId: string }) {
	const router = useRouter()
	const searchParams = useSearchParams()
	const documentFileId = searchParams.get("documentFileId")?.trim() ?? ""
	const role = parseRole(searchParams.get("role"))

	const { data: session, isPending: sessionPending } = authClient.useSession()
	const userId = session?.user?.id

	const attestationsQ = useListAppointmentIenAttestationsQuery(appointmentId, documentFileId, {
		enabled: Boolean(userId && documentFileId),
	})
	const aptQ = useAppointmentQuery(appointmentId)
	const apt = aptQ.data as Appointment | undefined
	const attestationText = React.useMemo(() => {
		if (!apt) return ""
		return (
			notarialAttestationTextFor({
				notarizationType: apt.notarizationType,
				sessionMode: apt.sessionMode,
				role,
			}) ?? ""
		)
	}, [apt, role])
	const recordAttestation = useRecordAppointmentIenAttestationMutation()
	const resolveSignUrl = useResolveIenSignUrlMutation()

	const [acknowledged, setAcknowledged] = React.useState(false)
	const [error, setError] = React.useState<string | null>(null)
	const [redirecting, setRedirecting] = React.useState(false)
	const redirectAttemptedRef = React.useRef(false)

	const returnPath = React.useMemo(() => {
		const params = new URLSearchParams()
		if (documentFileId) params.set("documentFileId", documentFileId)
		params.set("role", role)
		const qs = params.toString()
		return `/appointments/${appointmentId}/ien-sign${qs ? `?${qs}` : ""}`
	}, [appointmentId, documentFileId, role])

	React.useEffect(() => {
		if (sessionPending || session?.user?.id) return
		savePostLoginRedirect(returnPath)
		router.replace(`/login?redirect=${encodeURIComponent(returnPath)}` as Route)
	}, [returnPath, router, session?.user?.id, sessionPending])

	const attestations =
		(attestationsQ.data as ListIenAttestationsResponse | undefined)?.attestations ?? []

	const userAttested = React.useMemo(() => {
		if (!userId) return false
		return attestations.some(a => a.role === role && a.userId === userId)
	}, [attestations, role, userId])

	const redirectToSign = React.useCallback(async () => {
		if (!documentFileId || redirectAttemptedRef.current) return
		redirectAttemptedRef.current = true
		setRedirecting(true)
		setError(null)
		try {
			const result = (await resolveSignUrl.mutateAsync({
				id: appointmentId,
				documentFileId,
				role,
			})) as ResolveIenSignUrlResponse
			if (result.signDocumentUrl) {
				window.location.assign(result.signDocumentUrl)
				return
			}
			if (result.attestationRequired) {
				redirectAttemptedRef.current = false
				setRedirecting(false)
				return
			}
			setError("Signing link is not available yet. Please try again in a moment.")
			redirectAttemptedRef.current = false
			setRedirecting(false)
		} catch (e) {
			setError(getOrpcMutationErrorMessage(e))
			redirectAttemptedRef.current = false
			setRedirecting(false)
		}
	}, [appointmentId, documentFileId, resolveSignUrl, role])

	React.useEffect(() => {
		if (!userId || !documentFileId || !userAttested || attestationsQ.isPending) return
		void redirectToSign()
	}, [attestationsQ.isPending, documentFileId, redirectToSign, userAttested, userId])

	async function handleContinue() {
		if (!documentFileId) {
			setError("This signing link is missing the document reference.")
			return
		}
		setError(null)
		try {
			await recordAttestation.mutateAsync({
				id: appointmentId,
				documentFileId,
				role,
				acknowledged: true,
			})
			redirectAttemptedRef.current = false
			await redirectToSign()
		} catch (e) {
			setError(getOrpcMutationErrorMessage(e))
		}
	}

	if (!documentFileId) {
		return (
			<Card className="mx-auto max-w-lg">
				<CardHeader>
					<CardTitle className="text-base">Invalid signing link</CardTitle>
					<CardDescription>
						This link is incomplete. Open the signing link from your invite email again.
					</CardDescription>
				</CardHeader>
			</Card>
		)
	}

	if (sessionPending || !session?.user?.id) {
		return (
			<div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
				<Spinner />
				Redirecting to sign in…
			</div>
		)
	}

	if (attestationsQ.isPending || (userAttested && redirecting)) {
		return (
			<div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
				<Spinner />
				{userAttested ? "Opening document signing…" : "Loading…"}
			</div>
		)
	}

	const roleLabel = IEN_ATTESTATION_ROLE_LABELS[role]
	const busy = recordAttestation.isPending || resolveSignUrl.isPending || redirecting

	return (
		<Card className="mx-auto max-w-lg">
			<CardHeader>
				<CardTitle className="text-base">Acknowledge before signing</CardTitle>
				<CardDescription>
					As the {roleLabel.toLowerCase()}, confirm the notarial statement below before opening the
					document for electronic signing.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<IenAttestationPrompt
					role={role}
					attestationText={attestationText}
					acknowledged={acknowledged}
					onAcknowledgedChange={setAcknowledged}
					disabled={busy}
				/>

				{error ? (
					<p className="text-destructive text-sm" role="alert">
						{error}
					</p>
				) : null}

				<Button
					className="w-full"
					disabled={!acknowledged || busy}
					onClick={() => void handleContinue()}
				>
					{busy && <Spinner className="mr-2" />}
					Continue to sign document
				</Button>
			</CardContent>
		</Card>
	)
}
