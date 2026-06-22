"use client"

import { Badge } from "@/core/components/ui/badge"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { FIXTURE_POST_NOTARIZATION } from "@/features/contract-ai/lib/fixtures"

export function PostNotarizationPanel() {
	const data = FIXTURE_POST_NOTARIZATION

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<CardTitle>Post-Notarization Summary</CardTitle>
						<Badge variant="secondary">Completed</Badge>
					</div>
					<CardDescription>
						AI-generated summary of the notarized document and key obligations.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<DetailRow label="Document" value={data.documentTitle} />
						<DetailRow label="Type" value={data.notarizationType} />
						<DetailRow label="Notary" value={data.notaryName} />
						<DetailRow label="Date Notarized" value={data.dateNotarized} />
						<DetailRow label="Registry No." value={data.registryNo} />
						<DetailRow label="Parties" value={data.parties.join(", ")} />
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>AI Summary</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm leading-relaxed">{data.aiSummary}</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Key Obligations</CardTitle>
					<CardDescription>
						The following obligations were identified from the notarized document.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ul className="space-y-2">
						{data.keyObligations.map((obligation, i) => (
							<li key={i} className="flex items-start gap-2 text-sm">
								<span className="bg-primary text-primary-foreground mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium">
									{i + 1}
								</span>
								<span className="text-muted-foreground">{obligation}</span>
							</li>
						))}
					</ul>
				</CardContent>
			</Card>
		</div>
	)
}

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="text-sm font-medium">{value}</p>
		</div>
	)
}
