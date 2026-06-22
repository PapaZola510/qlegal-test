"use client"

import * as React from "react"

import type { AdminUser, UserRole } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button, buttonVariants } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/core/components/ui/popover"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/core/components/ui/select"
import { Switch } from "@/core/components/ui/switch"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/core/components/ui/table"
import { cn } from "@/core/lib/utils"
import {
	useAdminUsersQuery,
	useReinstateCertificateMutation,
	useSetComplianceAccessMutation,
	useSetEnpScCommissionStatusMutation,
	useSyncEnpScCommissionFromScMutation,
} from "@/features/admin/api/admin.hooks"

const SC_COMMISSION_STATUS_OPTIONS = [
	"active",
	"inactive",
	"cancelled",
	"revoked",
	"disqualified",
	"suspended",
	"unknown",
] as const

type ScCommissionStatusOption = (typeof SC_COMMISSION_STATUS_OPTIONS)[number]

const ROLE_LABELS: Record<UserRole, string> = {
	admin: "Admin",
	super_admin: "Super Admin",
	enp: "ENP",
	client: "Client",
	sub_org_admin: "Sub-org admin",
}

function hasBuiltInComplianceAccess(role: UserRole): boolean {
	return role === "admin" || role === "super_admin"
}

const STATUS_BADGE: Record<"active" | "deleted", "default" | "destructive"> = {
	active: "default",
	deleted: "destructive",
}

const CERT_STATUS_LABEL: Record<AdminUser["certificateStatus"], string> = {
	none: "None",
	studying: "Studying",
	scheduled: "Scheduled",
	failed: "Failed",
	passed: "Passed",
	active: "Active",
	expired: "Expired",
	revoked: "Revoked",
}

function formatCreatedAt(iso: string): string {
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
	return d.toISOString().slice(0, 10)
}

function userStatus(user: AdminUser): "active" | "deleted" {
	return user.isActive ? "active" : "deleted"
}

function isCertificateRevoked(user: AdminUser): boolean {
	return user.certificateStatus === "revoked"
}

function scStatusBadgeVariant(
	status: string | null | undefined
): "default" | "secondary" | "destructive" | "outline" {
	if (!status) return "outline"
	const lower = status.toLowerCase()
	if (lower === "active") return "default"
	if (lower === "inactive") return "secondary"
	return "destructive"
}

function certBadgeVariant(
	status: AdminUser["certificateStatus"]
): "default" | "secondary" | "destructive" | "outline" {
	if (status === "active") return "default"
	if (status === "revoked" || status === "expired" || status === "failed") return "destructive"
	return "secondary"
}

