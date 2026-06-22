"use client"

import { Alert, AlertDescription, AlertTitle } from "@/core/components/ui/alert"
import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Separator } from "@/core/components/ui/separator"

import type { ExamStatus } from "../lib/fixtures"

interface ExamStepProps {
	status: ExamStatus
	onStartExam: () => void
	onContinue: () => void
}

export function ExamStep({ status, onStartExam, onContinue }: ExamStepProps) {
	if (status === "passed") {
		return (
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							Certification Exam
							<Badge>Passed</Badge>
						</CardTitle>
					</CardHeader>
					<CardContent>
						<Alert>
							<AlertTitle>Exam passed</AlertTitle>
							<AlertDescription>
								You have successfully passed the ENP certification exam. Proceed to claim your
								certificate.
							</AlertDescription>
						</Alert>
					</CardContent>
				</Card>
				<div className="flex justify-end">
					<Button onClick={onContinue}>Continue to Certification</Button>
				</div>
			</div>
		)
	}

	if (status === "failed") {
		return (
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							Certification Exam
							<Badge variant="destructive">Failed</Badge>
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<Alert variant="destructive">
							<AlertTitle>Exam not passed</AlertTitle>
							<AlertDescription>
								You did not meet the passing score. You may retake the exam after reviewing the
								study materials.
							</AlertDescription>
						</Alert>
						<Button onClick={onStartExam}>Retake Exam</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	if (status === "retake_blocked") {
		return (
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							Certification Exam
							<Badge variant="destructive">Retake Blocked</Badge>
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<Alert variant="destructive">
							<AlertTitle>Payment required</AlertTitle>
							<AlertDescription>
								You have exhausted your free exam attempts. Please complete the retake payment to
								schedule another attempt.
							</AlertDescription>
						</Alert>
						<Button variant="outline" disabled>
							Pay for Retake (Fixture)
						</Button>
					</CardContent>
				</Card>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Certification Exam</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-muted-foreground text-sm">
						Complete the ENP certification exam to become a certified Electronic Notary Public. The
						exam consists of 5 sections with 10 questions each (50 questions total).
					</p>

					<div className="bg-muted/30 grid gap-3 rounded-lg border p-4 text-sm">
						<div className="flex justify-between">
							<span className="text-muted-foreground">Duration</span>
							<span className="font-medium">60 minutes</span>
						</div>
						<Separator />
						<div className="flex justify-between">
							<span className="text-muted-foreground">Total Questions</span>
							<span className="font-medium">50</span>
						</div>
						<Separator />
						<div className="flex justify-between">
							<span className="text-muted-foreground">Sections</span>
							<span className="font-medium">5</span>
						</div>
						<Separator />
						<div className="flex justify-between">
							<span className="text-muted-foreground">Passing Score</span>
							<span className="font-medium">70%</span>
						</div>
					</div>
				</CardContent>
			</Card>

			<div className="flex justify-end">
				<Button onClick={onStartExam}>
					{status === "in_progress" ? "Resume Exam" : "Begin Exam"}
				</Button>
			</div>
		</div>
	)
}
