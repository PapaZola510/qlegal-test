"use client"

import * as React from "react"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { Progress } from "@/core/components/ui/progress"
import { Separator } from "@/core/components/ui/separator"
import { Skeleton } from "@/core/components/ui/skeleton"
import { cn } from "@/core/lib/utils"
import { FIXTURE_ANALYSIS } from "@/features/contract-ai/lib/fixtures"

type Phase = "idle" | "uploading" | "analyzing" | "done"

const SEVERITY_STYLES: Record<string, string> = {
	high: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
	medium:
		"border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
	low: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
}

export function UploadAnalyzePanel() {
	const [phase, setPhase] = React.useState<Phase>("idle")
	const [progress, setProgress] = React.useState(0)

	function simulateUpload() {
		setPhase("uploading")
		setProgress(0)
		const interval = setInterval(() => {
			setProgress(prev => {
				if (prev >= 100) {
					clearInterval(interval)
					setPhase("analyzing")
					setTimeout(() => setPhase("done"), 2000)
					return 100
				}
				return prev + 20
			})
		}, 300)
	}

	if (phase === "idle") {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Upload Document</CardTitle>
					<CardDescription>
						Upload a contract or legal document for AI-powered analysis.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
						<p className="text-muted-foreground mb-4 text-sm">
							Drag and drop a PDF, DOCX, or image file here
						</p>
						<Button onClick={simulateUpload}>Select File</Button>
					</div>
				</CardContent>
			</Card>
		)
	}

	if (phase === "uploading") {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Uploading…</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<p className="text-muted-foreground text-sm">Deed_of_Sale.pdf</p>
					<Progress value={progress} />
					<p className="text-muted-foreground text-xs">{progress}% complete</p>
				</CardContent>
			</Card>
		)
	}

	if (phase === "analyzing") {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Analyzing Document…</CardTitle>
					<CardDescription>
						Our AI is reviewing the contract for risks and key terms.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-3/4" />
					<Skeleton className="h-4 w-5/6" />
					<Skeleton className="h-32 w-full" />
				</CardContent>
			</Card>
		)
	}

	const { summary, risks, keyTerms } = FIXTURE_ANALYSIS

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Summary</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground text-sm leading-relaxed">{summary}</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Risks Identified</CardTitle>
					<CardDescription>{risks.length} potential issues found</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{risks.map(risk => (
						<div
							key={risk.id}
							className={cn("rounded-lg border p-4", SEVERITY_STYLES[risk.severity])}
						>
							<div className="mb-1 flex items-center gap-2">
								<Badge
									variant={risk.severity === "high" ? "destructive" : "secondary"}
									className="text-xs uppercase"
								>
									{risk.severity}
								</Badge>
								<span className="text-sm font-medium">{risk.title}</span>
							</div>
							<p className="text-sm">{risk.description}</p>
							<p className="mt-1 text-xs opacity-70">Clause: {risk.clause}</p>
						</div>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Key Terms</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						{keyTerms.map((kt, i) => (
							<React.Fragment key={kt.id}>
								{i > 0 && <Separator />}
								<div className="flex items-center justify-between py-1">
									<div>
										<p className="text-sm font-medium">{kt.term}</p>
										<p className="text-muted-foreground text-xs">{kt.section}</p>
									</div>
									<p className="text-sm">{kt.value}</p>
								</div>
							</React.Fragment>
						))}
					</div>
				</CardContent>
			</Card>

			<div className="flex gap-2">
				<Button variant="outline" onClick={() => setPhase("idle")}>
					Upload Another
				</Button>
			</div>
		</div>
	)
}