export function AdminUsersContent() {
	const { data: users = [], isPending, isError, error, refetch } = useAdminUsersQuery()
	const reinstateCert = useReinstateCertificateMutation()
	const setScCommissionStatus = useSetEnpScCommissionStatusMutation()
	const syncScCommission = useSyncEnpScCommissionFromScMutation()
	const complianceAccess = useSetComplianceAccessMutation()

	const [search, setSearch] = React.useState("")
	const [roleFilter, setRoleFilter] = React.useState<UserRole | "all">("all")
	const [showDeleted, setShowDeleted] = React.useState(false)
	const kpis = React.useMemo(() => {
		const active = users.filter(u => u.isActive).length
		const deleted = users.filter(u => !u.isActive).length
		const enps = users.filter(u => u.role === "enp" && u.isActive).length
		return { total: users.length, active, deleted, enps }
	}, [users])

	const filtered = React.useMemo(() => {
		const q = search.trim().toLowerCase()
		return users.filter(u => {
			if (!showDeleted && !u.isActive) return false
			if (roleFilter !== "all" && u.role !== roleFilter) return false
			if (
				q &&
				!u.name.toLowerCase().includes(q) &&
				!u.email.toLowerCase().includes(q) &&
				!u.id.toLowerCase().includes(q)
			) {
				return false
			}
			return true
		})
	}, [users, showDeleted, roleFilter, search])

	const handleComplianceToggle = async (user: AdminUser, granted: boolean) => {
		await complianceAccess.mutateAsync({ userId: user.id, granted })
	}

	return (
		<div className="space-y-6">
			<div className="grid gap-4 sm:grid-cols-4">
				<KpiTile label="Total" value={kpis.total} />
				<KpiTile label="Active" value={kpis.active} />
				<KpiTile label="Deleted" value={kpis.deleted} />
				<KpiTile label="ENPs" value={kpis.enps} />
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Users</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{isError && (
						<div className="bg-destructive/10 text-destructive flex flex-wrap items-center justify-between gap-2 rounded-lg p-3 text-sm">
							<span>{error instanceof Error ? error.message : "Failed to load users"}</span>
							<Button variant="outline" size="sm" onClick={() => refetch()}>
								Retry
							</Button>
						</div>
					)}

					<div className="flex flex-wrap items-center gap-3">
						<Input
							placeholder="Search by name, email, or user ID…"
							value={search}
							onChange={e => setSearch(e.target.value)}
							className="max-w-sm"
						/>
						<Select value={roleFilter} onValueChange={v => setRoleFilter(v as UserRole | "all")}>
							<SelectTrigger className="w-40">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All roles</SelectItem>
								{(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
									<SelectItem key={r} value={r}>
										{ROLE_LABELS[r]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<label className="text-muted-foreground flex items-center gap-2 text-sm">
							<Switch checked={showDeleted} onCheckedChange={setShowDeleted} />
							Show deleted
						</label>
					</div>

					<div className="overflow-x-auto rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead className="min-w-[12rem]">User</TableHead>
									<TableHead>Role</TableHead>
									<TableHead>Account</TableHead>
									<TableHead className="text-center">Compliance</TableHead>
									<TableHead className="min-w-[8rem]">SC status</TableHead>
									<TableHead>Certificate</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{isPending && (
									<TableRow>
										<TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
											Loading users…
										</TableCell>
									</TableRow>
								)}
								{!isPending &&
									filtered.map(user => {
										const status = userStatus(user)
										const isEnp = user.role === "enp"
										return (
											<TableRow key={user.id} className="align-middle">
												<TableCell>
													<div className="space-y-0.5">
														<p className="leading-tight font-medium">{user.name}</p>
														<p className="text-muted-foreground text-xs leading-tight">
															{user.email}
														</p>
														<p
															className="text-muted-foreground/70 font-mono text-[0.65rem] leading-tight"
															title={user.id}
														>
															{user.id.slice(0, 8)}… · {formatCreatedAt(user.createdAt)}
														</p>
													</div>
												</TableCell>
												<TableCell>
													<Badge variant="secondary" className="font-normal">
														{ROLE_LABELS[user.role]}
													</Badge>
												</TableCell>
												<TableCell>
													<div className="flex flex-wrap items-center gap-1.5">
														<Badge variant={STATUS_BADGE[status]} className="capitalize">
															{status}
														</Badge>
														<span className="text-muted-foreground text-xs capitalize">
															{user.identityStatus}
														</span>
													</div>
												</TableCell>
												<TableCell className="text-center">
													<Switch
														checked={user.complianceAuditAccess}
														disabled={
															complianceAccess.isPending ||
															!user.isActive ||
															hasBuiltInComplianceAccess(user.role)
														}
														onCheckedChange={checked => void handleComplianceToggle(user, checked)}
														aria-label={`Compliance audit access for ${user.name}`}
														title={
															hasBuiltInComplianceAccess(user.role)
																? "Platform operators already have compliance access"
																: "Grant /compliance audit access"
														}
													/>
												</TableCell>
												<TableCell>
													{isEnp ? (
														<EnpScCommissionBadge user={user} />
													) : (
														<span className="text-muted-foreground text-xs">—</span>
													)}
												</TableCell>
												<TableCell>
													{isEnp ? (
														<Badge
															variant={certBadgeVariant(user.certificateStatus)}
															className="capitalize"
														>
															{CERT_STATUS_LABEL[user.certificateStatus]}
														</Badge>
													) : (
														<span className="text-muted-foreground text-xs">—</span>
													)}
												</TableCell>
												<TableCell className="text-right">
													{isEnp ? (
														<div className="flex flex-col items-end gap-1.5">
															{isCertificateRevoked(user) ? (
																<Button
																	variant="outline"
																	size="sm"
																	className="h-8"
																	disabled={reinstateCert.isPending}
																	onClick={() => void reinstateCert.mutateAsync(user.id)}
																>
																	{reinstateCert.isPending ? "…" : "Reinstate"}
																</Button>
															) : null}
															<EnpScCommissionEditAction
																user={user}
																onSetStatus={status =>
																	setScCommissionStatus.mutateAsync({
																		userId: user.id,
																		status,
																	})
																}
																onSync={() => syncScCommission.mutateAsync(user.id)}
																isSetting={setScCommissionStatus.isPending}
																isSyncing={syncScCommission.isPending}
															/>
														</div>
													) : (
														<span className="text-muted-foreground text-xs">—</span>
													)}
												</TableCell>
											</TableRow>
										)
									})}
								{!isPending && !isError && filtered.length === 0 && (
									<TableRow>
										<TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
											No users match the current filters.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}

function EnpScCommissionBadge({ user }: { user: AdminUser }) {
	const label = user.scCommissionStatus ?? "Not synced"

	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<Badge variant={scStatusBadgeVariant(user.scCommissionStatus)} className="capitalize">
				{label}
			</Badge>
			{user.scCommissionStatusAdminOverride ? (
				<span className="text-muted-foreground text-[0.65rem]">override</span>
			) : null}
		</div>
	)
}

function EnpScCommissionEditAction({
	user,
	onSetStatus,
	onSync,
	isSetting,
	isSyncing,
}: {
	user: AdminUser
	onSetStatus: (status: ScCommissionStatusOption) => Promise<unknown>
	onSync: () => Promise<unknown>
	isSetting: boolean
	isSyncing: boolean
}) {
	const [open, setOpen] = React.useState(false)

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				disabled={!user.isActive}
				className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
			>
				Edit SC status
			</PopoverTrigger>
			<PopoverContent align="end" className="w-56 space-y-3 p-3">
				<div className="space-y-1">
					<p className="text-sm font-medium">SC commission</p>
					<p className="text-muted-foreground text-xs">
						Override status or pull live data from Supreme Court.
					</p>
				</div>
				<Select
					value={user.scCommissionStatus ?? ""}
					disabled={isSetting || !user.isActive}
					onValueChange={value => {
						if (!value) return
						void onSetStatus(value as ScCommissionStatusOption).then(() => setOpen(false))
					}}
				>
					<SelectTrigger className="h-8 w-full text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{SC_COMMISSION_STATUS_OPTIONS.map(status => (
							<SelectItem key={status} value={status} className="capitalize">
								{status}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button
					variant="outline"
					size="sm"
					className="h-8 w-full"
					disabled={isSyncing || !user.isActive}
					onClick={() => void onSync().then(() => setOpen(false))}
				>
					{isSyncing ? "Syncing…" : "Sync from SC"}
				</Button>
			</PopoverContent>
		</Popover>
	)
}

function KpiTile({ label, value }: { label: string; value: number }) {
	return (
		<Card>
			<CardContent className="pt-6">
				<p className="text-muted-foreground text-xs font-medium uppercase">{label}</p>
				<p className="text-2xl font-bold">{value}</p>
			</CardContent>
		</Card>
	)
}
