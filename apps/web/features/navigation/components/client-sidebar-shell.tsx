"use client"

import * as React from "react"
import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
	Calendar03FreeIcons,
	CameraVideoFreeIcons,
	Edit02Icon,
	HelpCircleFreeIcons,
	Home01Icon,
	Logout01FreeIcons,
	Message01FreeIcons,
	Notification03FreeIcons,
	Search01Icon,
	Settings01FreeIcons,
	Shield01FreeIcons,
	SignatureFreeIcons,
	Upload04Icon,
	UserCircleFreeIcons,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion } from "motion/react"

import { LogoIcon } from "@/core/components/logo"
import { ThemeSwitcher } from "@/core/components/mode-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/core/components/ui/avatar"
import { Badge } from "@/core/components/ui/badge"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/core/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/core/components/ui/popover"
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
	useSidebar,
} from "@/core/components/ui/sidebar"
import { TooltipProvider } from "@/core/components/ui/tooltip"
import { cn, getInitials } from "@/core/lib/utils"
import { useSignOutMutation } from "@/features/auth/api/session.hooks"
import { useConversationsQuery, type Conversation } from "@/features/messages/api/messages.hooks"
import { isMeetingSessionPath } from "@/features/navigation/lib/navigation-layout-preference"
import { clientNavItems, isNavItemActive, type NavItem } from "@/features/navigation/nav-config"
import { SiteSidebarHeaderNotices } from "@/features/navigation/components/site-sidebar-notices"
import { SiteRealtimeClient } from "@/features/realtime/components/site-realtime-client"

interface ClientSidebarShellProps {
	user: { name: string; email: string; image?: string | null } | null
	children?: React.ReactNode
}

interface Notification {
	id: string
	message: string
	time: string
	urgency: "critical" | "accent" | "info"
}

const clientNotifications: Notification[] = [
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
]

const clientQuickActions = [
	{
		label: "Legal Templates",
		href: "/legal-templates" as Route,
		icon: Edit02Icon,
	},
	{
		label: "Book Notarization",
		href: "/find-notary" as Route,
		icon: Calendar03FreeIcons,
	},
]

const navIconByHref: Record<string, typeof Home01Icon> = {
	"/dashboard": Home01Icon,
	"/legal-templates": Edit02Icon,
	"/find-notary": Search01Icon,
	"/upload-document": Upload04Icon,
	"/appointments": Calendar03FreeIcons,
	"/recordings": CameraVideoFreeIcons,
	"/document-reviews": Edit02Icon,
	"/signed": SignatureFreeIcons,
	"/enb-access": Shield01FreeIcons,
	"/messages": Message01FreeIcons,
}

function ClientSectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<SidebarGroupLabel className="text-muted-foreground px-2 text-[11px] font-medium tracking-wide uppercase">
			{children}
		</SidebarGroupLabel>
	)
}

function getUrgencyColor(urgency: Notification["urgency"]) {
	switch (urgency) {
		case "critical":
			return "bg-destructive"
		case "accent":
			return "bg-accent"
		default:
			return "bg-cyan-500"
	}
}

function ClientNavLink({
	item,
	isActive,
	unreadMsgCount,
	onNavigate,
}: {
	item: NavItem
	isActive: boolean
	unreadMsgCount: number
	onNavigate?: () => void
}) {
	const icon = navIconByHref[item.href] ?? Home01Icon

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				isActive={isActive}
				tooltip={item.label}
				render={<Link href={item.href as Route} onClick={onNavigate} />}
				className={cn(
					"h-9 transition-colors",
					isActive && "bg-sidebar-accent text-sidebar-primary font-medium"
				)}
			>
				<HugeiconsIcon
					icon={icon}
					className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
					strokeWidth={2}
				/>
				<span>{item.label}</span>
			</SidebarMenuButton>
			{item.href === "/messages" && unreadMsgCount > 0 ? (
				<SidebarMenuBadge className="bg-primary text-primary-foreground text-[10px]">
					{unreadMsgCount > 9 ? "9+" : unreadMsgCount}
				</SidebarMenuBadge>
			) : null}
		</SidebarMenuItem>
	)
}

