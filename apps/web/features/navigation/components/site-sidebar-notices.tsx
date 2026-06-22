"use client"

import { EnpCommissionExpiryNotice } from "@/features/dashboard/components/enp-commission-expiry-notice"
import { GovernmentIdExpiryNotice } from "@/features/dashboard/components/government-id-expiry-notice"
import { cn } from "@/core/lib/utils"

export function SiteSidebarHeaderNotices({ className }: { className?: string }) {
	return (
		<div className={cn("min-w-0 space-y-2", className)}>
			<GovernmentIdExpiryNotice variant="sidebar" />
			<EnpCommissionExpiryNotice variant="sidebar" />
		</div>
	)
}
