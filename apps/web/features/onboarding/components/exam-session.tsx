"use client"

import * as React from "react"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { Label } from "@/core/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/core/components/ui/radio-group"
import { Separator } from "@/core/components/ui/separator"
import { cn } from "@/core/lib/utils"

import {
	computeMockResult,
	EXAM_SECTIONS,
	EXAM_TIME_LIMIT_MINUTES,
	EXAM_WARNING_MINUTES,
	type ExamResult,
} from "../lib/exam-fixtures"

type ExamPhase = "briefing" | "active" | "section-transition" | "result" | "certificate"

interface ExamSessionProps {
	onFinish: (passed: boolean) => void
	onCancel: () => void
}

export function ExamSession({ onFinish, onCancel }: ExamSessionProps) {
	const [phase, setPhase] = React.useState<ExamPhase>("briefing")
	const [sectionIndex, setSectionIndex] = React.useState(0)
	const [questionIndex, setQuestionIndex] = React.useState(0)
	const [answers, setAnswers] = React.useState<Record<number, number>>({})
	const [secondsLeft, setSecondsLeft] = React.useState(EXAM_TIME_LIMIT_MINUTES * 60)
	const [result, setResult] = React.useState<ExamResult | null>(null)
	const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

	React.useEffect(() => {
		if (phase === "active") {
			timerRef.current = setInterval(() => {
				setSecondsLeft(prev => {
					if (prev <= 1) {
						clearInterval(timerRef.current!)
						handleFinishExam()
						return 0
					}
					return prev - 1
				})
			}, 1000)
		}
		return () => {
			if (timerRef.current) clearInterval(timerRef.current)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [phase])

	const minutes = Math.floor(secondsLeft / 60)
	const seconds = secondsLeft % 60
	const isWarning = secondsLeft <= EXAM_WARNING_MINUTES * 60 && secondsLeft > 0
	const section = EXAM_SECTIONS[sectionIndex]!
	const question = section.questions[questionIndex]!

	const answeredInSection = section.questions.filter(q => answers[q.id] !== undefined).length
	const totalAnswered = Object.keys(answers).length

	function handleFinishExam() {
		if (timerRef.current) clearInterval(timerRef.current)
		const mockResult = computeMockResult(totalAnswered >= 25)
		setResult(mockResult)
		setPhase("result")
	}

	function handleNextQuestion() {
		if (questionIndex < section.questions.length - 1) {
			setQuestionIndex(i => i + 1)
		}
	}

	function handlePrevQuestion() {
		if (questionIndex > 0) {
			setQuestionIndex(i => i - 1)
		}
	}

	function handleSubmitSection() {
		if (sectionIndex < EXAM_SECTIONS.length - 1) {
			setPhase("section-transition")
		} else {
			handleFinishExam()
		}
	}

	function handleNextSection() {
		setSectionIndex(i => i + 1)
		setQuestionIndex(0)
		setPhase("active")
	}

	if (phase === "briefing") {
		return <ExamBriefing onStart={() => setPhase("active")} onCancel={onCancel} />
	}

	if (phase === "section-transition") {
		return (
			<SectionTransition
				completedSection={section.title}
				nextSection={EXAM_SECTIONS[sectionIndex + 1]?.title ?? ""}
				sectionNumber={sectionIndex + 1}
				totalSections={EXAM_SECTIONS.length}
				onContinue={handleNextSection}
			/>
		)
	}

	if (phase === "result" && result) {
		return (
			<ExamResultScreen
				result={result}
				onCertificate={() => setPhase("certificate")}
				onRetake={() => onFinish(false)}
			/>
		)
	}

	if (phase === "certificate") {
		return <CertificateConfirmation onDone={() => onFinish(true)} />
	}

	return (
		<div className="space-y-4">
			{/* Sticky timer header */}
			<div
				className={cn(
					"bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-10 flex items-center justify-between rounded-lg border px-4 py-2.5 backdrop-blur",
					isWarning && "border-red-500/50 bg-red-50/80 dark:bg-red-950/20"
				)}
			>
				<div className="flex items-center gap-3">
					<Badge variant="outline" className="font-mono">
						Section {sectionIndex + 1}/{EXAM_SECTIONS.length}
					</Badge>
					<span className="text-muted-foreground text-sm">{section.title}</span>
				</div>
				<div className="flex items-center gap-3">
					{/* Progress dots */}
					<div className="hidden items-center gap-1 sm:flex">
						{section.questions.map((q, i) => (
							<button
								key={q.id}
								type="button"
								onClick={() => setQuestionIndex(i)}
								className={cn(
									"size-2 rounded-full transition-colors",
									answers[q.id] !== undefined
										? "bg-primary"
										: i === questionIndex
											? "bg-foreground"
											: "bg-muted-foreground/30"
								)}
								aria-label={`Go to question ${i + 1}`}
							/>
						))}
					</div>
					<Separator orientation="vertical" className="hidden h-5 sm:block" />
					<span
						className={cn(
							"font-mono text-sm font-semibold tabular-nums",
							isWarning && "text-red-600 dark:text-red-400"
						)}
					>
						{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
					</span>
					{isWarning && (
						<Badge variant="destructive" className="animate-pulse">
							Low time
						</Badge>
					)}
				</div>
			</div>

			{/* Question card */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">
						Question {questionIndex + 1} of {section.questions.length}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm leading-relaxed">{question.text}</p>
					<RadioGroup
						value={answers[question.id]?.toString() ?? ""}
						onValueChange={v => setAnswers(prev => ({ ...prev, [question.id]: Number(v) }))}
					>
						{question.options.map((opt, oi) => (
							<div key={oi} className="flex items-center gap-3">
								<RadioGroupItem value={oi.toString()} id={`q${question.id}-o${oi}`} />
								<Label
									htmlFor={`q${question.id}-o${oi}`}
									className="flex-1 cursor-pointer text-sm font-normal"
								>
									{opt}
								</Label>
							</div>
						))}
					</RadioGroup>
				</CardContent>
			</Card>

			{/* Navigation */}
			<div className="flex items-center justify-between">
				<Button
					variant="outline"
					size="sm"
					disabled={questionIndex === 0}
					onClick={handlePrevQuestion}
				>
					Previous
				</Button>

				<span className="text-muted-foreground text-xs">
					{answeredInSection}/{section.questions.length} answered
				</span>

				{questionIndex === section.questions.length - 1 ? (
					<Button
						size="sm"
						onClick={handleSubmitSection}
						disabled={answeredInSection < section.questions.length}
					>
						{sectionIndex === EXAM_SECTIONS.length - 1 ? "Finish Exam" : "Submit Section"}
					</Button>
				) : (
					<Button size="sm" onClick={handleNextQuestion}>
						Next
					</Button>
				)}
			</div>
		</div>
	)
}

function ExamBriefing({ onStart, onCancel }: { onStart: () => void; onCancel: () => void }) {
	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Pre-Exam Briefing</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-3 text-sm">
						<p>
							Welcome to the <strong>ENP Certification Exam</strong>. Please read the following
							instructions carefully before you begin:
						</p>
						<ul className="text-muted-foreground list-disc space-y-1.5 pl-5">
							<li>
								The exam consists of <strong>5 sections</strong> with{" "}
								<strong>10 questions each</strong> (50 total).
							</li>
							<li>
								You have <strong>60 minutes</strong> to complete all sections.
							</li>
							<li>
								A <strong>5-minute warning</strong> will appear when time is running low.
							</li>
							<li>
								You must answer <strong>all questions in a section</strong> before submitting it.
							</li>
							<li>
								Once a section is submitted, you <strong>cannot go back</strong> to change answers.
							</li>
							<li>
								The passing score is <strong>70%</strong> (35 out of 50).
							</li>
						</ul>
						<Separator />
						<p className="text-muted-foreground text-xs">
							Ensure you have a stable internet connection. If the timer expires, the exam will be
							automatically submitted with your current answers.
						</p>
					</div>
				</CardContent>
			</Card>

			<div className="flex justify-end gap-2">
				<Button variant="outline" onClick={onCancel}>
					Cancel
				</Button>
				<Button onClick={onStart}>Start Exam</Button>
			</div>
		</div>
	)
}

function SectionTransition({
	completedSection,
	nextSection,
	sectionNumber,
	totalSections,
	onContinue,
}: {
	completedSection: string
	nextSection: string
	sectionNumber: number
	totalSections: number
	onContinue: () => void
}) {
	return (
		<div className="mx-auto max-w-lg space-y-6 py-8 text-center">
			<div className="space-y-2">
				<div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
					<svg
						className="size-6 text-green-600 dark:text-green-400"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth={2}
						stroke="currentColor"
					>
						<path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
					</svg>
				</div>
				<h2 className="text-lg font-semibold">Section Complete</h2>
				<p className="text-muted-foreground text-sm">
					You have completed &ldquo;{completedSection}&rdquo; ({sectionNumber} of {totalSections}).
				</p>
			</div>

			<Card>
				<CardContent className="pt-4">
					<p className="text-sm">
						Up next: <strong>{nextSection}</strong>
					</p>
					<p className="text-muted-foreground mt-1 text-xs">
						Take a moment to breathe. When you&apos;re ready, click continue.
					</p>
				</CardContent>
			</Card>

			<Button onClick={onContinue}>Continue to Next Section</Button>
		</div>
	)
}

function ExamResultScreen({
	result,
	onCertificate,
	onRetake,
}: {
	result: ExamResult
	onCertificate: () => void
	onRetake: () => void
}) {
	return (
		<div className="mx-auto max-w-lg space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						Exam Results
						<Badge variant={result.passed ? "default" : "destructive"}>
							{result.passed ? "Passed" : "Failed"}
						</Badge>
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="text-center">
						<p className="text-4xl font-bold tabular-nums">{result.scorePercent.toFixed(0)}%</p>
						<p className="text-muted-foreground text-sm">
							{result.correctAnswers} / {result.totalQuestions} correct
						</p>
					</div>

					<Separator />

					<div className="space-y-2">
						<p className="text-sm font-medium">Section Breakdown</p>
						{result.sectionScores.map(s => {
							const sec = EXAM_SECTIONS.find(e => e.id === s.sectionId)
							return (
								<div key={s.sectionId} className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">
										{sec?.title ?? `Section ${s.sectionId}`}
									</span>
									<span className="font-mono">
										{s.correct}/{s.total}
									</span>
								</div>
							)
						})}
					</div>
				</CardContent>
			</Card>

			<div className="flex justify-center gap-2">
				{result.passed ? (
					<Button onClick={onCertificate}>Claim Certificate</Button>
				) : (
					<Button onClick={onRetake}>Retake Exam</Button>
				)}
			</div>
		</div>
	)
}

function CertificateConfirmation({ onDone }: { onDone: () => void }) {
	return (
		<div className="mx-auto max-w-lg space-y-6 py-4 text-center">
			<div className="space-y-3">
				<div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
					<svg
						className="size-8 text-green-600 dark:text-green-400"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth={2}
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z"
						/>
					</svg>
				</div>
				<h2 className="text-xl font-semibold">Certificate Confirmed</h2>
				<p className="text-muted-foreground text-sm">
					Your Electronic Notary Public certificate has been issued.
				</p>
				<p className="text-muted-foreground text-xs">Certificate ID: CERT-2024-001</p>
			</div>

			<div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
				<Button onClick={() => alert("Download PDF (fixture)")}>Download PDF</Button>
				<Button variant="outline" onClick={() => alert("Email sent (fixture)")}>
					Email me a copy
				</Button>
			</div>

			<Separator />

			<Button variant="outline" onClick={onDone}>
				Continue to Dashboard
			</Button>
		</div>
	)
}
