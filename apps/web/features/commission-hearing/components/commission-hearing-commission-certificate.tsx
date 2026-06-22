"use client"

import { PrinterIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { EnpCommission } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"

function formatDate(value: string): string {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value
	return new Intl.DateTimeFormat("en-PH", {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: "Asia/Manila",
	}).format(date)
}

export function CommissionHearingCommissionCertificate({
	commission,
}: {
	commission: EnpCommission
}) {
	return (
		<Card className="print:border-none print:shadow-none">
			<CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<CardTitle className="text-base">Electronic notarial commission</CardTitle>
					<p className="text-muted-foreground text-sm">{commission.amNumber}</p>
				</div>
				<Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
					<HugeiconsIcon icon={PrinterIcon} className="size-4" />
					Print
				</Button>
			</CardHeader>
			<CardContent>
				<div className="bg-background mx-auto max-w-3xl rounded-md border px-6 py-8 text-center print:border-none">
					<p className="text-xs font-semibold tracking-[0.18em] uppercase">
						Republic of the Philippines
					</p>
					<p className="mt-1 text-sm font-semibold tracking-[0.14em] uppercase">Supreme Court</p>
					<p className="mt-1 text-xs font-medium tracking-[0.12em] uppercase">
						Electronic Notary Administrator
					</p>

					<div className="bg-border my-8 h-px" />

					<p className="text-muted-foreground text-xs font-semibold tracking-[0.18em] uppercase">
						Certificate of Commission
					</p>
					<p className="mt-6 text-left text-base leading-8">
						This is to certify that{" "}
						<span className="font-semibold">{commission.commissionedName}</span> of{" "}
						<span className="font-semibold">{commission.placeOfWork}</span> is on{" "}
						<span className="font-semibold">{formatDate(commission.commissionDate)}</span>{" "}
						commissioned by the undersigned as an Electronic Notary Public authorized to execute
						electronic notarial acts in accordance with {commission.amNumber} or the &quot;Rules on
						Electronic Notarization&quot; for a term ending on{" "}
						<span className="font-semibold">{formatDate(commission.termEndDate)}</span>.
					</p>

					<div className="mt-12 text-right">
						<p className="text-sm font-semibold">Electronic Notary Administrator</p>
						<p className="text-muted-foreground text-xs">
							Issued {formatDate(commission.createdAt)}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
