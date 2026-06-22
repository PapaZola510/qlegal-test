"use client"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Spinner } from "@/core/components/ui/spinner"

interface StepPlotFieldsProps {
	projectRef: string
	plotterOpened: boolean
	isOpeningPlotter: boolean
	isConfirmingPlot: boolean
	error: string | null
	onOpenPlotter: () => void
	onManualConfirm: () => void
}

export function StepPlotFields({
	projectRef,
	plotterOpened,
	isOpeningPlotter,
	isConfirmingPlot,
	error,
	onOpenPlotter,
	onManualConfirm,
}: StepPlotFieldsProps) {
	const plotBusy = isOpeningPlotter || isConfirmingPlot

	return (
		<Card className="mx-auto max-w-lg">
			<CardHeader>
				<CardTitle>Plot Signature Fields</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-muted-foreground text-sm leading-relaxed">
					For project <span className="text-foreground font-medium">{projectRef}</span>, place
					signature and date fields on the PDF. Open the plotter below, then close that window when
					you are done and confirm plotting is complete—the same flow as during a live session.
				</p>

				<div className="flex flex-col gap-3">
					<Button
						variant={plotterOpened ? "secondary" : "default"}
						onClick={onOpenPlotter}
						disabled={plotBusy}
					>
						{isOpeningPlotter && <Spinner className="mr-2" />}
						{isOpeningPlotter
							? "Opening plotter…"
							: plotterOpened
								? "Re-open plotter"
								: "Plot signature"}
					</Button>

					{plotterOpened ? (
						<>
							<Badge variant="default" className="w-fit">
								Plotter opened — close the window when finished
							</Badge>
							<Button
								variant="default"
								onClick={onManualConfirm}
								disabled={plotBusy}
							>
								I&apos;ve finished plotting
							</Button>
						</>
					) : null}
				</div>

				{error ? (
					<div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
						<p>{error}</p>
					</div>
				) : null}
			</CardContent>
		</Card>
	)
}
