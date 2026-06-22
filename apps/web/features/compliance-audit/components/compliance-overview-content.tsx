"use client"

import * as React from "react"
import Link from "next/link"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Spinner } from "@/core/components/ui/spinner"
import { useVerifyChainQuery } from "@/features/compliance-audit/api/compliance-audit.hooks"

const datasetLinks = [
	{
		title: "Commission records",
		href: "/compliance/commission-records",
		detail: "ENP notarial credentials",
	},
	{
		title: "Electronic notarial books",
		href: "/compliance/enbs",
		detail: "Inspect entries and request virtual copies through the ENF",
	},
	{
		title: "Notarized documents",
		href: "/compliance/documents",
		detail: "Registry act document index",
	},
	{
		title: "AV recordings",
		href: "/compliance/recordings",
		detail: "Session recordings with hashes",
	},
	{ title: "Exports", href: "/compliance/exports", detail: "CSV/JSON with signed manifests" },
	{ title: "Access log", href: "/compliance/access-log", detail: "Your tamper-evident trail" },
] as const
const MIN_VERIFY_SPINNER_MS = 2000

function delay(ms: number) {
	return new Promise(resolve => window.setTimeout(resolve, ms))
}

export function ComplianceOverviewContent() {
	const verify = useVerifyChainQuery()
	const [isVerifyCoolingDown, setIsVerifyCoolingDown] = React.useState(false)

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
		// eslint-disable-next-line react-hooks/exhaustive-deps -- run once when dashboard opens
	}, [])

	const result = verify.data
	const isVerifying = verify.isFetching || isVerifyCoolingDown

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Audit Trail Integrity</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-wrap items-center justify-between gap-3">
					<div className="min-w-0 space-y-1">
						<div className="min-h-7">
							{result?.intact === true && (
								<Badge variant="default">Trail intact ({result.checkedRows} rows)</Badge>
							)}
							{result?.intact === false && (
								<Badge variant="destructive">
									Trail integrity failed - broken at {result.firstBrokenRowId}
								</Badge>
							)}
							{!result && (
								<p className="text-muted-foreground text-sm">No verification result yet.</p>
							)}
						</div>
					</div>
					<Button
						variant="outline"
						className="min-w-24"
						onClick={() => void handleVerify()}
						disabled={isVerifying}
					>
						{isVerifying && <Spinner className="mr-1 size-4" />}
						Verify
					</Button>
				</CardContent>
			</Card>

			<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				{datasetLinks.map(item => (
					<Card key={item.href}>
						<CardHeader>
							<CardTitle className="text-base">{item.title}</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-muted-foreground text-sm">{item.detail}</p>
							<Button
								variant="outline"
								size="sm"
								nativeButton={false}
								render={<Link href={item.href} />}
							>
								Open
							</Button>
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	)
}
