import type { Metadata } from "next"

import { AdminCommissionApplicationDetailContent } from "@/features/admin/components/admin-commission-application-detail-content"

export const metadata: Metadata = {
	title: "Commission Application",
}

export default async function AdminCommissionApplicationDetailPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params

	return <AdminCommissionApplicationDetailContent applicationId={id} />
}
