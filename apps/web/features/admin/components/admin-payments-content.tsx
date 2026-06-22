"use client"

import * as React from "react"

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/core/components/ui/alert-dialog"
import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/core/components/ui/table"
import { FIXTURE_PAYMENTS, getPaymentKpis, type PaymentRecord } from "@/features/admin/lib/fixtures"

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive"> = {
	paid: "default",
	pending: "secondary",
	failed: "destructive",
	refunded: "secondary",
}

export function AdminPaymentsContent() {
	const kpis = getPaymentKpis()
	const [markPaidTarget, setMarkPaidTarget] = React.useState<PaymentRecord | null>(null)

	return (
		<div className="space-y-6">
			<div className="grid gap-4 sm:grid-cols-3">
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-xs font-medium uppercase">Total Revenue</p>
						<p className="text-2xl font-bold">PHP {kpis.total.toLocaleString()}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-xs font-medium uppercase">Collected</p>
						<p className="text-2xl font-bold text-emerald-600">PHP {kpis.paid.toLocaleString()}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<p className="text-muted-foreground text-xs font-medium uppercase">Pending</p>
						<p className="text-2xl font-bold text-yellow-600">
							PHP {kpis.pending.toLocaleString()}
						</p>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Payment Records</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>User</TableHead>
								<TableHead>Description</TableHead>
								<TableHead>Amount</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Paid At</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{FIXTURE_PAYMENTS.map(p => (
								<TableRow key={p.id}>
									<TableCell className="font-medium">{p.userName}</TableCell>
									<TableCell className="text-muted-foreground text-sm">{p.description}</TableCell>
									<TableCell className="text-sm">
										{p.currency} {p.amount.toLocaleString()}
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-1">
											<Badge variant={STATUS_BADGE[p.status]}>{p.status}</Badge>
											{p.markedPaidByAdmin && (
												<span className="text-muted-foreground text-[10px]">(admin)</span>
											)}
										</div>
									</TableCell>
									<TableCell className="text-muted-foreground text-sm">{p.paidAt ?? "—"}</TableCell>
									<TableCell className="text-right">
										{(p.status === "pending" || p.status === "failed") && (
											<Button variant="outline" size="sm" onClick={() => setMarkPaidTarget(p)}>
												Mark Paid
											</Button>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<AlertDialog open={!!markPaidTarget} onOpenChange={open => !open && setMarkPaidTarget(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Confirm Admin Override</AlertDialogTitle>
						<AlertDialogDescription>
							You are about to manually mark the following payment as paid:
							<br />
							<br />
							<strong>{markPaidTarget?.description}</strong> — {markPaidTarget?.currency}{" "}
							{markPaidTarget?.amount.toLocaleString()} by {markPaidTarget?.userName}
							<br />
							<br />
							This will override the payment gateway status. Are you sure?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={() => setMarkPaidTarget(null)}>
							Confirm Mark Paid
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
