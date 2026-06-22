"use client"

import * as React from "react"
import type { Route } from "next"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
	ArrowRight01Icon,
	ComputerIcon,
	HelpCircleFreeIcons,
	Logout01FreeIcons,
	Moon01Icon,
	Notification03FreeIcons,
	SecurityCheckFreeIcons,
	Shield01FreeIcons,
	SidebarLeftIcon,
	Sun01Icon,
	UserCircleFreeIcons,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import type { UserProfile } from "@repo/contracts"

import { ThemeSwitcher } from "@/core/components/mode-toggle"
import { ErrorState, LoadingState } from "@/core/components/shared-states"
import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { Switch } from "@/core/components/ui/switch"
import { cn } from "@/core/lib/utils"
import { useSignOutMutation } from "@/features/auth/api/session.hooks"
import { PasswordInput } from "@/features/auth/components/password-input"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import { NavigationLayoutSwitcher } from "@/features/navigation/components/navigation-layout-switcher"
import { useUpdateAuthProfileMutation } from "@/features/onboarding/api/profile-onboarding.hooks"
import { profilePath } from "@/features/profile/lib/profile-routes"
import {
	useChangePasswordMutation,
	useEmailMfaStatusQuery,
	useLinkedAccountsQuery,
	useRequestEmailMfaOtpMutation,
	useRevokeOtherSessionsMutation,
} from "@/features/settings/api/settings.hooks"
import {
	defaultNotificationPreferences,
	loadNotificationPreferences,
	saveNotificationPreferences,
	type NotificationPreferences,
} from "@/features/settings/lib/notification-preferences"
import { env } from "@/env"

type SettingsSection =
	| "account"
	| "security"
	| "appearance"
	| "notifications"
	| "practice"
	| "support"

const BASE_SECTIONS: { id: SettingsSection; label: string; icon: typeof UserCircleFreeIcons }[] = [
	{ id: "account", label: "Account", icon: UserCircleFreeIcons },
	{ id: "security", label: "Security", icon: Shield01FreeIcons },
	{ id: "appearance", label: "Appearance", icon: Sun01Icon },
	{ id: "notifications", label: "Notifications", icon: Notification03FreeIcons },
	{ id: "support", label: "Support", icon: HelpCircleFreeIcons },
]

function roleLabel(role: UserProfile["role"]): string {
	switch (role) {
		case "enp":
			return "Electronic Notary Public"
		case "client":
			return "Client"
		case "admin":
			return "Electronic Notary Administrator"
		case "super_admin":
			return "Super Admin"
		case "sub_org_admin":
			return "Organization Admin"
		default:
			return role
	}
}

function SettingsNavLink({
	section,
	label,
	icon,
	active,
	onSelect,
}: {
	section: SettingsSection
	label: string
	icon: typeof UserCircleFreeIcons
	active: boolean
	onSelect: (section: SettingsSection) => void
}) {
	return (
		<button
			type="button"
			onClick={() => onSelect(section)}
			className={cn(
				"flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
				active
					? "bg-primary/10 text-primary font-medium"
					: "text-muted-foreground hover:bg-muted hover:text-foreground"
			)}
		>
			<HugeiconsIcon icon={icon} className="size-4 shrink-0" strokeWidth={2} />
			{label}
		</button>
	)
}

function PreferenceRow({
	label,
	description,
	checked,
	onCheckedChange,
}: {
	label: string
	description: string
	checked: boolean
	onCheckedChange: (checked: boolean) => void
}) {
	return (
		<div className="flex items-start justify-between gap-4 py-3">
			<div className="space-y-0.5">
				<p className="text-sm font-medium">{label}</p>
				<p className="text-muted-foreground text-xs">{description}</p>
			</div>
			<Switch checked={checked} onCheckedChange={onCheckedChange} />
		</div>
	)
}