function ClientSidebarNav({ unreadMsgCount }: { unreadMsgCount: number }) {
	const pathname = usePathname()
	const { setOpenMobile, isMobile } = useSidebar()

	const closeMobile = React.useCallback(() => {
		if (isMobile) setOpenMobile(false)
	}, [isMobile, setOpenMobile])

	const primaryItems = clientNavItems.filter(item => !item.overflow)
	const overflowItems = clientNavItems.filter(item => item.overflow)

	return (
		<>
			<SidebarGroup className="py-1">
				<ClientSectionLabel>Navigation</ClientSectionLabel>
				<SidebarGroupContent>
					<SidebarMenu>
						{primaryItems.map(item => (
							<ClientNavLink
								key={item.href}
								item={item}
								isActive={isNavItemActive(pathname, item.href)}
								unreadMsgCount={unreadMsgCount}
								onNavigate={closeMobile}
							/>
						))}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>

			{overflowItems.length > 0 ? (
				<SidebarGroup className="py-1">
					<ClientSectionLabel>More</ClientSectionLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{overflowItems.map(item => (
								<ClientNavLink
									key={item.href}
									item={item}
									isActive={isNavItemActive(pathname, item.href)}
									unreadMsgCount={unreadMsgCount}
									onNavigate={closeMobile}
								/>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			) : null}

			<SidebarGroup className="py-1">
				<ClientSectionLabel>Quick Actions</ClientSectionLabel>
				<SidebarGroupContent>
					<SidebarMenu>
						{clientQuickActions.map(action => (
							<SidebarMenuItem key={action.href + action.label}>
								<SidebarMenuButton
									tooltip={action.label}
									render={<Link href={action.href} onClick={closeMobile} />}
									className="text-muted-foreground hover:text-foreground h-8 text-xs"
								>
									<HugeiconsIcon icon={action.icon} className="size-4 shrink-0" strokeWidth={2} />
									<span className="truncate">{action.label}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</>
	)
}

function ClientNotificationsMenu() {
	return (
		<Popover>
			<PopoverTrigger
				className={cn(
					"ring-ring hover:bg-muted text-foreground relative flex size-9 items-center justify-center rounded-md outline-hidden transition-colors",
					"focus-visible:ring-2"
				)}
				aria-label="Notifications"
			>
				<HugeiconsIcon icon={Notification03FreeIcons} className="size-4" strokeWidth={2} />
				{clientNotifications.length > 0 ? (
					<Badge className="bg-accent absolute -top-1 -right-1 size-4 justify-center p-0 text-[9px] text-white">
						{clientNotifications.length}
					</Badge>
				) : null}
			</PopoverTrigger>
			<PopoverContent side="bottom" align="end" className="w-80 p-0">
				<div className="border-border flex items-center justify-between border-b px-4 py-3">
					<span className="text-sm font-semibold">Notifications</span>
					<button type="button" className="text-accent text-xs font-medium hover:underline">
						Mark all read
					</button>
				</div>
				<div className="max-h-72 space-y-1 overflow-y-auto p-2">
					{clientNotifications.map(notification => (
						<div
							key={notification.id}
							className="hover:bg-muted flex items-start gap-2.5 rounded-lg p-2.5 transition-colors"
						>
							<span
								className={cn(
									"mt-1.5 size-2 shrink-0 rounded-full",
									getUrgencyColor(notification.urgency)
								)}
							/>
							<div className="min-w-0 flex-1 space-y-0.5">
								<p className="text-sm leading-snug font-medium">{notification.message}</p>
								<span className="text-muted-foreground text-xs">{notification.time}</span>
							</div>
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	)
}

function ClientUserMenu({
	user,
}: {
	user: { name: string; email: string; image?: string | null }
}) {
	const signOut = useSignOutMutation()

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className={cn(
					"ring-sidebar-ring hover:bg-sidebar-accent flex w-full items-center gap-2 rounded-md p-2 text-left text-sm outline-hidden transition-colors",
					"focus-visible:ring-2",
					"group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2"
				)}
			>
				<Avatar className="size-8 shrink-0">
					{user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
					<AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
						{getInitials(user.name)}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
					<p className="truncate font-medium">{user.name}</p>
					<p className="text-muted-foreground truncate text-xs">{user.email}</p>
				</div>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="right" align="end" className="w-56">
				<div className="px-2 py-1.5">
					<p className="text-sm font-medium">{user.name}</p>
					<p className="text-muted-foreground truncate text-xs">{user.email}</p>
					<Badge variant="outline" className="text-primary mt-2 text-[10px]">
						Client
					</Badge>
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem render={<Link href="/profile" className="gap-2" />}>
					<HugeiconsIcon icon={UserCircleFreeIcons} className="size-4" strokeWidth={2} />
					My Profile
				</DropdownMenuItem>
				<DropdownMenuItem render={<Link href="/settings" className="gap-2" />}>
					<HugeiconsIcon icon={Settings01FreeIcons} className="size-4" strokeWidth={2} />
					Settings
				</DropdownMenuItem>
				<DropdownMenuItem render={<Link href="/profile?focus=kyc" className="gap-2" />}>
					<HugeiconsIcon icon={Shield01FreeIcons} className="size-4" strokeWidth={2} />
					Compliance & Privacy
				</DropdownMenuItem>
				<DropdownMenuItem render={<Link href="/submit-ticket" className="gap-2" />}>
					<HugeiconsIcon icon={HelpCircleFreeIcons} className="size-4" strokeWidth={2} />
					Help & Support
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					variant="destructive"
					className="gap-2"
					onClick={() => signOut.mutate()}
					disabled={signOut.isPending}
				>
					<HugeiconsIcon icon={Logout01FreeIcons} className="size-4" strokeWidth={2} />
					{signOut.isPending ? "Signing out…" : "Sign out"}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export function ClientSidebarShell({ user, children }: ClientSidebarShellProps) {
	const pathname = usePathname()
	const conversationsQuery = useConversationsQuery()
	const convs = conversationsQuery.data as Conversation[] | undefined
	const unreadMsgCount = convs?.reduce((sum, c) => sum + c.unreadCount, 0) ?? 0

	if (isMeetingSessionPath(pathname)) {
		return (
			<div className="bg-background text-foreground relative flex min-h-dvh flex-col">
				<SiteRealtimeClient />
				<main className="flex flex-1 flex-col">{children}</main>
			</div>
		)
	}

	return (
		<TooltipProvider delay={0}>
			<SidebarProvider defaultOpen>
				<SiteRealtimeClient />
				<Sidebar collapsible="icon" variant="sidebar">
					<SidebarHeader className="border-border flex h-14 shrink-0 flex-row items-center gap-0 border-b p-0 px-3">
						<Link
							href="/dashboard"
							className="ring-sidebar-ring flex min-w-0 flex-1 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2"
						>
							<LogoIcon size="sm" className="shrink-0" />
							<div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
								<span className="truncate text-sm font-semibold">Quanby Legal</span>
								<span className="text-primary truncate text-[11px] font-medium">Client Portal</span>
							</div>
						</Link>
					</SidebarHeader>

					<SidebarContent>
						<ClientSidebarNav unreadMsgCount={unreadMsgCount} />
					</SidebarContent>

					<SidebarFooter className="border-sidebar-border border-t p-1">
						{user ? <ClientUserMenu user={user} /> : null}
					</SidebarFooter>
					<SidebarRail />
				</Sidebar>

				<SidebarInset className="min-w-0">
					<header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 shrink-0 border-b backdrop-blur">
						<div className="flex h-14 items-center gap-3 px-4">
							<SidebarTrigger />
							<span className="font-poppins text-sm font-semibold md:hidden">Quanby Legal</span>
							<SiteSidebarHeaderNotices className="hidden min-w-0 flex-1 md:block" />
							<div className="ml-auto flex shrink-0 items-center gap-2">
								<ClientNotificationsMenu />
								<ThemeSwitcher />
							</div>
						</div>
						<SiteSidebarHeaderNotices className="px-4 has-[*[role=alert]]:pb-3 md:hidden" />
					</header>

					<main className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
						<div className="w-full min-w-0 px-4 py-4 sm:px-5 lg:px-6">
							<motion.div
								key={pathname}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.15, ease: "easeOut" }}
								className="min-w-0 space-y-4"
							>
								{children}
							</motion.div>
						</div>
					</main>
				</SidebarInset>
			</SidebarProvider>
		</TooltipProvider>
	)
}
