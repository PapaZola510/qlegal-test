import type { Metadata } from "next"

import { AppointmentLobbyRouteEntry } from "@/features/appointments/components/appointment-lobby-route-entry"

export const metadata: Metadata = {
	title: "Session lobby",
}

/**
 * Public route so guest invite links work before sign-in.
 * `(site)/layout` redirects unauthenticated users to `/`, which drops the lobby URL
 * and breaks post-login return to `?guest=` invites.
 */
export default async function AppointmentLobbyPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params

	return (
		<div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
			<AppointmentLobbyRouteEntry appointmentId={id} />
		</div>
	)
}
