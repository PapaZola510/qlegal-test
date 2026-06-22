import type { Metadata, Route } from "next"
import Link from "next/link"

import { PageHeader } from "@/core/components/page-header"
import { buttonVariants } from "@/core/components/ui/button"
import { loadDashboardProfile } from "@/features/dashboard/server/load-dashboard-profile"
import { EnpCommissionApplicationContent } from "@/features/enp-commission-application/components/enp-commission-application-content"

export const metadata: Metadata = {
	title: "Electronic Notarial Commission Application",
	description:
		"Submit your application for an electronic notarial commission to the Electronic Notary Administrator (ENA).",
}

export default async function EnpCommissionApplicationPage() {
	const initialProfile = await loadDashboardProfile()

	return (
		<div className="w-full space-y-6">
			<PageHeader
				title="Electronic Notarial Commission"
				description="File your commission application and supporting documents for review by the Electronic Notary Administrator (ENA)."
				actions={
					<Link
						href={"/dashboard" as Route}
						className={buttonVariants({ variant: "outline", size: "sm" })}
					>
						Back to dashboard
					</Link>
				}
			/>
			<EnpCommissionApplicationContent initialProfile={initialProfile} />
		</div>
	)
}
