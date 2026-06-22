"use client"

import * as React from "react"
import { format } from "date-fns"
import { toast } from "sonner"

import type { CreateMaintenanceWindowInput, MaintenanceWindow } from "@repo/contracts"

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
import { Switch } from "@/core/components/ui/switch"
import { Textarea } from "@/core/components/ui/textarea"
import {
	useAdminMaintenanceWindowsQuery,
	useCancelMaintenanceWindowMutation,
	useCompleteMaintenanceWindowMutation,
	useCreateMaintenanceWindowMutation,
	useMaintenanceStatusQuery,
	useSetMaintenanceModeMutation,
} from "@/features/admin/api/admin.hooks"

function toIsoFromLocal(value: string): string {
	return new Date(value).toISOString()
}

function toLocalDefault(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0")
	const y = date.getFullYear()
	const m = pad(date.getMonth() + 1)
	const d = pad(date.getDate())
	const h = pad(date.getHours())
	const mm = pad(date.getMinutes())
	return `${y}-${m}-${d}T${h}:${mm}`
}

function formatWindow(item: MaintenanceWindow): string {
	const starts = format(new Date(item.startsAt), "PPp")
	const ends = format(new Date(item.endsAt), "PPp")
	return `${starts} - ${ends} (${item.durationMinutes} min)`
}

function MaintenanceWindowRow({ item }: { item: MaintenanceWindow }) {
	const cancel = useCancelMaintenanceWindowMutation()
	const complete = useCompleteMaintenanceWindowMutation()
	const busy = cancel.isPending || complete.isPending

	return (
		<div className="rounded-md border p-3">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0 space-y-1">
					<p className="text-sm font-semibold">{item.title}</p>
					<p className="text-muted-foreground text-xs">{formatWindow(item)}</p>
					<p className="text-sm">{item.message}</p>
					<p className="text-muted-foreground text-xs capitalize">
						Audience: {item.audience === "client" ? "Client / Principal" : item.audience}
					</p>
				</div>
				<div className="flex shrink-0 flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={busy}
						onClick={() => {
							void complete
								.mutateAsync(item.id)
								.then(() => toast.success("Maintenance marked as done"))
								.catch((err: unknown) => {
									const text =
										err instanceof Error ? err.message : "Could not mark maintenance as done"
									toast.error(text)
								})
						}}
					>
						Mark as done
					</Button>
					<Button
						type="button"
						variant="destructive"
						size="sm"
						disabled={busy}
						onClick={() => {
							if (!window.confirm("Delete this scheduled maintenance window?")) return
							void cancel
								.mutateAsync(item.id)
								.then(() => toast.success("Maintenance window deleted"))
								.catch((err: unknown) => {
									const text =
										err instanceof Error ? err.message : "Could not delete maintenance window"
									toast.error(text)
								})
						}}
					>
						Delete
					</Button>
				</div>
			</div>
		</div>
	)
}

function MaintenanceKillSwitch() {
	const statusQ = useMaintenanceStatusQuery()
	const setMode = useSetMaintenanceModeMutation()
	const enabled = statusQ.data?.enabled ?? false
	const [message, setMessage] = React.useState("")

	React.useEffect(() => {
		setMessage(statusQ.data?.message ?? "")
	}, [statusQ.data?.message])

	const apply = (nextEnabled: boolean) => {
		void setMode
			.mutateAsync({ enabled: nextEnabled, message: message.trim() || undefined })
			.then(() => {
				toast.success(nextEnabled ? "Maintenance mode enabled" : "Maintenance mode disabled")
			})
			.catch((err: unknown) => {
				const text = err instanceof Error ? err.message : "Could not update maintenance mode"
				toast.error(text)
			})
	}

	return (
		<Card className={enabled ? "border-destructive" : undefined}>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<CardTitle>Maintenance Mode</CardTitle>
					<Badge variant={enabled ? "destructive" : "secondary"}>
						{enabled ? "ON — site locked" : "OFF"}
					</Badge>
				</div>
				<CardDescription>
					When enabled, all non-admin visitors are locked to the maintenance page and the API
					returns 503 (mobile included). Admins keep full access.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="maintenance-mode-message">Message shown on the maintenance page</Label>
					<Textarea
						id="maintenance-mode-message"
						value={message}
						onChange={e => setMessage(e.target.value)}
						maxLength={2000}
						rows={3}
						placeholder="Leave blank to use the default message."
						disabled={statusQ.isPending}
					/>
				</div>
				<div className="flex items-center justify-between gap-4 rounded-md border p-3">
					<div className="space-y-0.5">
						<p className="text-sm font-semibold">
							{enabled ? "Maintenance mode is ON" : "Maintenance mode is OFF"}
						</p>
						<p className="text-muted-foreground text-xs">
							Toggle to {enabled ? "restore" : "lock"} access immediately.
						</p>
					</div>
					<Switch
						checked={enabled}
						disabled={statusQ.isPending || setMode.isPending}
						onCheckedChange={apply}
						aria-label="Toggle maintenance mode"
					/>
				</div>
				{enabled ? null : (
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={statusQ.isPending || setMode.isPending}
						onClick={() => apply(false)}
					>
						Save message
					</Button>
				)}
			</CardContent>
		</Card>
	)
}

