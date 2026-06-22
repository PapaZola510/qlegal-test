"use client"

import * as React from "react"
import type { Route } from "next"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"

import { Logo } from "@/core/components/logo"
import { Avatar, AvatarFallback, AvatarImage } from "@/core/components/ui/avatar"
import { Button } from "@/core/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/core/components/ui/dropdown-menu"
import { useThemeTransition } from "@/core/context/theme-provider"
import { cn, getInitials } from "@/core/lib/utils"
import { useSignOutMutation } from "@/features/auth/api/session.hooks"
import { useConversationsQuery, type Conversation } from "@/features/messages/api/messages.hooks"
import { ClientSidebarShell } from "@/features/navigation/components/client-sidebar-shell"
import { EnpSidebarShell } from "@/features/navigation/components/enp-sidebar-shell"
import { useNavigationLayout } from "@/features/navigation/context/navigation-layout-provider"
import { isMeetingSessionPath } from "@/features/navigation/lib/navigation-layout-preference"
import {
	getNavItemsByRole,
	isNavItemActive,
	navItemDisplayLabel,
	partitionNavItems,
	type NavItem,
	type SiteRole,
} from "@/features/navigation/nav-config"
import { profilePathForSiteRole } from "@/features/profile/lib/profile-routes"
import { SiteRealtimeClient } from "@/features/realtime/components/site-realtime-client"

// Premium Inline SVGs for Visual Identity
const LogoIcon = () => (
	<Image
		src="/LOGO.png"
		alt="Q Legal Logo"
		width={36}
		height={36}
		className="pointer-events-none size-9 object-contain select-none"
		priority
	/>
)

const BellIcon = ({ className }: { className?: string }) => (
	<svg
		className={cn("size-5", className)}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth="2"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
		/>
	</svg>
)

const PlusIcon = ({ className }: { className?: string }) => (
	<svg
		className={cn("size-5", className)}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth="2"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
	</svg>
)

const SunIcon = ({ className }: { className?: string }) => (
	<svg
		className={cn("size-4", className)}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth="2"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"
		/>
	</svg>
)

const MoonIcon = ({ className }: { className?: string }) => (
	<svg
		className={cn("size-4", className)}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth="2"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
		/>
	</svg>
)

const LogoutIcon = ({ className }: { className?: string }) => (
	<svg
		className={cn("size-4", className)}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth="2"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
		/>
	</svg>
)

const UserIcon = ({ className }: { className?: string }) => (
	<svg
		className={cn("size-4", className)}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth="2"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
		/>
	</svg>
)

const SettingsIcon = ({ className }: { className?: string }) => (
	<svg
		className={cn("size-4", className)}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth="2"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
		/>
		<circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
	</svg>
)

const ShieldIcon = ({ className }: { className?: string }) => (
	<svg
		className={cn("size-4", className)}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth="2"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
		/>
	</svg>
)

const HelpIcon = ({ className }: { className?: string }) => (
	<svg
		className={cn("size-4", className)}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth="2"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
		/>
	</svg>
)

const MenuIcon = ({ className }: { className?: string }) => (
	<svg
		className={cn("size-6", className)}
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
		strokeWidth="2"
		xmlns="http://www.w3.org/2000/svg"
	>
		<path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
	</svg>
)

interface Notification {
	id: string
	message: string
	time: string
	urgency: "critical" | "accent" | "info"
}

interface SiteNavProps {
	user: { name: string; email: string; image?: string | null } | null
	role: SiteRole | null
	complianceAuditAccess?: boolean
}

