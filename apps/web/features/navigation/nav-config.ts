import type { Route } from "next"

export type SiteRole = "client" | "enp" | "admin" | "super_admin" | "witness" | "attorney_enp"

export interface NavItem {
	label: string
	/** Shorter label for the desktop header bar. */
	shortLabel?: string
	href: Route<string>
	roles?: SiteRole[]
	/** Desktop: show under the More menu instead of the main bar. */
	overflow?: boolean
}

export const clientNavItems: NavItem[] = [
	{ label: "Dashboard", href: "/dashboard" as Route },
	{
		label: "Find a Notary",
		shortLabel: "Find Notary",
		href: "/find-notary" as Route,
	},
	{ label: "Upload Document", href: "/upload-document" as Route },
	{ label: "Appointments", href: "/appointments" as Route },
	{ label: "Recordings", href: "/recordings" as Route, overflow: true },
	{
		label: "Document Reviews",
		shortLabel: "Reviews",
		href: "/document-reviews" as Route,
		overflow: true,
	},
	{ label: "Signed", href: "/signed" as Route },
	{ label: "ENB Access", shortLabel: "ENB", href: "/enb-access" as Route, overflow: true },
	{ label: "Messages", href: "/messages" as Route },
]

export const enpNavItems: NavItem[] = [
	{ label: "Dashboard", href: "/dashboard" as Route },
	{ label: "Appointments", href: "/appointments" as Route },
	{ label: "Recordings", href: "/recordings" as Route, overflow: true },
	{
		label: "Document Reviews",
		shortLabel: "Reviews",
		href: "/document-reviews" as Route,
		overflow: true,
	},
	{ label: "Notarial Book", shortLabel: "Notarial Book", href: "/registry" as Route },
	{ label: "QuickSign", href: "/quicksign" as Route },
	{ label: "Messages", href: "/messages" as Route },
]

export const adminNavItems: NavItem[] = [
	{ label: "System", href: "/admin" as Route },
	{
		label: "Commission Applications",
		shortLabel: "Commission",
		href: "/admin/commission-applications" as Route,
	},
	{ label: "Users & Roles", shortLabel: "Users", href: "/admin/users" as Route },
	{
		label: "Configuration",
		shortLabel: "Config",
		href: "/admin/settings" as Route,
		overflow: true,
	},
	{ label: "Compliance", href: "/admin/sc-sync-monitor" as Route, overflow: true },
	{ label: "Compliance Audit", shortLabel: "Audit", href: "/compliance" as Route },
	{ label: "Reports", href: "/admin/payments" as Route, overflow: true },
]

export const witnessNavItems: NavItem[] = [
	{ label: "Dashboard", href: "/dashboard" as Route },
	{ label: "Sessions", href: "/appointments" as Route },
	{ label: "ENB Access", shortLabel: "ENB", href: "/enb-access" as Route },
	{ label: "Messages", href: "/messages" as Route },
]

export const siteNavItems: NavItem[] = clientNavItems

export function getNavItemsByRole(role: SiteRole | null): NavItem[] {
	const normalizedRole = role === "attorney_enp" ? "enp" : role
	switch (normalizedRole) {
		case "client":
			return clientNavItems
		case "enp":
			return enpNavItems
		case "admin":
		case "super_admin":
			return adminNavItems
		case "witness":
			return witnessNavItems
		default:
			return clientNavItems
	}
}

export function partitionNavItems(items: NavItem[]) {
	const primary = items.filter(item => !item.overflow)
	const overflow = items.filter(item => item.overflow)
	return { primary, overflow }
}

export function filterNavByRole(items: NavItem[], role: SiteRole | null): NavItem[] {
	return getNavItemsByRole(role)
}

export function isNavItemActive(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`)
}

export function navItemDisplayLabel(item: NavItem, compact = false): string {
	if (compact && item.shortLabel) return item.shortLabel
	return item.label
}
