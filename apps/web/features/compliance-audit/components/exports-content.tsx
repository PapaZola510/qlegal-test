"use client"

import * as React from "react"

import type { ComplianceExportResult } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/core/components/ui/select"
import { useCreateExportMutation } from "@/features/compliance-audit/api/compliance-audit.hooks"

type Dataset = "commission_records" | "enb" | "notarized_documents" | "av_recordings"
type Format = "csv" | "json"

function HashLine({ label, value }: { label: string; value: string | null }) {
	if (!value) return null
	return (
		<div className="space-y-1">
			<p className="text-muted-foreground text-xs">{label}</p>
			<code className="bg-muted block overflow-x-auto rounded-md p-2 text-xs">{value}</code>
		</div>
	)
}

export function ExportsContent() {
	const createExport = useCreateExportMutation()
	const [dataset, setDataset] = React.useState<Dataset>("commission_records")
	const [format, setFormat] = React.useState<Format>("csv")
	const [enpUserId, setEnpUserId] = React.useState("")
	const [from, setFrom] = React.useState("")
	const [to, setTo] = React.useState("")
	const [result, setResult] = React.useState<ComplianceExportResult | null>(null)

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const exportResult = await createExport.mutateAsync({
			dataset,
			format,
			filter: {
				enpUserId: enpUserId.trim() || undefined,
				dateRange: from || to ? { from: from || undefined, to: to || undefined } : undefined,
			},
		})
		setResult(exportResult)
	}

	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
			<Card>
				<CardHeader>
					<CardTitle>Create Export</CardTitle>
				</CardHeader>
				<CardContent>
					<form className="space-y-4" onSubmit={handleSubmit}>
						<Select value={dataset} onValueChange={value => setDataset(value as Dataset)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="commission_records">Commission records</SelectItem>
								<SelectItem value="enb">ENBs</SelectItem>
								<SelectItem value="notarized_documents">Notarized documents</SelectItem>
								<SelectItem value="av_recordings">AV recordings</SelectItem>
							</SelectContent>
						</Select>
						<Select value={format} onValueChange={value => setFormat(value as Format)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="csv">CSV</SelectItem>
								<SelectItem value="json">JSON</SelectItem>
							</SelectContent>
						</Select>
						<Input
							placeholder="ENP user ID"
							aria-label="Filter by ENP user ID"
							value={enpUserId}
							onChange={e => setEnpUserId(e.target.value)}
						/>
						<div className="grid gap-3 sm:grid-cols-2">
							<Input
								type="date"
								value={from}
								onChange={e => setFrom(e.target.value)}
								aria-label="From date"
							/>
							<Input
								type="date"
								value={to}
								onChange={e => setTo(e.target.value)}
								aria-label="To date"
							/>
						</div>
						<Button type="submit" disabled={createExport.isPending}>
							{createExport.isPending ? "Creating…" : "Create export"}
						</Button>
					</form>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Export Result</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-muted-foreground text-sm">
						Each export is hashed, bound to the current audit-trail head, and signed when the server
						signing key is configured.
					</p>
					{createExport.isError && (
						<p className="text-destructive text-sm">
							{createExport.error instanceof Error ? createExport.error.message : "Export failed"}
						</p>
					)}
					{result ? (
						<div className="space-y-3">
							<p className="text-sm">Rows: {result.rowCount}</p>
							<HashLine label="SHA-256" value={result.exportSha256} />
							<HashLine label="Chain head" value={result.chainHeadHash} />
							<HashLine label="Manifest signature" value={result.manifestSignature} />
							<p className="text-muted-foreground text-sm">
								Signature: {result.manifestSignature ? "present" : "not configured"}
							</p>
							{result.downloadUrl && (
								<Button
									variant="outline"
									nativeButton={false}
									render={<a href={result.downloadUrl} download={`compliance-export.${format}`} />}
								>
									Download
								</Button>
							)}
						</div>
					) : (
						<p className="text-muted-foreground text-sm">No export created yet.</p>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
