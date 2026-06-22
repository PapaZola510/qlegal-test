"use client"

import * as React from "react"
import type { Route } from "next"
import { useRouter, useSearchParams } from "next/navigation"

import { AppointmentLobbyContent } from "@/features/appointments/components/appointment-lobby-content"
import {
	buildGuestMeetingPath,
	readGuestInviteTokenFromSearchParams,
} from "@/features/appointments/lib/guest-session-url"

export function AppointmentLobbyRouteEntry({
	appointmentId,
	adminShell = false,
}: {
	appointmentId: string
	adminShell?: boolean
}) {
	const router = useRouter()
	const searchParams = useSearchParams()
	const guestInviteToken = readGuestInviteTokenFromSearchParams(searchParams)

	React.useEffect(() => {
		if (!guestInviteToken) return
		router.replace(buildGuestMeetingPath(appointmentId, guestInviteToken) as Route)
	}, [appointmentId, guestInviteToken, router])

	if (guestInviteToken) {
		return <p className="text-muted-foreground text-sm">Opening the meeting…</p>
	}

	return <AppointmentLobbyContent appointmentId={appointmentId} adminShell={adminShell} />
}
