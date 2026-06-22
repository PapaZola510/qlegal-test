"use client"

import { useEffect, useRef } from "react"
import type { Route } from "next"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { buttonVariants } from "@/core/components/ui/button"
import { Spinner } from "@/core/components/ui/spinner"
import { cn } from "@/core/lib/utils"
import { useSessionLivenessResult } from "@/features/appointments/hooks/use-session-liveness-result"
import {
	readGuestInviteTokenFromSearchParams,
	readGuestInviteTokenFromUrl,
} from "@/features/appointments/lib/guest-session-url"

export default function AppointmentLivenessCallbackPage() {
	const searchParams = useSearchParams()
	const router = useRouter()
	const transactionId = searchParams.get("transactionId")
	const redirectUrl = searchParams.get("redirect")
	const appointmentId = searchParams.get("appointmentId")
	const guestInviteToken =
		readGuestInviteTokenFromSearchParams(searchParams) ?? readGuestInviteTokenFromUrl(redirectUrl)
	const toastShownRef = useRef(false)

	const { data, isLoading, error } = useSessionLivenessResult({
		appointmentId,
		transactionId,
		guestInviteToken,
		enabled: Boolean(transactionId && appointmentId),
	})

	useEffect(() => {
		if (!data || toastShownRef.current) return
		toastShownRef.current = true

		if (data.decision.isApproved) {
			toast.success("Liveness verification complete")
			if (redirectUrl) {
				globalThis.location.href = redirectUrl
			} else if (appointmentId) {
				router.replace(`/appointments/${appointmentId}/lobby` as Route)
			}
		} else {
			toast.error(data.decision.message || "Liveness verification failed")
			if (redirectUrl) {
				globalThis.location.href = redirectUrl
			} else if (appointmentId) {
				router.replace(`/appointments/${appointmentId}/lobby` as Route)
			}
		}
	}, [data, redirectUrl, appointmentId, router])

	if (!transactionId) {
		return (
			<div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
				<p className="text-destructive text-sm">
					Invalid callback: missing transaction ID from HyperVerge.
				</p>
				<Link
					href={"/appointments" as Route}
					className={cn(buttonVariants({ variant: "outline" }))}
				>
					Back to appointments
				</Link>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
				<Spinner className="text-primary size-10" />
				<p className="text-muted-foreground text-sm">Verifying liveness…</p>
			</div>
		)
	}

	if (error) {
		return (
			<div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
				<p className="text-destructive text-sm">
					{error instanceof Error ? error.message : "Failed to load verification results"}
				</p>
				{appointmentId && (
					<Link
						href={`/appointments/${appointmentId}/lobby` as Route}
						className={cn(buttonVariants({ variant: "outline" }))}
					>
						Back to session lobby
					</Link>
				)}
			</div>
		)
	}

	return (
		<div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
			<Spinner className="text-primary size-10" />
			<p className="text-muted-foreground text-sm">Redirecting…</p>
		</div>
	)
}