const mockNotifications: Record<string, Notification[]> = {
	client: [
		{
			id: "c1",
			message: "Your appointment with Atty. Santos is in 30 min",
			time: "2 min ago",
			urgency: "critical",
		},
		{
			id: "c2",
			message: "Document ready to sign: E-Notary Appointment Form",
			time: "1 hour ago",
			urgency: "accent",
		},
		{
			id: "c3",
			message: "Notarized PDF available for download",
			time: "1 day ago",
			urgency: "info",
		},
	],
	enp: [
		{
			id: "e1",
			message: "New booking request from Sean Palacay",
			time: "5 min ago",
			urgency: "accent",
		},
		{
			id: "e2",
			message: "Notarization Session starting in 15 min",
			time: "12 min ago",
			urgency: "critical",
		},
		{
			id: "e3",
			message: "Witness Jethro has joined the room",
			time: "25 min ago",
			urgency: "info",
		},
		{
			id: "e4",
			message: "Document signed by Principal — ready for seal",
			time: "1 hour ago",
			urgency: "accent",
		},
	],
	admin: [
		{
			id: "a1",
			message: "System alert: CPU load at 92% on video server",
			time: "1 min ago",
			urgency: "critical",
		},
		{
			id: "a2",
			message: "Failed login attempts spike detected (IP: 110.54.x.x)",
			time: "15 min ago",
			urgency: "critical",
		},
		{
			id: "a3",
			message: "SC Central Notarial Database sync status: Healthy",
			time: "2 hours ago",
			urgency: "info",
		},
	],
	witness: [
		{
			id: "w1",
			message: "You are invited as a witness by Sean Palacay",
			time: "20 min ago",
			urgency: "critical",
		},
		{ id: "w2", message: "Session starting in 15 min", time: "30 min ago", urgency: "accent" },
	],
}

interface QuickAction {
	label: string
	href?: string
}

const mockQuickActions: Record<string, QuickAction[]> = {
	client: [{ label: "Book Notarization", href: "/find-notary" }],
	enp: [
		{ label: "Review Document Requests", href: "/document-reviews" },
		{ label: "Start QuickSign Session", href: "/quicksign" },
		{ label: "Appointments", href: "/appointments" },
		{ label: "Legal Templates", href: "/legal-templates" },
	],
	admin: [
		{ label: "Create System User", href: "/admin/users" },
		{ label: "View System Health", href: "/admin" },
		{ label: "Download Audit Logs", href: "/admin" },
	],
	witness: [{ label: "Join Active Session" }],
}

function DesktopNavLink({
	item,
	isActive,
	unreadMsgCount,
}: {
	item: NavItem
	isActive: boolean
	unreadMsgCount: number
}) {
	return (
		<Link
			href={item.href as Route}
			className={cn(
				"font-poppins relative flex h-14 shrink-0 items-center px-2.5 text-xs font-medium tracking-wide whitespace-nowrap transition-colors duration-200 outline-none xl:px-3 xl:text-[13px]",
				isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
			)}
		>
			{navItemDisplayLabel(item, true)}
			{item.href === "/messages" && unreadMsgCount > 0 && (
				<span className="bg-accent shadow-accent/50 absolute -top-0.5 -right-1 flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-sm">
					{unreadMsgCount > 9 ? "9+" : unreadMsgCount}
				</span>
			)}
			{isActive ? (
				<motion.div
					layoutId="qlegal-nav-active-indicator"
					className="from-primary via-accent absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-gradient-to-r to-pink-500"
					transition={{ type: "spring", stiffness: 380, damping: 30 }}
				/>
			) : null}
		</Link>
	)
}

