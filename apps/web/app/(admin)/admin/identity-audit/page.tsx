import type { Metadata } from "next"

import { PageHeader } from "@/core/components/page-header"
import { AdminIdentityAuditContent } from "@/features/admin/components/admin-identity-audit-content"

export const metadata: Metadata = {
	title: "Identity Audit",
}

export default function AdminIdentityAuditPage() {
	return (
		<div className="space-y-6">
			<PageHeader
				title="Identity Audit"
				description="Review identity verification history and outcomes."
			/>
			<AdminIdentityAuditContent />
		</div>
	)
}
