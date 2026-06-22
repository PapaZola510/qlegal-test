import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { AppointmentsContent } from "@/features/appointments/components/appointments-content"

export const metadata: Metadata = {
	title: "Appointments",
}

export default function AppointmentsPage() {
	return (
		<div className="w-full space-y-4">
			<PageHeader title="Appointments" description="Manage your upcoming notarization sessions." />
			<AppointmentsContent />
		</div>
	)
}
