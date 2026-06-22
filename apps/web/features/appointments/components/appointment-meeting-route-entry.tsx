"use client"

import { useSearchParams } from "next/navigation"

import { readGuestInviteTokenFromSearchParams } from "@/features/appointments/lib/guest-session-url"

import { AppointmentMeetingContent } from "./appointment-meeting-content"

/**
 * Thin client boundary for `/appointments/[id]/meeting`.
 * We avoid `next/dynamic(..., { ssr: false })` here: Turbopack + Next 16 can throw
 * “module factory is not available” when that pattern is bundled from an RSC parent.
 * `AppointmentMeetingContent` is already `"use client"`; LiveKit runs only after hydration.
 */
export function AppointmentMeetingRouteEntry({ appointmentId }: { appointmentId: string }) {
	const searchParams = useSearchParams()
	const guestInviteToken = readGuestInviteTokenFromSearchParams(searchParams)

	return (
		<AppointmentMeetingContent appointmentId={appointmentId} guestInviteToken={guestInviteToken} />
	)
}