export function SiteNav({
	user,
	role,
	complianceAuditAccess = false,
	children,
}: SiteNavProps & { children?: React.ReactNode }) {
	const pathname = usePathname()
	const [mounted, setMounted] = React.useState(false)
	const [bellOpen, setBellOpen] = React.useState(false)
	const [actionsOpen, setActionsOpen] = React.useState(false)
	const [userMenuOpen, setUserMenuOpen] = React.useState(false)
	const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

	const { resolvedTheme, setTheme } = useThemeTransition()
	const signOut = useSignOutMutation()
	const conversationsQuery = useConversationsQuery()

	React.useEffect(() => {
		setMounted(true)
	}, [])

	React.useEffect(() => {
		const mq = window.matchMedia("(min-width: 1024px)")
		const closeMobileMenu = () => {
			if (mq.matches) setMobileMenuOpen(false)
		}
		mq.addEventListener("change", closeMobileMenu)
		return () => mq.removeEventListener("change", closeMobileMenu)
	}, [])

	const activeRole: SiteRole = role || "client"
	const { layout: navigationLayout } = useNavigationLayout()
	const isEnpRole = activeRole === "enp" || activeRole === "attorney_enp"
	const isClientRole = activeRole === "client"

	if (isMeetingSessionPath(pathname)) {
		return (
			<div className="bg-background text-foreground relative flex min-h-dvh flex-col">
				<SiteRealtimeClient />
				<main className="flex flex-1 flex-col">{children}</main>
			</div>
		)
	}

	if (isEnpRole && navigationLayout === "sidebar") {
		return <EnpSidebarShell user={user}>{children}</EnpSidebarShell>
	}

	if (isClientRole && navigationLayout === "sidebar") {
		return <ClientSidebarShell user={user}>{children}</ClientSidebarShell>
	}

	const baseNavItems = getNavItemsByRole(activeRole)
	const visibleNavItems = baseNavItems
	const { primary: primaryNavItems, overflow: overflowNavItems } =
		partitionNavItems(visibleNavItems)
	const overflowActive = overflowNavItems.some(item => isNavItemActive(pathname, item.href))

	const convs = conversationsQuery.data as Conversation[] | undefined
	const unreadMsgCount = convs?.reduce((sum, c) => sum + c.unreadCount, 0) ?? 0

	const activeNotifications = (mockNotifications[activeRole] || mockNotifications.client) ?? []
	const activeQuickActions = (mockQuickActions[activeRole] || mockQuickActions.client) ?? []

	// Urgency styling for notification dots
	const getUrgencyColor = (urgency: Notification["urgency"]) => {
		switch (urgency) {
			case "critical":
				return "bg-destructive border-red-500 shadow-red-500/50 animate-pulse"
			case "accent":
				return "bg-accent border-magenta-500 shadow-magenta-500/50"
			default:
				return "bg-cyan-500 border-cyan-400"
		}
	}

	const getRoleGradientPill = (userRole: SiteRole) => {
		switch (userRole) {
			case "client":
				return "from-pink-500 to-rose-400 shadow-pink-500/10 text-white font-medium"
			case "enp":
			case "attorney_enp":
				return "from-primary to-accent shadow-purple-500/10 text-white font-medium"
			case "admin":
				return "bg-primary shadow-purple-950/20 text-white font-medium"
			default:
				return "from-pink-500 to-rose-400 text-white"
		}
	}

	const getRoleDisplay = (userRole: SiteRole) => {
		switch (userRole) {
			case "client":
				return "Client"
			case "enp":
			case "attorney_enp":
				return "ENP"
			case "admin":
				return "Admin"
			case "witness":
				return "Witness"
			default:
				return "Client"
		}
	}

	return (
		<div className="bg-background text-foreground relative flex min-h-screen flex-col transition-colors duration-300">
			<SiteRealtimeClient />
			{/* Fixed Premium Header */}
			<header className="border-border bg-background/85 sticky top-0 z-50 w-full border-b backdrop-blur-md">
				<div className="mx-auto flex h-14 max-w-7xl items-stretch justify-between gap-3 px-4 sm:px-6 lg:px-8">
					{/* Left Section: Logo & Brand Wordmark */}
					<Link
						href="/dashboard"
						className="group flex shrink-0 items-center gap-2.5 self-center focus-visible:outline-none"
					>
						<motion.div
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							className="relative flex items-center justify-center"
						>
							<LogoIcon />
						</motion.div>
						<span className="font-poppins from-foreground via-foreground to-muted-foreground hidden bg-gradient-to-r bg-clip-text text-base font-bold tracking-tight text-transparent transition-opacity group-hover:opacity-90 sm:inline">
							Quanby Legal
						</span>
					</Link>

					{/* Center Section: Primary Navigation Links (Desktop) */}
					<nav
						className="relative hidden min-w-0 flex-1 items-stretch justify-center lg:flex"
						aria-label="Primary"
					>
						<div className="flex items-stretch">
							{primaryNavItems.map(item => (
								<DesktopNavLink
									key={item.href}
									item={item}
									isActive={isNavItemActive(pathname, item.href)}
									unreadMsgCount={unreadMsgCount}
								/>
							))}
							{overflowNavItems.length > 0 ? (
								<DropdownMenu>
									<DropdownMenuTrigger
										className={cn(
											"font-poppins relative flex h-14 shrink-0 items-center gap-1 px-2.5 text-xs font-medium tracking-wide whitespace-nowrap transition-colors duration-200 outline-none xl:px-3 xl:text-[13px]",
											overflowActive
												? "text-foreground"
												: "text-muted-foreground hover:text-foreground"
										)}
									>
										More
										<svg
											className="size-3.5 opacity-70"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											strokeWidth="2"
											aria-hidden
										>
											<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
										</svg>
										{overflowActive ? (
											<motion.div
												layoutId="qlegal-nav-active-indicator"
												className="from-primary via-accent absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-gradient-to-r to-pink-500"
												transition={{ type: "spring", stiffness: 380, damping: 30 }}
											/>
										) : null}
									</DropdownMenuTrigger>
									<DropdownMenuContent align="center" className="min-w-44">
										{overflowNavItems.map(item => {
											const isActive = isNavItemActive(pathname, item.href)
											return (
												<DropdownMenuItem
													key={item.href}
													render={
														<Link
															href={item.href as Route}
															className={cn(
																"font-poppins w-full",
																isActive && "text-foreground font-semibold"
															)}
														/>
													}
												>
													{item.label}
												</DropdownMenuItem>
											)
										})}
									</DropdownMenuContent>
								</DropdownMenu>
							) : null}
						</div>
					</nav>

					{/* Right Section: Controls & Profile */}
					<div className="flex shrink-0 items-center gap-2 self-center sm:gap-3">
						{/* Actions Panel (Plus Button) */}
						<div className="relative">
							<motion.button
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={() => {
									setActionsOpen(!actionsOpen)
									setBellOpen(false)
									setUserMenuOpen(false)
								}}
								className={cn(
									"border-border text-muted-foreground hover:text-foreground flex size-9 items-center justify-center rounded-full border transition-all duration-200",
									actionsOpen && "bg-muted text-foreground border-accent"
								)}
								aria-label="Quick Actions"
							>
								<PlusIcon
									className={cn("transition-transform duration-200", actionsOpen && "rotate-45")}
								/>
							</motion.button>
							<AnimatePresence>
								{actionsOpen && (
									<motion.div
										initial={{ opacity: 0, y: 10, scale: 0.95 }}
										animate={{ opacity: 1, y: 0, scale: 1 }}
										exit={{ opacity: 0, y: 10, scale: 0.95 }}
										transition={{ duration: 0.15 }}
										className="border-border bg-card absolute right-0 mt-2 w-52 rounded-xl border p-2.5 shadow-xl shadow-purple-950/20"
									>
										<div className="text-muted-foreground px-2.5 pb-2 text-[10px] font-bold tracking-wider uppercase">
											Quick Actions
										</div>
										<div className="space-y-1">
											{activeQuickActions.map((action, i) =>
												action.href ? (
													<Link
														key={i}
														href={action.href as Route}
														onClick={() => setActionsOpen(false)}
														className="font-poppins text-foreground hover:bg-muted block w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors"
													>
														{action.label}
													</Link>
												) : (
													<button
														key={i}
														onClick={() => setActionsOpen(false)}
														className="font-poppins text-foreground hover:bg-muted w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors"
													>
														{action.label}
													</button>
												)
											)}
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>

						{/* Notifications Bell */}
						<div className="relative">
							<motion.button
								whileHover="hover"
								variants={{
									hover: { rotate: [0, -10, 10, -10, 10, 0], transition: { duration: 0.5 } },
								}}
								onClick={() => {
									setBellOpen(!bellOpen)
									setActionsOpen(false)
									setUserMenuOpen(false)
								}}
								className={cn(
									"border-border text-muted-foreground hover:text-foreground relative flex size-9 items-center justify-center rounded-full border transition-all duration-200",
									bellOpen && "bg-muted text-foreground border-accent"
								)}
								aria-label="Notifications"
							>
								<BellIcon />
								{activeNotifications.length > 0 && (
									<span className="bg-accent shadow-accent/50 absolute top-1 right-1 size-2 animate-pulse rounded-full shadow-sm" />
								)}
							</motion.button>
							<AnimatePresence>
								{bellOpen && (
									<motion.div
										initial={{ opacity: 0, y: 10, scale: 0.95 }}
										animate={{ opacity: 1, y: 0, scale: 1 }}
										exit={{ opacity: 0, y: 10, scale: 0.95 }}
										transition={{ duration: 0.15 }}
										className="border-border bg-card absolute right-0 mt-2 w-80 rounded-xl border p-3 shadow-xl shadow-purple-950/20"
									>
										<div className="border-border/60 mb-2 flex items-center justify-between border-b pb-2">
											<span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
												Notifications
											</span>
											<button className="text-accent text-[11px] font-semibold hover:underline">
												Mark all read
											</button>
										</div>
										<div className="max-h-72 space-y-2.5 overflow-y-auto">
											{activeNotifications.map(notification => (
												<div
													key={notification.id}
													className="hover:bg-muted relative flex items-start gap-2.5 rounded-lg p-2 transition-colors duration-150"
												>
													<span
														className={cn(
															"mt-1.5 size-2 shrink-0 rounded-full border shadow-sm",
															getUrgencyColor(notification.urgency)
														)}
													/>
													<div className="flex-1 space-y-0.5">
														<p className="font-montserrat text-foreground text-[13px] leading-snug font-medium">
															{notification.message}
														</p>
														<span className="text-muted-foreground text-[10px]">
															{notification.time}
														</span>
													</div>
												</div>
											))}
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>

						{/* Custom Pill-Switch Dark Mode Toggle */}
						<div className="relative">
							{mounted && (
								<div
									onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
									className="bg-muted border-border relative flex h-7 w-12 cursor-pointer items-center rounded-full border p-0.5 transition-all duration-300"
								>
									<motion.div
										layout
										className="bg-card border-border z-10 flex size-5.5 items-center justify-center rounded-full border shadow-md"
										transition={{ type: "spring", stiffness: 500, damping: 30 }}
										style={{
											marginLeft: resolvedTheme === "dark" ? "auto" : "0px",
										}}
									>
										{resolvedTheme === "dark" ? (
											<MoonIcon className="text-accent size-3" />
										) : (
											<SunIcon className="size-3 text-amber-500" />
										)}
									</motion.div>
								</div>
							)}
						</div>

						{/* User Avatar & Dropdown */}
						<div className="relative">
							{mounted && user && (
								<>
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={() => {
											setUserMenuOpen(!userMenuOpen)
											setBellOpen(false)
											setActionsOpen(false)
										}}
										className="border-border hover:border-accent relative flex items-center justify-center rounded-full border p-0.5 transition-colors outline-none"
									>
										<Avatar size="sm" className="border-border size-[34px] border">
											{user.image && <AvatarImage src={user.image} alt={user.name} />}
											<AvatarFallback className="from-primary to-accent font-poppins bg-gradient-to-tr text-xs font-semibold text-white">
												{getInitials(user.name)}
											</AvatarFallback>
										</Avatar>
									</motion.button>
									<AnimatePresence>
										{userMenuOpen && (
											<motion.div
												initial={{ opacity: 0, y: 10, scale: 0.95 }}
												animate={{ opacity: 1, y: 0, scale: 1 }}
												exit={{ opacity: 0, y: 10, scale: 0.95 }}
												transition={{ duration: 0.15 }}
												className="border-border bg-card absolute right-0 mt-2 w-64 rounded-xl border p-3.5 shadow-xl shadow-purple-950/20"
											>
												<div className="border-border/60 flex items-center gap-3 border-b pb-3.5">
													<Avatar className="border-border size-10 border">
														{user.image && <AvatarImage src={user.image} alt={user.name} />}
														<AvatarFallback className="from-primary to-accent bg-gradient-to-tr text-white">
															{getInitials(user.name)}
														</AvatarFallback>
													</Avatar>
													<div className="min-w-0 flex-1">
														<p className="font-poppins text-foreground truncate text-sm font-semibold">
															{user.name}
														</p>
														<p className="text-muted-foreground truncate text-xs">{user.email}</p>

														<div className="mt-1.5 flex">
															<span
																className={cn(
																	"inline-flex items-center rounded-full bg-gradient-to-tr px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase shadow-sm",
																	getRoleGradientPill(activeRole)
																)}
															>
																{getRoleDisplay(activeRole)}
															</span>
														</div>
													</div>
												</div>
												<div className="space-y-1 py-2">
													<Link
														href={profilePathForSiteRole(activeRole)}
														onClick={() => setUserMenuOpen(false)}
														className="text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
													>
														<UserIcon />
														My Profile
													</Link>
													<Link
														href="/settings"
														onClick={() => setUserMenuOpen(false)}
														className="text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
													>
														<SettingsIcon />
														Settings
													</Link>
													<Link
														href={profilePathForSiteRole(activeRole, { focus: "kyc" })}
														onClick={() => setUserMenuOpen(false)}
														className="text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
													>
														<ShieldIcon />
														Compliance & Privacy
													</Link>
													<Link
														href="/submit-ticket"
														onClick={() => setUserMenuOpen(false)}
														className="text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
													>
														<HelpIcon />
														Help & Support
													</Link>
												</div>
												<div className="border-border/60 mt-1 border-t pt-2">
													<button
														onClick={() => {
															setUserMenuOpen(false)
															signOut.mutate()
														}}
														disabled={signOut.isPending}
														className="text-destructive flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors hover:bg-red-500/10"
													>
														<LogoutIcon />
														{signOut.isPending ? "Signing out..." : "Sign Out"}
													</button>
												</div>
											</motion.div>
										)}
									</AnimatePresence>
								</>
							)}
						</div>

						{/* Mobile Hamburger Button */}
						<motion.button
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							onClick={() => setMobileMenuOpen(true)}
							className="border-border text-muted-foreground hover:text-foreground flex size-9 items-center justify-center rounded-full border transition-colors lg:hidden"
							aria-label="Open Navigation Menu"
						>
							<MenuIcon />
						</motion.button>
					</div>
				</div>
			</header>

			{/* Full Screen Mobile Overlay Menu */}
			<AnimatePresence>
				{mobileMenuOpen && (
					<motion.div
						initial={{ opacity: 0, y: -20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						transition={{ duration: 0.25 }}
						className="bg-background fixed inset-0 z-50 flex flex-col p-6 lg:hidden"
					>
						<div className="border-border/60 flex items-center justify-between border-b pb-6">
							<Link
								href="/dashboard"
								className="flex items-center gap-3"
								onClick={() => setMobileMenuOpen(false)}
							>
								<LogoIcon />
								<span className="font-poppins text-lg font-bold tracking-tight">Quanby Legal</span>
							</Link>
							<button
								onClick={() => setMobileMenuOpen(false)}
								className="border-border text-muted-foreground hover:text-foreground flex size-9 items-center justify-center rounded-full border"
								aria-label="Close Navigation Menu"
							>
								<svg
									className="size-5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						<nav className="flex flex-col gap-1 py-8">
							{primaryNavItems.map(item => (
								<Link
									key={item.href}
									href={item.href as Route}
									onClick={() => setMobileMenuOpen(false)}
									className={cn(
										"font-poppins rounded-lg px-2 py-2.5 text-xl font-medium transition-colors",
										isNavItemActive(pathname, item.href)
											? "bg-muted text-foreground"
											: "text-muted-foreground hover:text-foreground"
									)}
								>
									{item.label}
								</Link>
							))}
							{overflowNavItems.length > 0 ? (
								<>
									<p className="text-muted-foreground mt-4 px-2 text-[11px] font-semibold tracking-wider uppercase">
										More
									</p>
									{overflowNavItems.map(item => (
										<Link
											key={item.href}
											href={item.href as Route}
											onClick={() => setMobileMenuOpen(false)}
											className={cn(
												"font-poppins rounded-lg px-2 py-2.5 text-lg font-medium transition-colors",
												isNavItemActive(pathname, item.href)
													? "bg-muted text-foreground"
													: "text-muted-foreground hover:text-foreground"
											)}
										>
											{item.label}
										</Link>
									))}
								</>
							) : null}
						</nav>

						<div className="border-border/60 mt-auto border-t pt-6">
							{user && (
								<div className="flex items-center gap-3">
									<Avatar className="border-border size-11 border">
										{user.image && <AvatarImage src={user.image} alt={user.name} />}
										<AvatarFallback className="from-primary to-accent bg-gradient-to-tr text-white">
											{getInitials(user.name)}
										</AvatarFallback>
									</Avatar>
									<div>
										<p className="font-poppins text-sm font-semibold">{user.name}</p>
										<p className="text-muted-foreground text-xs">{user.email}</p>
									</div>
								</div>
							)}
							<div className="mt-6 flex gap-3">
								<button
									onClick={() => {
										setMobileMenuOpen(false)
										signOut.mutate()
									}}
									className="text-destructive flex-1 rounded-xl bg-red-500/10 py-3 text-center text-sm font-semibold transition-all hover:bg-red-500/20"
								>
									Sign Out
								</button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Faint ambient decorative layers to honor Philippine SC ENF Gravitas */}
			<div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
				{/* Drifting Q monogram SVG at 3-5% opacity */}
				<motion.div
					className="text-primary/3 absolute -top-32 -right-32 size-[500px] opacity-5 sm:size-[800px]"
					animate={{
						rotate: 360,
						x: [0, 20, -20, 0],
						y: [0, -20, 20, 0],
					}}
					transition={{
						rotate: { duration: 120, repeat: Infinity, ease: "linear" },
						x: { duration: 15, repeat: Infinity, ease: "easeInOut" },
						y: { duration: 15, repeat: Infinity, ease: "easeInOut" },
					}}
				>
					<svg viewBox="0 0 200 200" fill="currentColor" className="size-full">
						<path d="M100 20C55.8 20 20 55.8 20 100c0 19.3 6.8 37 18.2 50.8l-15.6 27c-1.5 2.6.4 5.8 3.4 5.8h24.2l12.4-21.5c11.4 5.1 24.1 7.9 37.4 7.9 44.2 0 80-35.8 80-80S144.2 20 100 20zm0 135c-30.4 0-55-24.6-55-55s24.6-55 55-55 55 24.6 55 55-24.6 55-55 55z" />
					</svg>
				</motion.div>

				{/* Glowing ambient orb with low opacity */}
				<motion.div
					className="from-primary/8 via-accent/5 absolute -bottom-48 -left-48 size-[600px] rounded-full bg-gradient-to-tr to-transparent blur-3xl"
					animate={{
						x: [0, 40, -40, 0],
						y: [0, -40, 40, 0],
					}}
					transition={{
						duration: 25,
						repeat: Infinity,
						ease: "easeInOut",
					}}
				/>
			</div>

			{/* Main Content Area — avoid AnimatePresence mode="wait" (blocks Next.js route transitions) */}
			<main className="flex flex-1 flex-col">
				<div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
					<motion.div
						key={pathname}
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.15, ease: "easeOut" }}
						className="space-y-8"
					>
						{children}
					</motion.div>
				</div>
			</main>
		</div>
	)
}
