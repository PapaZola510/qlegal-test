"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { Label } from "@/core/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/core/components/ui/radio-group"
import { Separator } from "@/core/components/ui/separator"
import { cn } from "@/core/lib/utils"
import { orpc } from "@/services/orpc/client"
import {
	useCertExamsQuery,
	useDevPerfectCertExamMutation,
	useStartCertExamMutation,
	useSubmitCertExamSectionMutation,
	type CertExamSummary,
} from "@/features/onboarding/api/cert-exam.hooks"
import { env } from "@/env"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = orpc as any

interface ExamQuestion {
	id: string
	questionText: string
	choices: { key: string; text: string }[]
	order: number
	sectionIndex: number
}

interface ExamOutcome {
	attemptId: string
	score: number
	passed: boolean
	totalQuestions: number
	correctAnswers: number
	breakdown: {
		questionId: string
		promptPreview: string
		selectedKey: string
		correctKey: string
		correct: boolean
	}[]
}

function errMessage(e: unknown): string {
	if (
		e &&
		typeof e === "object" &&
		"message" in e &&
		typeof (e as { message: unknown }).message === "string"
	) {
		return (e as { message: string }).message
	}
	return "Something went wrong."
}

export function EnpCertExamStep() {
	const queryClient = useQueryClient()
	const examsQ = useCertExamsQuery()
	const start = useStartCertExamMutation()
	const submitSection = useSubmitCertExamSectionMutation()
	const devPerfect = useDevPerfectCertExamMutation()

	const exams = (examsQ.data ?? []) as CertExamSummary[]
	const examId = exams[0]?.id ?? null
	const examMeta = exams[0]

	const devAssistEnabled = React.useMemo(() => {
		if (env.NEXT_PUBLIC_CERT_EXAM_DEV_ASSIST === "true") return true
		if (typeof window === "undefined") return env.NODE_ENV !== "production"
		const host = window.location.hostname
		return host === "localhost" || host === "127.0.0.1"
	}, [])

	const [phase, setPhase] = React.useState<"brief" | "exam" | "result">("brief")
	const [sectionIdx, setSectionIdx] = React.useState(1)
	const [attemptId, setAttemptId] = React.useState<string | null>(null)
	const [questions, setQuestions] = React.useState<ExamQuestion[]>([])
	const [qIndex, setQIndex] = React.useState(0)
	const [answers, setAnswers] = React.useState<Record<string, string>>({})
	const [result, setResult] = React.useState<ExamOutcome | null>(null)

	const invalidateProfile = () => {
		void queryClient.invalidateQueries({ queryKey: api.authProfile.me.queryOptions().queryKey })
		void queryClient.invalidateQueries({
			queryKey: api.onboarding.progress.queryOptions().queryKey,
		})
	}

	const resetFlow = () => {
		setPhase("brief")
		setSectionIdx(1)
		setAttemptId(null)
		setQuestions([])
		setQIndex(0)
		setAnswers({})
		setResult(null)
	}

	const beginExam = () => {
		if (!examId) {
			toast.error("No certification exam is configured.")
			return
		}
		void start
			.mutateAsync({ examId })
			.then(res => {
				const r = res as {
					attempt: { id: string }
					questions: ExamQuestion[]
				}
				setAttemptId(r.attempt.id)
				setQuestions(r.questions)
				setSectionIdx(1)
				setQIndex(0)
				setAnswers({})
				setPhase("exam")
			})
			.catch(e => toast.error(errMessage(e)))
	}

	const answeredCount = questions.filter(q => answers[q.id]).length
	const current = questions[qIndex]

	const submitCurrentSection = () => {
		if (!attemptId || questions.length === 0) return
		if (answeredCount < questions.length) {
			toast.error("Answer every question in this section before submitting.")
			return
		}
		const payload: Record<string, string> = {}
		for (const q of questions) {
			payload[q.id] = answers[q.id]!
		}
		void submitSection
			.mutateAsync({
				attemptId,
				sectionIndex: sectionIdx,
				answers: payload,
			})
			.then(res => {
				const r = res as {
					nextQuestions: ExamQuestion[] | null
					result: ExamOutcome | null
				}
				if (r.result) {
					setResult(r.result)
					setPhase("result")
					invalidateProfile()
					toast.success(
						r.result.passed ? "Exam passed — certification recorded." : "Exam submitted."
					)
				} else if (r.nextQuestions?.length) {
					setQuestions(r.nextQuestions)
					setAnswers({})
					setQIndex(0)
					setSectionIdx(s => s + 1)
					toast.success(`Section ${sectionIdx} saved`)
				}
			})
			.catch(e => toast.error(errMessage(e)))
	}

	const runDevPerfect = () => {
		if (!examId) return
		void devPerfect
			.mutateAsync({ examId })
			.then(r => {
				const out = r as ExamOutcome
				setResult(out)
				setPhase("result")
				invalidateProfile()
				toast.success("Dev assist: perfect score submitted.")
			})
			.catch(e => toast.error(errMessage(e)))
	}

	if (examsQ.isPending) {
		return (
			<Card className="border-border/80 w-full shadow-md">
				<CardContent className="text-muted-foreground py-12 text-center text-sm">
					Loading exam…
				</CardContent>
			</Card>
		)
	}

	if (examsQ.isError || !examMeta) {
		return (
			<Card className="border-border/80 w-full shadow-md">
				<CardContent className="py-12 text-center text-sm">
					Certification exam is not available yet. Ask an administrator to seed exam content.
				</CardContent>
			</Card>
		)
	}

	if (phase === "brief") {
		return (
			<Card className="border-border/80 w-full shadow-md">
				<CardHeader>
					<CardTitle className="text-xl">Philippine ENP certification exam</CardTitle>
					<CardDescription>
						50 multiple-choice items drawn from the attorney question pool, shuffled each attempt
						(choices shuffled too). Passing score 70% (35/50).
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4 text-sm">
					<ul className="text-muted-foreground list-inside list-disc space-y-1 leading-relaxed">
						<li>
							{examMeta.sectionCount} sections × {examMeta.questionsPerSection} questions
						</li>
						<li>{examMeta.durationMinutes} minutes total</li>
						<li>You cannot change answers after submitting a section.</li>
						<li>If you fail, pay the ₱500 retake fee before your next attempt.</li>
					</ul>
					<Separator />
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							size="lg"
							onClick={beginExam}
							disabled={start.isPending || !examId}
						>
							{start.isPending ? "Starting…" : "Begin exam"}
						</Button>
						{devAssistEnabled ? (
							<Button
								type="button"
								size="lg"
								variant="secondary"
								disabled={devPerfect.isPending || !examId}
								onClick={runDevPerfect}
							>
								{devPerfect.isPending ? "Completing…" : "Complete exam"}
							</Button>
						) : null}
					</div>
					{devAssistEnabled ? (
						<p className="text-muted-foreground text-xs">
							Complete exam submits all 50 correct answers (dev/staging only).
						</p>
					) : null}
				</CardContent>
			</Card>
		)
	}

	if (phase === "result" && result) {
		const wrong = result.breakdown.filter(b => !b.correct).length
		return (
			<Card className="border-border/80 w-full shadow-md">
				<CardHeader className="space-y-2">
					<CardTitle className="flex flex-wrap items-center gap-2 text-xl">
						Exam results
						<Badge variant={result.passed ? "default" : "destructive"}>
							{result.passed ? "Passed" : "Not passed"}
						</Badge>
					</CardTitle>
					<CardDescription>
						Score {result.score}% · {result.correctAnswers}/{result.totalQuestions} correct
						{!result.passed ? (
							<> · Retake requires ₱500 payment confirmation before starting again.</>
						) : null}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-muted-foreground text-sm">
						Review each item: green is correct, red shows the key you chose versus the correct
						letter for this attempt.
					</p>
					<ul className="max-h-[420px] space-y-2 overflow-y-auto rounded-md border p-3">
						{result.breakdown.map(row => (
							<li
								key={row.questionId}
								className={cn(
									"rounded-md border px-3 py-2 text-sm",
									row.correct
										? "border-green-500/30 bg-green-500/5"
										: "border-red-500/30 bg-red-500/5"
								)}
							>
								<p className="font-medium">{row.promptPreview}</p>
								<p className="text-muted-foreground mt-1">
									You: <span className="font-mono">{row.selectedKey}</span> · Correct:{" "}
									<span className="font-mono">{row.correctKey}</span>
								</p>
							</li>
						))}
					</ul>
					<p className="text-muted-foreground text-xs">
						Incorrect items in this summary: {wrong}. Refresh onboarding after a pass to continue
						commission capture.
					</p>
					<div className="flex flex-wrap gap-2">
						{result.passed ? (
							<Button type="button" onClick={() => invalidateProfile()}>
								Refresh profile & continue onboarding
							</Button>
						) : (
							<Button type="button" variant="outline" onClick={resetFlow}>
								Back to exam instructions
							</Button>
						)}
					</div>
				</CardContent>
			</Card>
		)
	}

	if (!current) {
		return null
	}

	return (
		<div className="space-y-4">
			<Card className="border-border/80 shadow-md">
				<CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
					<Badge variant="outline" className="font-mono">
						Section {sectionIdx}/{examMeta.sectionCount}
					</Badge>
					<span className="text-muted-foreground text-sm">
						{answeredCount}/{questions.length} answered in this section
					</span>
				</CardContent>
			</Card>

			<Card className="border-border/80 shadow-md">
				<CardHeader>
					<CardTitle className="text-base">
						Question {qIndex + 1} of {questions.length}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm leading-relaxed">{current.questionText}</p>
					<RadioGroup
						value={answers[current.id] ?? ""}
						onValueChange={(v: unknown) =>
							setAnswers(prev => ({ ...prev, [current.id]: String(v ?? "") }))
						}
					>
						{current.choices.map(ch => (
							<div key={ch.key} className="flex items-center gap-3">
								<RadioGroupItem value={ch.key} id={`${current.id}-${ch.key}`} />
								<Label
									htmlFor={`${current.id}-${ch.key}`}
									className="flex-1 cursor-pointer font-normal"
								>
									<span className="font-mono text-xs">{ch.key.toUpperCase()}.</span> {ch.text}
								</Label>
							</div>
						))}
					</RadioGroup>
				</CardContent>
			</Card>

			<div className="flex flex-wrap items-center justify-between gap-3">
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={qIndex === 0}
					onClick={() => setQIndex(i => i - 1)}
				>
					Previous
				</Button>
				<div className="flex gap-2">
					{devAssistEnabled ? (
						<Button
							type="button"
							size="sm"
							variant="secondary"
							disabled={devPerfect.isPending || !examId}
							onClick={runDevPerfect}
						>
							{devPerfect.isPending ? "Completing…" : "Complete exam"}
						</Button>
					) : null}
					{qIndex < questions.length - 1 ? (
						<Button type="button" size="sm" onClick={() => setQIndex(i => i + 1)}>
							Next
						</Button>
					) : (
						<Button
							type="button"
							size="sm"
							disabled={answeredCount < questions.length || submitSection.isPending}
							onClick={submitCurrentSection}
						>
							{submitSection.isPending
								? "Submitting…"
								: sectionIdx >= examMeta.sectionCount
									? "Submit final section"
									: "Submit section"}
						</Button>
					)}
				</div>
			</div>
		</div>
	)
}
