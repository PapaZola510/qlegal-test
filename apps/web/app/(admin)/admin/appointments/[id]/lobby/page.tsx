import type { Metadata } from "next"

import { AppointmentLobbyRouteEntry } from "@/features/appointments/components/appointment-lobby-route-entry"

export const metadata: Metadata = {
	title: "Session lobby",
}

export default async function AdminAppointmentLobbyPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params

	return (
		<div className="mx-auto w-full max-w-3xl">
			<AppointmentLobbyRouteEntry appointmentId={id} adminShell />
		</div>
	)
}