export function SettingsPageContent() {
	const searchParams = useSearchParams()
	const profileQuery = useAuthProfileMeQuery()
	const updateProfile = useUpdateAuthProfileMutation()
	const changePassword = useChangePasswordMutation()
	const revokeSessions = useRevokeOtherSessionsMutation()
	const requestMfaOtp = useRequestEmailMfaOtpMutation()
	const signOut = useSignOutMutation()
	const linkedAccountsQuery = useLinkedAccountsQuery()
	const mfaStatusQuery = useEmailMfaStatusQuery()

	const profile = profileQuery.data as UserProfile | undefined
	const isEnp = profile?.role === "enp"
	const isClient = profile?.role === "client"

	const sections = React.useMemo(() => {
		if (!isEnp) return BASE_SECTIONS
		return [
			...BASE_SECTIONS.slice(0, 4),
			{ id: "practice" as const, label: "ENP Practice", icon: SecurityCheckFreeIcons },
			...BASE_SECTIONS.slice(4),
		]
	}, [isEnp])

	const initialSection = (searchParams.get("section") as SettingsSection | null) ?? "account"
	const [activeSection, setActiveSection] = React.useState<SettingsSection>(
		sections.some(s => s.id === initialSection) ? initialSection : "account"
	)

	const [name, setName] = React.useState("")
	const [phone, setPhone] = React.useState("")
	const [organization, setOrganization] = React.useState("")
	const [position, setPosition] = React.useState("")
	const [namePrefix, setNamePrefix] = React.useState("")
	const [currentPassword, setCurrentPassword] = React.useState("")
	const [newPassword, setNewPassword] = React.useState("")
	const [confirmPassword, setConfirmPassword] = React.useState("")
	const [notificationPrefs, setNotificationPrefs] = React.useState<NotificationPreferences>(
		defaultNotificationPreferences
	)

	React.useEffect(() => {
		setNotificationPrefs(loadNotificationPreferences())
	}, [])

	React.useEffect(() => {
		if (!profile) return
		setName(profile.name)
		setPhone(profile.phone ?? "")
		setOrganization(profile.organization ?? "")
		setPosition(profile.position ?? "")
		setNamePrefix(profile.namePrefix ?? "")
	}, [profile])

	const hasCredentialAccount =
		linkedAccountsQuery.data?.some(
			account => account.providerId === "credential" || account.providerId === "email"
		) ?? false

	function updateNotificationPref<K extends keyof NotificationPreferences>(
		key: K,
		value: NotificationPreferences[K]
	) {
		const next = { ...notificationPrefs, [key]: value }
		setNotificationPrefs(next)
		saveNotificationPreferences(next)
		toast.success("Notification preference saved")
	}

	async function handleSaveAccount() {
		if (!name.trim()) {
			toast.error("Name is required")
			return
		}
		try {
			await updateProfile.mutateAsync({
				name: name.trim(),
				phone: phone.trim() || undefined,
				...(profile?.role === "client"
					? {
							organization: organization.trim() || undefined,
							position: position.trim() || undefined,
						}
					: {}),
				...(profile?.role === "enp" ? { namePrefix: namePrefix.trim() || undefined } : {}),
			})
			toast.success("Account settings saved")
		} catch {
			toast.error("Could not save account settings")
		}
	}

	async function handleChangePassword() {
		if (!currentPassword || !newPassword) {
			toast.error("Enter your current and new password")
			return
		}
		if (newPassword.length < 8) {
			toast.error("New password must be at least 8 characters")
			return
		}
		if (newPassword !== confirmPassword) {
			toast.error("New passwords do not match")
			return
		}
		try {
			await changePassword.mutateAsync({ currentPassword, newPassword })
			setCurrentPassword("")
			setNewPassword("")
			setConfirmPassword("")
			toast.success("Password updated")
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not change password")
		}
	}

	if (profileQuery.isPending) {
		return <LoadingState message="Loading settings…" />
	}

	if (profileQuery.isError || !profile) {
		return (
			<ErrorState message="Could not load your settings." onRetry={() => profileQuery.refetch()} />
		)
	}

	const mfaStatus = mfaStatusQuery.data as { mfaVerified: boolean } | undefined
	const mfaVerified = mfaStatus?.mfaVerified ?? true

	return (
		<div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
			<nav className="lg:sticky lg:top-20 lg:self-start">
				<p className="text-muted-foreground mb-2 hidden px-3 text-[11px] font-semibold tracking-wide uppercase lg:block">
					Settings
				</p>
				<div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
					{sections.map(section => (
						<SettingsNavLink
							key={section.id}
							section={section.id}
							label={section.label}
							icon={section.icon}
							active={activeSection === section.id}
							onSelect={setActiveSection}
						/>
					))}
				</div>
			</nav>

			<div className="min-w-0 space-y-6">
				{activeSection === "account" && (
					<Card>
						<CardHeader>
							<CardTitle>Account</CardTitle>
							<CardDescription>
								Update how your name and contact details appear across Quanby Legal.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2 sm:col-span-2">
									<Label htmlFor="settings-name">Full name</Label>
									<Input
										id="settings-name"
										value={name}
										onChange={e => setName(e.target.value)}
										autoComplete="name"
									/>
								</div>
								<div className="space-y-2 sm:col-span-2">
									<Label htmlFor="settings-email">Email</Label>
									<div className="flex items-center gap-2">
										<Input
											id="settings-email"
											value={profile.email}
											readOnly
											className="bg-muted/50"
										/>
										<Badge variant={profile.emailVerified ? "default" : "outline"}>
											{profile.emailVerified ? "Verified" : "Unverified"}
										</Badge>
									</div>
									<p className="text-muted-foreground text-xs">
										Email changes are managed by your sign-in provider. Contact support if you need
										help updating it.
									</p>
								</div>
								<div className="space-y-2">
									<Label htmlFor="settings-phone">Phone</Label>
									<Input
										id="settings-phone"
										value={phone}
										onChange={e => setPhone(e.target.value)}
										autoComplete="tel"
										placeholder="+63 9XX XXX XXXX"
									/>
								</div>
								<div className="space-y-2">
									<Label>Account type</Label>
									<Input value={roleLabel(profile.role)} readOnly className="bg-muted/50" />
								</div>
								{profile.role === "client" ? (
									<>
										<div className="space-y-2">
											<Label htmlFor="settings-organization">Organization</Label>
											<Input
												id="settings-organization"
												value={organization}
												onChange={e => setOrganization(e.target.value)}
												placeholder="Company or institution"
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="settings-position">Position</Label>
											<Input
												id="settings-position"
												value={position}
												onChange={e => setPosition(e.target.value)}
												placeholder="Your role or title"
											/>
										</div>
									</>
								) : null}
								{profile.role === "enp" ? (
									<div className="space-y-2 sm:col-span-2">
										<Label htmlFor="settings-prefix">Name prefix</Label>
										<Input
											id="settings-prefix"
											value={namePrefix}
											onChange={e => setNamePrefix(e.target.value)}
											placeholder="Atty."
										/>
									</div>
								) : null}
							</div>
							<div className="flex justify-end">
								<Button onClick={handleSaveAccount} disabled={updateProfile.isPending}>
									{updateProfile.isPending ? "Saving…" : "Save changes"}
								</Button>
							</div>
						</CardContent>
					</Card>
				)}

				{activeSection === "security" && (
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>Email verification (MFA)</CardTitle>
								<CardDescription>
									A one-time code is required by email when you sign in to protect your account.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant={mfaVerified ? "default" : "secondary"}>
										{mfaVerified ? "Verified this session" : "Verification required"}
									</Badge>
									{mfaStatusQuery.isLoading ? (
										<span className="text-muted-foreground text-xs">Checking status…</span>
									) : null}
								</div>
								<p className="text-muted-foreground text-sm">
									If you were redirected to MFA during login, complete verification there. You can
									request a new code from this page if needed.
								</p>
								<div className="flex flex-wrap gap-2">
									<Button
										variant="outline"
										size="sm"
										disabled={requestMfaOtp.isPending}
										onClick={() => {
											requestMfaOtp.mutate(undefined, {
												onSuccess: () => toast.success("Verification code sent to your email"),
												onError: () => toast.error("Could not send verification code"),
											})
										}}
									>
										{requestMfaOtp.isPending ? "Sending…" : "Send verification code"}
									</Button>
									<Button
										variant="outline"
										size="sm"
										nativeButton={false}
										render={<Link href="/mfa" />}
									>
										Open MFA page
									</Button>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Password</CardTitle>
								<CardDescription>
									{hasCredentialAccount
										? "Update the password you use to sign in with email."
										: "Your account uses Google sign-in. Password changes apply only to email/password accounts."}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								{hasCredentialAccount ? (
									<>
										<div className="space-y-2">
											<Label htmlFor="current-password">Current password</Label>
											<PasswordInput
												id="current-password"
												value={currentPassword}
												onChange={e => setCurrentPassword(e.target.value)}
												autoComplete="current-password"
											/>
										</div>
										<div className="grid gap-4 sm:grid-cols-2">
											<div className="space-y-2">
												<Label htmlFor="new-password">New password</Label>
												<PasswordInput
													id="new-password"
													value={newPassword}
													onChange={e => setNewPassword(e.target.value)}
													autoComplete="new-password"
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="confirm-password">Confirm new password</Label>
												<PasswordInput
													id="confirm-password"
													value={confirmPassword}
													onChange={e => setConfirmPassword(e.target.value)}
													autoComplete="new-password"
												/>
											</div>
										</div>
										<div className="flex justify-end">
											<Button onClick={handleChangePassword} disabled={changePassword.isPending}>
												{changePassword.isPending ? "Updating…" : "Update password"}
											</Button>
										</div>
									</>
								) : (
									<p className="text-muted-foreground text-sm">
										Continue using Google to sign in, or contact support if you need to add a
										password to your account.
									</p>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Compliance & identity</CardTitle>
								<CardDescription>
									Manage government ID verification and compliance details on your profile.
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-wrap gap-2">
								<Button
									variant="outline"
									size="sm"
									nativeButton={false}
									render={<Link href={profilePath(profile.role, { focus: "kyc" })} />}
								>
									Identity verification
								</Button>
								{isEnp ? (
									<Button
										variant="outline"
										size="sm"
										nativeButton={false}
										render={<Link href={profilePath(profile.role, { focus: "notarial" })} />}
									>
										Notarial credentials
									</Button>
								) : null}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Sessions</CardTitle>
								<CardDescription>
									Sign out of other devices or end your current session.
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-wrap gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={revokeSessions.isPending}
									onClick={() => {
										revokeSessions.mutate(undefined, {
											onSuccess: () => toast.success("Signed out of other devices"),
											onError: () => toast.error("Could not revoke other sessions"),
										})
									}}
								>
									{revokeSessions.isPending ? "Revoking…" : "Sign out other devices"}
								</Button>
								<Button
									variant="destructive"
									size="sm"
									disabled={signOut.isPending}
									onClick={() => signOut.mutate()}
								>
									<HugeiconsIcon icon={Logout01FreeIcons} className="size-4" strokeWidth={2} />
									{signOut.isPending ? "Signing out…" : "Sign out"}
								</Button>
							</CardContent>
						</Card>
					</div>
				)}

				{activeSection === "appearance" && (
					<Card>
						<CardHeader>
							<CardTitle>Appearance</CardTitle>
							<CardDescription>
								Choose how Quanby Legal looks on this device. Your preference is saved locally.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center justify-between gap-4 rounded-lg border p-4">
								<div className="flex items-center gap-3">
									<div className="bg-muted flex size-10 items-center justify-center rounded-lg">
										<HugeiconsIcon icon={ComputerIcon} className="size-5" strokeWidth={2} />
									</div>
									<div>
										<p className="text-sm font-medium">Theme</p>
										<p className="text-muted-foreground text-xs">System, light, or dark mode</p>
									</div>
								</div>
								<ThemeSwitcher />
							</div>
							<div className="text-muted-foreground flex items-center gap-4 text-xs">
								<span className="inline-flex items-center gap-1">
									<HugeiconsIcon icon={Sun01Icon} className="size-3.5" strokeWidth={2} />
									Light
								</span>
								<span className="inline-flex items-center gap-1">
									<HugeiconsIcon icon={Moon01Icon} className="size-3.5" strokeWidth={2} />
									Dark
								</span>
								<span className="inline-flex items-center gap-1">
									<HugeiconsIcon icon={ComputerIcon} className="size-3.5" strokeWidth={2} />
									System
								</span>
							</div>

							{isEnp || isClient ? (
								<div className="flex items-center justify-between gap-4 rounded-lg border p-4">
									<div className="flex items-center gap-3">
										<div className="bg-muted flex size-10 items-center justify-center rounded-lg">
											<HugeiconsIcon icon={SidebarLeftIcon} className="size-5" strokeWidth={2} />
										</div>
										<div>
											<p className="text-sm font-medium">Navigation layout</p>
											<p className="text-muted-foreground text-xs">
												Sidebar on the left or a top navigation bar. Hidden during live meeting
												sessions.
											</p>
										</div>
									</div>
									<NavigationLayoutSwitcher />
								</div>
							) : null}
						</CardContent>
					</Card>
				)}

				{activeSection === "notifications" && (
					<Card>
						<CardHeader>
							<CardTitle>Notifications</CardTitle>
							<CardDescription>
								Choose which alerts you want to see. Preferences are saved on this browser until
								server-side notification settings are available.
							</CardDescription>
						</CardHeader>
						<CardContent className="divide-y">
							<PreferenceRow
								label="Appointment reminders"
								description="Upcoming sessions, confirmations, and schedule changes."
								checked={notificationPrefs.appointmentReminders}
								onCheckedChange={checked => updateNotificationPref("appointmentReminders", checked)}
							/>
							<PreferenceRow
								label="Document updates"
								description="Reviews, signatures, and notarized document availability."
								checked={notificationPrefs.documentUpdates}
								onCheckedChange={checked => updateNotificationPref("documentUpdates", checked)}
							/>
							<PreferenceRow
								label="Session alerts"
								description="Lobby invites, witness joins, and live session events."
								checked={notificationPrefs.sessionAlerts}
								onCheckedChange={checked => updateNotificationPref("sessionAlerts", checked)}
							/>
							<PreferenceRow
								label="Weekly email digest"
								description="A summary of activity sent to your inbox."
								checked={notificationPrefs.emailDigest}
								onCheckedChange={checked => updateNotificationPref("emailDigest", checked)}
							/>
						</CardContent>
					</Card>
				)}

				{activeSection === "practice" && isEnp && (
					<Card>
						<CardHeader>
							<CardTitle>ENP practice</CardTitle>
							<CardDescription>
								Professional notary settings are managed on your profile. Jump to the section you
								need.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{[
								{
									title: "Notarial credentials",
									description: "Roll number, commission, PTR, IBP, MCLE, and practice addresses.",
									href: "/profile?focus=notarial" as Route,
								},
								{
									title: "Identity verification",
									description: "Government ID and KYC status for notarial sessions.",
									href: "/profile?focus=kyc" as Route,
								},
								{
									title: "Document types & fees",
									description: "Services you offer and booking fee configuration.",
									href: "/profile" as Route,
								},
							].map(item => (
								<Link
									key={item.href + item.title}
									href={item.href}
									className="hover:bg-muted/60 flex items-center justify-between gap-3 rounded-lg border p-4 transition-colors"
								>
									<div>
										<p className="text-sm font-medium">{item.title}</p>
										<p className="text-muted-foreground text-xs">{item.description}</p>
									</div>
									<HugeiconsIcon
										icon={ArrowRight01Icon}
										className="text-muted-foreground size-4 shrink-0"
										strokeWidth={2}
									/>
								</Link>
							))}
						</CardContent>
					</Card>
				)}

				{activeSection === "support" && (
					<Card>
						<CardHeader>
							<CardTitle>Support & legal</CardTitle>
							<CardDescription>Get help or review platform policies.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex flex-wrap gap-2">
								<Button
									variant="outline"
									nativeButton={false}
									render={<Link href="/submit-ticket" />}
								>
									<HugeiconsIcon icon={HelpCircleFreeIcons} className="size-4" strokeWidth={2} />
									Submit a support ticket
								</Button>
								<Button variant="outline" nativeButton={false} render={<Link href="/profile" />}>
									<HugeiconsIcon icon={UserCircleFreeIcons} className="size-4" strokeWidth={2} />
									View full profile
								</Button>
							</div>
							<Separator />
							<div className="space-y-2 text-sm">
								{env.NEXT_PUBLIC_TERMS_URL ? (
									<a
										href={env.NEXT_PUBLIC_TERMS_URL}
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary hover:underline"
									>
										Terms of service
									</a>
								) : null}
								{env.NEXT_PUBLIC_PRIVACY_URL ? (
									<a
										href={env.NEXT_PUBLIC_PRIVACY_URL}
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary block hover:underline"
									>
										Privacy policy
									</a>
								) : null}
								{!env.NEXT_PUBLIC_TERMS_URL && !env.NEXT_PUBLIC_PRIVACY_URL ? (
									<p className="text-muted-foreground text-xs">
										Configure NEXT_PUBLIC_TERMS_URL and NEXT_PUBLIC_PRIVACY_URL to show legal links
										here.
									</p>
								) : null}
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	)
}
