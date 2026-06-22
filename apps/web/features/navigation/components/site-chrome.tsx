"use client"

import { usePathname } from "next/navigation"

import { EnpCommissionExpiryNotice } from "@/features/dashboard/components/enp-commission-expiry-notice"
import { GovernmentIdExpiryNotice } from "@/features/dashboard/components/government-id-expiry-notice"
import { useNavigationLayout } from "@/features/navigation/context/navigation-layout-provider"
import { isMeetingSessionPath } from "@/features/navigation/lib/navigation-layout-preference"

/**
 * Client shell for authenticated site routes. Keeps query-dependent notices
 * inside a stable client boundary below QueryClientProvider.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
	const pathname = usePathname()
	const { layout } = useNavigationLayout()
	const hideNotices = isMeetingSessionPath(pathname)
	const showHeaderNotices = !hideNotices && layout === "header"

	return (
		<>
			{showHeaderNotices ? <GovernmentIdExpiryNotice variant="header" /> : null}
			{showHeaderNotices ? <EnpCommissionExpiryNotice variant="header" /> : null}
			{children}
		</>
	)
}