export function AdminMaintenanceSettings() {
	const maintenanceQ = useAdminMaintenanceWindowsQuery()
	const create = useCreateMaintenanceWindowMutation()

	const now = new Date()
	const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
	const [title, setTitle] = React.useState("Scheduled Maintenance")
	const [message, setMessage] = React.useState(
		"We'll perform scheduled maintenance. Some platform features may be unavailable during this window."
	)
	const [audience, setAudience] = React.useState<"all" | "enp" | "client">("all")
	const [startsAt, setStartsAt] = React.useState(toLocalDefault(oneWeek))
	const [endsAt, setEndsAt] = React.useState(
		toLocalDefault(new Date(oneWeek.getTime() + 60 * 60000))
	)

	const onSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		const input: CreateMaintenanceWindowInput = {
			title,
			message,
			audience,
			startsAt: toIsoFromLocal(startsAt),
			endsAt: toIsoFromLocal(endsAt),
		}
		void create
			.mutateAsync(input)
			.then(() => {
				toast.success("Maintenance notice scheduled")
			})
			.catch((err: unknown) => {
				const text = err instanceof Error ? err.message : "Could not schedule maintenance"
				toast.error(text)
			})
	}

	return (
		<div className="space-y-6">
			<MaintenanceKillSwitch />

			<Card>
				<CardHeader>
					<CardTitle>Schedule Maintenance Notice</CardTitle>
					<CardDescription>
						Create an upcoming maintenance window. Users will see this notice on their dashboard.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form className="space-y-4" onSubmit={onSubmit}>
						<div className="space-y-2">
							<Label htmlFor="maintenance-title">Title</Label>
							<Input
								id="maintenance-title"
								value={title}
								onChange={e => setTitle(e.target.value)}
								maxLength={120}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="maintenance-message">Message</Label>
							<Textarea
								id="maintenance-message"
								value={message}
								onChange={e => setMessage(e.target.value)}
								maxLength={2000}
								rows={3}
								required
							/>
						</div>
						<div className="grid gap-4 sm:grid-cols-3">
							<div className="space-y-2">
								<Label htmlFor="maintenance-audience">Audience</Label>
								<select
									id="maintenance-audience"
									value={audience}
									onChange={e => setAudience(e.target.value as "all" | "enp" | "client")}
									className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
								>
									<option value="all">All users (ENP + Client)</option>
									<option value="enp">ENP only</option>
									<option value="client">Client only</option>
								</select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="maintenance-starts">Starts</Label>
								<Input
									id="maintenance-starts"
									type="datetime-local"
									value={startsAt}
									onChange={e => setStartsAt(e.target.value)}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="maintenance-ends">Ends</Label>
								<Input
									id="maintenance-ends"
									type="datetime-local"
									value={endsAt}
									onChange={e => setEndsAt(e.target.value)}
									required
								/>
							</div>
						</div>
						<Button type="submit" disabled={create.isPending}>
							{create.isPending ? "Scheduling..." : "Schedule maintenance"}
						</Button>
					</form>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Upcoming Maintenance Windows</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{maintenanceQ.isPending ? <p className="text-sm">Loading...</p> : null}
					{(maintenanceQ.data as MaintenanceWindow[] | undefined)?.length ? (
						(maintenanceQ.data as MaintenanceWindow[]).map(item => (
							<MaintenanceWindowRow key={item.id} item={item} />
						))
					) : (
						<p className="text-muted-foreground text-sm">No upcoming maintenance scheduled.</p>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
