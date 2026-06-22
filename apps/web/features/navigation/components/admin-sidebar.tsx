"use client"

import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logout01FreeIcons } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Logo } from "@/core/components/logo"
import { Button } from "@/core/components/ui/button"
import { cn } from "@/core/lib/utils"
import { useSignOutMutation } from "@/features/auth/api/session.hooks"
import { adminNavItems, type SiteRole } from "@/features/navigation/nav-config"

const SIDEBAR_WIDTH_CLASS = "w-56"

function sidebarNavItemsForRole(role: SiteRole | null): typeof adminNavItems {
	return adminNavItems
}

interface AdminSidebarProps {
	/** Hide sidebar below xl; used in compliance layout where mobile uses the header menu. */
	desktopOnly?: boolean
	role?: SiteRole | null
}

export function AdminSidebar({ desktopOnly = false, role = null }: AdminSidebarProps) {
	const pathname = usePathname()
	const signOut = useSignOutMutation()
	const visibility = desktopOnly ? "hidden xl:flex" : "flex"
	const navItems = sidebarNavItemsForRole(role)

	return (
		<>
			<aside
				className={cn(
					"bg-card fixed inset-y-0 left-0 z-40 flex h-dvh flex-col border-r",
					SIDEBAR_WIDTH_CLASS,
					visibility
				)}
			>
				<div className="flex h-12 items-center border-b px-4">
					<Logo href="/admin" size="sm" text="qLegal Admin" />
				</div>
				<nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
					{navItems.map(item => (
						<Link
							key={item.href}
							href={item.href as Route}
							className={cn(
								"rounded-md px-3 py-2 text-sm font-medium transition-colors",
								pathname === item.href
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground hover:bg-muted hover:text-foreground"
							)}
						>
							{item.label}
						</Link>
					))}
				</nav>
				<div className="border-t p-3">
					<Link
						href={"/admin/profile" as Route}
						className={cn(
							"text-muted-foreground hover:bg-muted hover:text-foreground mb-2 block rounded-md px-3 py-2 text-sm font-medium transition-colors",
							pathname === "/admin/profile" ? "bg-accent text-accent-foreground" : undefined
						)}
					>
						Profile & KYC
					</Link>
					<Button
						variant="outline"
						className="w-full justify-start gap-2"
						onClick={() => signOut.mutate()}
						disabled={signOut.isPending}
					>
						<HugeiconsIcon icon={Logout01FreeIcons} className="size-4" strokeWidth={2} />
						{signOut.isPending ? "Signing out…" : "Sign out"}
					</Button>
				</div>
			</aside>
			<div
				className={cn(SIDEBAR_WIDTH_CLASS, "shrink-0", desktopOnly ? "hidden xl:block" : "block")}
				aria-hidden
			/>
		</>
	)
}
