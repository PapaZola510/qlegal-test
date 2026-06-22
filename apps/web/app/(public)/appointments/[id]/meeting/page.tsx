import { Suspense } from "react"
import type { Metadata } from "next"

import { AppointmentMeetingRouteEntry } from "@/features/appointments/components/appointment-meeting-route-entry"

export const metadata: Metadata = {
	title: "Live session",
}

/**
 * Public route so guest invite links (`?guest=`) work before sign-in.
 * ENP/client also use this page when they have an active session.
 */
export default async function AppointmentMeetingPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params

	return (
		<div className="flex min-h-dvh flex-col">
			<Suspense fallback={<p className="text-muted-foreground px-4 py-8 text-sm">Loading…</p>}>
				<AppointmentMeetingRouteEntry appointmentId={id} />
			</Suspense>
		</div>
	)
}
