"use client"

import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/core/components/ui/button"
import { cn } from "@/core/lib/utils"
import { useSignOutMutation } from "@/features/auth/api/session.hooks"

const complianceNavItems = [
	{ label: "Overview", href: "/compliance" },
	{ label: "Commission", href: "/compliance/commission-records" },
	{ label: "ENBs", href: "/compliance/enbs" },
	{ label: "Documents", href: "/compliance/documents" },
	{ label: "Recordings", href: "/compliance/recordings" },
	{ label: "Exports", href: "/compliance/exports" },
	{ label: "Access Log", href: "/compliance/access-log" },
] as const

export function ComplianceHeader({
	userName,
	userEmail,
	showAdminMenu = false,
}: {
	userName: string
	userEmail: string
	showAdminMenu?: boolean
}) {
	const pathname = usePathname()
	const signOut = useSignOutMutation()

	return (
		<header className="bg-background border-b">
			<div className="flex min-h-12 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
				<div className="min-w-0">
					<p className="truncate text-sm font-medium">{userName}</p>
					<p className="text-muted-foreground truncate text-xs">{userEmail}</p>
				</div>
				<div className="flex shrink-0 flex-wrap items-center gap-2">
					{showAdminMenu && (
						<Button
							variant="ghost"
							size="sm"
							className="xl:hidden"
							nativeButton={false}
							render={<Link href="/admin" />}
						>
							Admin menu
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={() => signOut.mutate()}
						disabled={signOut.isPending}
					>
						{signOut.isPending ? "Signing out…" : "Sign out"}
					</Button>
				</div>
			</div>
			<div className="border-t px-4 py-4 sm:px-6">
				<div className="flex flex-col gap-3">
					<h1 className="text-lg font-semibold sm:text-xl">Compliance Audit - Data Sharing</h1>
					<nav
						className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
						aria-label="Compliance audit navigation"
					>
						{complianceNavItems.map(item => (
							<Link
								key={item.href}
								href={item.href as Route}
								className={cn(
									"shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
									pathname === item.href
										? "bg-accent text-accent-foreground"
										: "text-muted-foreground hover:bg-muted hover:text-foreground"
								)}
							>
								{item.label}
							</Link>
						))}
					</nav>
				</div>
			</div>
		</header>
	)
}
