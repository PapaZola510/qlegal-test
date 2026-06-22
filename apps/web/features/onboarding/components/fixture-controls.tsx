"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Label } from "@/core/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/core/components/ui/select"
import { Separator } from "@/core/components/ui/separator"
import {
	getMockScenarioHeader,
	MOCK_SCENARIO_OPTIONS,
	setMockScenarioHeader,
} from "@/core/lib/mock-scenario-header"

import {
	resetOnboardingState,
	type ExamStatus,
	type IdentityVerificationStatus,
	type OnboardingState,
	type UserRole,
} from "../lib/fixtures"

interface FixtureControlsProps {
	state: OnboardingState
	onUpdate: (patch: Partial<OnboardingState>) => void
}

export function FixtureControls({ state, onUpdate }: FixtureControlsProps) {
	const queryClient = useQueryClient()
	const [mockScenario, setMockScenario] = React.useState("")

	React.useEffect(() => {
		const h = getMockScenarioHeader()
		setMockScenario(typeof h === "string" ? h : "")
	}, [])

	return (
		<Card className="border-dashed border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10">
			<CardHeader className="pb-2">
				<CardTitle className="flex items-center gap-2 text-sm">
					<Badge
						variant="outline"
						className="border-amber-500/40 text-amber-700 dark:text-amber-400"
					>
						Fixture
					</Badge>
					State Controls
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-wrap items-end gap-4">
					<div className="space-y-1.5">
						<Label className="text-xs">Role</Label>
						<Select
							value={state.role}
							onValueChange={v => onUpdate({ role: v as UserRole, currentStep: 0 })}
						>
							<SelectTrigger className="w-28">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="enp">ENP</SelectItem>
								<SelectItem value="client">Client</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{state.role === "enp" && (
						<>
							<Separator orientation="vertical" className="h-8" />
							<div className="space-y-1.5">
								<Label className="text-xs">Identity</Label>
								<Select
									value={state.identityStatus}
									onValueChange={v => onUpdate({ identityStatus: v as IdentityVerificationStatus })}
								>
									<SelectTrigger className="w-32">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="pending">Pending</SelectItem>
										<SelectItem value="verified">Verified</SelectItem>
										<SelectItem value="failed">Failed</SelectItem>
										<SelectItem value="needs_review">Needs Review</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-1.5">
								<Label className="text-xs">Exam</Label>
								<Select
									value={state.examStatus}
									onValueChange={v => onUpdate({ examStatus: v as ExamStatus })}
								>
									<SelectTrigger className="w-36">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="not_started">Not Started</SelectItem>
										<SelectItem value="in_progress">In Progress</SelectItem>
										<SelectItem value="passed">Passed</SelectItem>
										<SelectItem value="failed">Failed</SelectItem>
										<SelectItem value="retake_blocked">Retake Blocked</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</>
					)}

					<Separator orientation="vertical" className="h-8" />

					<div className="space-y-1.5">
						<Label className="text-xs">API mock (`X-Mock-Scenario`)</Label>
						<Select
							value={mockScenario || "__none__"}
							onValueChange={v => {
								const next: string = v === "__none__" || !v ? "" : v
								setMockScenario(next)
								setMockScenarioHeader(next.length > 0 ? next : null)
								void queryClient.invalidateQueries()
							}}
						>
							<SelectTrigger className="w-52">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__none__">None</SelectItem>
								{MOCK_SCENARIO_OPTIONS.filter(o => o.value.length > 0).map(o => (
									<SelectItem key={o.value} value={o.value}>
										{o.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<Separator orientation="vertical" className="h-8" />

					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							resetOnboardingState()
							onUpdate({
								role: "enp",
								currentStep: 0,
								identityStatus: "pending",
								examStatus: "not_started",
								profileComplete: false,
							})
						}}
					>
						Reset
					</Button>
				</div>
			</CardContent>
		</Card>
	)
}
