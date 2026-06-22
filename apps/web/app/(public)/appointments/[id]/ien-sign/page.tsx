import { Suspense } from "react"
import type { Metadata } from "next"

import { Spinner } from "@/core/components/ui/spinner"
import { IenSignRouteEntry } from "@/features/appointments/components/ien-sign-route-entry"

export const metadata: Metadata = {
	title: "Acknowledge and sign",
}

export default async function AppointmentIenSignPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params

	return (
		<div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
			<Suspense
				fallback={
					<div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
						<Spinner />
						Loading…
					</div>
				}
			>
				<IenSignRouteEntry appointmentId={id} />
			</Suspense>
		</div>
	)
}
