"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import {
	FIXTURE_IDENTITY_AUDIT,
	FIXTURE_SC_SYNC_EVENTS,
	getAdminUserKpis,
	getPaymentKpis,
} from "@/features/admin/lib/fixtures"

export function AdminOverviewContent() {
	const userKpis = getAdminUserKpis()
	const paymentKpis = getPaymentKpis()
	const syncFailed = FIXTURE_SC_SYNC_EVENTS.filter(e => e.status === "failed").length
	const pendingVerifications = FIXTURE_IDENTITY_AUDIT.filter(e => e.result === "pending").length

	return (
		<div className="space-y-6">
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<KpiCard
					title="Total Users"
					value={userKpis.total}
					subtitle={`${userKpis.active} active`}
				/>
				<KpiCard
					title="Revenue (PHP)"
					value={paymentKpis.paid.toLocaleString()}
					subtitle={`${paymentKpis.pending.toLocaleString()} pending`}
				/>
				<KpiCard title="Failed Syncs" value={syncFailed} subtitle="Requires attention" />
				<KpiCard
					title="Pending Verifications"
					value={pendingVerifications}
					subtitle="Identity audit"
				/>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Quick Actions</CardTitle>
					</CardHeader>
					<CardContent className="text-muted-foreground text-sm">
						<ul className="list-inside list-disc space-y-1">
							<li>Review pending identity verifications</li>
							<li>Retry failed SC sync entries</li>
							<li>Approve pending payments</li>
							<li>Review suspended user accounts</li>
						</ul>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>System Health</CardTitle>
					</CardHeader>
					<CardContent className="text-muted-foreground text-sm">
						<ul className="space-y-2">
							<li className="flex items-center justify-between">
								<span>Backend API</span>
								<span className="font-medium text-emerald-600">Healthy</span>
							</li>
							<li className="flex items-center justify-between">
								<span>SC Sync Service</span>
								<span className="font-medium text-yellow-600">Degraded</span>
							</li>
							<li className="flex items-center justify-between">
								<span>Document Vault</span>
								<span className="font-medium text-emerald-600">Healthy</span>
							</li>
							<li className="flex items-center justify-between">
								<span>Database</span>
								<span className="font-medium text-emerald-600">Healthy</span>
							</li>
						</ul>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}

function KpiCard({
	title,
	value,
	subtitle,
}: {
	title: string
	value: string | number
	subtitle: string
}) {
	return (
		<Card>
			<CardContent className="pt-6">
				<p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
					{title}
				</p>
				<p className="mt-1 text-2xl font-bold">{value}</p>
				<p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p>
			</CardContent>
		</Card>
	)
}
