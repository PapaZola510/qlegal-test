"use client"

import * as React from "react"

import type { AccessLogEntry } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Spinner } from "@/core/components/ui/spinner"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/core/components/ui/table"
import {
	useMyAccessLogQuery,
	useVerifyChainQuery,
} from "@/features/compliance-audit/api/compliance-audit.hooks"

function shortHash(hash: string | null): string {
	if (!hash) return "-"
	return hash.length > 18 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash
}

const MIN_VERIFY_SPINNER_MS = 2000

function delay(ms: number) {
	return new Promise(resolve => window.setTimeout(resolve, ms))
}

function formatAction(action: string): string {
	const labels: Record<string, string> = {
		list_query: "Listed records",
		view_commission: "Viewed commission",
		view_enb: "Viewed ENB",
		view_document: "Opened document",
		view_recording: "Opened recording",
		download_recording: "Downloaded recording",
		export: "Created export",
		verify_chain: "Verified trail",
	}
	return labels[action] ?? action.replaceAll("_", " ")
}

function formatTarget(row: AccessLogEntry): string {
	const labels: Record<string, string> = {
		enp_profile: "Commission records",
		enb: "Electronic notarial books",
		registry_act: "Notarized documents",
		file_object: "AV recordings",
		compliance_export: "Compliance export",
		compliance_access_log: "Audit trail",
	}
	const label = row.targetType
		? (labels[row.targetType] ?? row.targetType.replaceAll("_", " "))
		: "General"
	if (!row.targetId) return label
	return `${label} · ${row.targetId}`
}

export function AccessLogContent() {
	const [offset, setOffset] = React.useState(0)
	const [isVerifyCoolingDown, setIsVerifyCoolingDown] = React.useState(false)
	const limit = 50
	const log = useMyAccessLogQuery({ limit, offset })
	const verify = useVerifyChainQuery()
	const rows = log.data ?? []

	const handleVerify = React.useCallback(async () => {
		if (verify.isFetching || isVerifyCoolingDown) return
		setIsVerifyCoolingDown(true)
		try {
			await Promise.all([verify.refetch(), delay(MIN_VERIFY_SPINNER_MS)])
		} finally {
			setIsVerifyCoolingDown(false)
		}
	}, [isVerifyCoolingDown, verify])

	React.useEffect(() => {
		void handleVerify()
		// eslint-disable-next-line react-hooks/exhaustive-deps -- verify once on open
	}, [])

	const isVerifying = verify.isFetching || isVerifyCoolingDown

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Chain Integrity</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-wrap items-center justify-between gap-3">
					<div className="min-h-7 min-w-0">
						{verify.data?.intact === true && (
							<Badge variant="default">Trail intact ({verify.data.checkedRows} rows)</Badge>
						)}
						{verify.data?.intact === false && (
							<Badge variant="destructive">
								Integrity failed - first broken row {verify.data.firstBrokenRowId}
							</Badge>
						)}
						{!verify.data && (
							<p className="text-muted-foreground text-sm">No verification result yet.</p>
						)}
					</div>
					<Button
						variant="outline"
						className="min-w-28"
						disabled={isVerifying}
						onClick={() => void handleVerify()}
					>
						{isVerifying && <Spinner className="mr-1 size-4" />}
						Re-verify
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>My Access Log</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Occurred</TableHead>
								<TableHead>Action</TableHead>
								<TableHead>Target</TableHead>
								<TableHead>Row Hash</TableHead>
								<TableHead>Prev Hash</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{log.isPending && (
								<TableRow>
									<TableCell colSpan={5} className="text-muted-foreground text-center">
										Loading access log…
									</TableCell>
								</TableRow>
							)}
							{!log.isPending &&
								rows.map(row => (
									<TableRow key={row.id}>
										<TableCell className="text-sm">
											{new Date(row.occurredAt).toISOString()}
										</TableCell>
										<TableCell>
											<Badge variant="secondary">{formatAction(row.action)}</Badge>
										</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{formatTarget(row)}
										</TableCell>
										<TableCell className="font-mono text-xs">{shortHash(row.rowHash)}</TableCell>
										<TableCell className="font-mono text-xs">{shortHash(row.prevHash)}</TableCell>
									</TableRow>
								))}
							{!log.isPending && !log.isError && rows.length === 0 && (
								<TableRow>
									<TableCell colSpan={5} className="text-muted-foreground text-center">
										No access-log entries yet.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
					<div className="flex justify-end gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={offset === 0 || log.isPending}
							onClick={() => setOffset(Math.max(0, offset - limit))}
						>
							Previous
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={rows.length < limit || log.isPending}
							onClick={() => setOffset(offset + limit)}
						>
							Next
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
