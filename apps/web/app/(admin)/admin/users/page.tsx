import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { AdminUsersContent } from "@/features/admin/components/admin-users-content"

export const metadata: Metadata = {
	title: "Users",
}

export default function AdminUsersPage() {
	return (
		<div className="space-y-6">
			<PageHeader title="Users" description="Manage platform users and roles." />
			<AdminUsersContent />
		</div>
	)
}
