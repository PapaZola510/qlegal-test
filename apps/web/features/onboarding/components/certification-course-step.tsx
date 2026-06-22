"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import type {
	LmsDemoCredentials,
	LmsTrainingProgress,
	StartLmsTrainingResponse,
} from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { Input } from "@/core/components/ui/input"
import { Separator } from "@/core/components/ui/separator"
import { Spinner } from "@/core/components/ui/spinner"
import { orpc } from "@/services/orpc/client"
import {
	useLmsTrainingProgressQuery,
	useSimulateLmsCompletionMutation,
	useStartQLearnCourseMutation,
	useSyncLmsCourseCompletionMutation,
} from "@/features/onboarding/api/lms-training.hooks"
import { useCompleteCertificationCourseMutation } from "@/features/onboarding/api/onboarding.hooks"
import { CERTIFICATION_MODULES } from "@/features/onboarding/lib/certification-course-content"
import { verifyOnboardingManualUnlock } from "@/features/onboarding/server/verify-manual-unlock"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = orpc as any
const MANUAL_UNLOCK_SESSION_KEY = "onboarding-manual-complete-unlocked"

function errMessage(e: unknown): string {
	if (
		e &&
		typeof e === "object" &&
		"message" in e &&
		typeof (e as { message: unknown }).message === "string"
	) {
		return (e as { message: string }).message
	}
	return "Could not open QLearn. Please try again."
}

function ManualCompletionUnlockPanel({
	completePending,
	simulatePending,
	onMarkComplete,
	onSimulatePass,
}: {
	completePending: boolean
	simulatePending: boolean
	onMarkComplete: () => void
	onSimulatePass: () => void
}) {
	const [unlocked, setUnlocked] = React.useState(false)
	const [password, setPassword] = React.useState("")
	const [checking, setChecking] = React.useState(false)

	React.useEffect(() => {
		try {
			if (sessionStorage.getItem(MANUAL_UNLOCK_SESSION_KEY) === "1") {
				setUnlocked(true)
			}
		} catch {
			// sessionStorage unavailable
		}
	}, [])

	const onUnlock = () => {
		if (!password.trim()) return
		setChecking(true)
		void verifyOnboardingManualUnlock(password)
			.then(ok => {
				if (!ok) {
					toast.error("Incorrect password")
					return
				}
				setUnlocked(true)
				setPassword("")
				try {
					sessionStorage.setItem(MANUAL_UNLOCK_SESSION_KEY, "1")
				} catch {
					// ignore
				}
			})
			.finally(() => setChecking(false))
	}

	return (
		<details className="group">
			<summary className="text-muted-foreground marker:text-muted-foreground cursor-pointer text-xs font-medium outline-none">
				Advanced / manual completion
			</summary>
			{unlocked ? (
				<div className="mt-3 flex flex-wrap gap-2">
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={completePending}
						onClick={onMarkComplete}
					>
						Mark course complete manually
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={simulatePending}
						onClick={onSimulatePass}
					>
						Dev: simulate QLearn pass
					</Button>
				</div>
			) : (
				<div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
					<div className="min-w-0 flex-1 space-y-1">
						<label htmlFor="manual-unlock-password" className="text-muted-foreground text-xs">
							Authorized access only
						</label>
						<Input
							id="manual-unlock-password"
							type="password"
							autoComplete="off"
							placeholder="Enter unlock password"
							value={password}
							disabled={checking}
							onChange={e => setPassword(e.target.value)}
							onKeyDown={e => {
								if (e.key === "Enter") onUnlock()
							}}
						/>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="shrink-0"
						disabled={checking || !password.trim()}
						onClick={onUnlock}
					>
						{checking ? "Checking…" : "Unlock"}
					</Button>
				</div>
			)}
		</details>
	)
}

function QLearnCertificationCourseStep() {
	const router = useRouter()
	const queryClient = useQueryClient()
	const progressQ = useLmsTrainingProgressQuery()
	const start = useStartQLearnCourseMutation()
	const syncCompletion = useSyncLmsCourseCompletionMutation()
	const complete = useCompleteCertificationCourseMutation()
	const simulate = useSimulateLmsCompletionMutation()
	const [demoCreds, setDemoCreds] = React.useState<LmsDemoCredentials | null>(null)

	const pendingTab = React.useRef<Window | null>(null)

	const openQLearn = (fromUserGesture = false) => {
		// No noopener here — we need the Window ref to navigate this tab after the API responds.
		// (noopener makes window.open return null while the blank tab still opens → two tabs.)
		if (fromUserGesture) {
			pendingTab.current = window.open("about:blank", "_blank")
		}

		void start
			.mutateAsync(undefined)
			.then(res => {
				const data = res as StartLmsTrainingResponse
				const hmac = data.ssoHandoffMode === "hmac"
				toast.success(
					data.alreadyEnrolled
						? hmac
							? "Opening QLearn in a new tab (auto sign-in)…"
							: "Opening your QLearn class in a new tab…"
						: hmac
							? "Enrolled — opening QLearn with auto sign-in (link expires in ~2 min)"
							: "Enrolled — opening QLearn in a new tab (sign-in link expires soon)"
				)
				if (data.demoCredentials) setDemoCreds(data.demoCredentials)

				const url = data.redirectUrl
				if (pendingTab.current && !pendingTab.current.closed) {
					pendingTab.current.location.href = url
					pendingTab.current.opener = null
					pendingTab.current = null
					return
				}
				const opened = window.open(url, "_blank", "noopener,noreferrer")
				if (!opened) {
					toast.error("Pop-up blocked. Allow pop-ups for this site, then try again.")
				}
			})
			.catch((e: unknown) => {
				pendingTab.current?.close()
				pendingTab.current = null
				toast.error(errMessage(e))
			})
	}

	const copyToClipboard = (value: string, label: string) => {
		if (!navigator?.clipboard) {
			toast.error("Clipboard not available")
			return
		}
		void navigator.clipboard
			.writeText(value)
			.then(() => toast.success(`${label} copied`))
			.catch(() => toast.error("Could not copy"))
	}

	const onSyncFromQlearn = () => {
		void syncCompletion
			.mutateAsync(undefined)
			.then(async r => {
				if ((r as { completed?: boolean }).completed) {
					const profileKey = api.authProfile.me.queryOptions().queryKey
					await queryClient.invalidateQueries({ queryKey: profileKey })
					await queryClient.refetchQueries({ queryKey: profileKey })
					toast.success("QLearn course & Final Quiz synced — continuing onboarding")
					router.refresh()
					return
				}
				toast.message("QLearn has not marked the course/Final Quiz complete yet")
			})
			.catch((e: unknown) => toast.error(errMessage(e)))
	}

	const progress = progressQ.data as LmsTrainingProgress | undefined
	const courseComplete =
		progress?.completion === "completed" || progress?.passed || progress?.progressPercent === 100

	return (
		<Card className="border-border/80 w-full shadow-md">
			<CardHeader className="space-y-1">
				<CardTitle className="text-xl">Certification course on QLearn</CardTitle>
				<CardDescription>
					Click below to open <strong>Mastering Quanby Legal</strong> on QLearn in a new tab. Work
					through every module, then complete the <strong>Final Quiz</strong> at the bottom of the
					course. When you&apos;re done, return here and sync progress.
					<br />
					<br />
					Open the course on{" "}
					<a
						href="https://qlearn.quanbyit.com"
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary underline-offset-4 hover:underline"
					>
						qlearn.quanbyit.com
					</a>{" "}
					— your account is synced and you should be signed in automatically when the course opens.
					If something doesn&apos;t work, contact support.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				{progress ? (
					<p className="text-muted-foreground text-sm">
						QLearn progress: {progress.progressPercent}% · {progress.completion}
						{progress.passed ? " · passed" : ""}
					</p>
				) : null}

				{courseComplete ? (
					<div className="border-primary/30 bg-primary/5 space-y-3 rounded-lg border p-4">
						<p className="text-sm font-medium">
							Course &amp; Final Quiz complete — what&apos;s next?
						</p>
						<ol className="text-muted-foreground list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
							<li>
								View and download the certificate in{" "}
								<a
									href="https://qlearn.quanbyit.com"
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary font-medium underline-offset-4 hover:underline"
								>
									QLearn
								</a>
								.
							</li>
							<li>Continue ENP onboarding on qLegal once sync succeeds.</li>
						</ol>
					</div>
				) : (
					<p className="text-muted-foreground text-sm leading-relaxed">
						Reminder: scroll to the bottom of the course on QLearn and complete the{" "}
						<strong>Final Quiz</strong> before syncing — qLegal checks QLearn for a passed result.
					</p>
				)}

				<Button
					type="button"
					size="lg"
					className="min-h-11 w-full gap-2 sm:w-auto"
					disabled={start.isPending}
					onClick={() => openQLearn(true)}
				>
					{start.isPending ? (
						<>
							<Spinner className="text-primary-foreground" />
							Syncing account &amp; opening QLearn…
						</>
					) : (
						"Open course on QLearn"
					)}
				</Button>

				<Button
					type="button"
					variant="secondary"
					className="min-h-11 w-full sm:w-auto"
					disabled={syncCompletion.isPending}
					onClick={onSyncFromQlearn}
				>
					{syncCompletion.isPending ? "Checking QLearn…" : "I finished on QLearn — sync progress"}
				</Button>

				<details className="border-border group rounded-lg border px-4 py-3">
					<summary className="text-muted-foreground marker:text-muted-foreground cursor-pointer text-sm font-medium outline-none">
						After the course — Final Quiz
					</summary>
					<ol className="text-muted-foreground mt-3 list-decimal space-y-2.5 pl-5 text-sm leading-relaxed">
						<li>
							<span className="text-foreground font-medium">Complete all modules</span> on QLearn
							(Mastering Quanby Legal).
						</li>
						<li>
							<span className="text-foreground font-medium">Take the Final Quiz</span> — at the
							bottom of the course on QLearn (this replaces the old in-app ENP exam).
						</li>
						<li>
							<span className="text-foreground font-medium">Sync progress</span> — return here and
							use the sync button so qLegal reads your result from QLearn.
						</li>
					</ol>
				</details>

				<details className="border-border group rounded-lg border px-4 py-3">
					<summary className="text-muted-foreground marker:text-muted-foreground cursor-pointer text-sm font-medium outline-none">
						Landed on the QLearn dashboard instead of the course?
					</summary>
					<ol className="text-muted-foreground mt-3 list-decimal space-y-2.5 pl-5 text-sm leading-relaxed">
						<li>
							<span className="text-foreground font-medium">Open Course</span> — click{" "}
							<strong>Open course on QLearn</strong> above to sign in.
						</li>
						<li>
							<span className="text-foreground font-medium">Finish theme</span> — complete the
							first-time theme picker if QLearn asks you to choose one.
						</li>
						<li>
							<span className="text-foreground font-medium">Go to dashboard</span> — you may land
							here after theme setup instead of the course page.
						</li>
						<li>
							<span className="text-foreground font-medium">
								Go to &quot;Course&quot; in the sidebar
							</span>{" "}
							— open the Course section from the left navigation.
						</li>
						<li>
							<span className="text-foreground font-medium">
								Look/Search for &quot;Mastering Quanby Legal&quot;
							</span>{" "}
							— open the course, finish all modules, then complete the <strong>Final Quiz</strong>{" "}
							at the bottom before syncing here.
						</li>
					</ol>
				</details>

				{demoCreds ? (
					<div className="border-border space-y-3 rounded-lg border p-4">
						<p className="text-sm font-medium">Demo QLearn login (staging only)</p>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<Input readOnly value={demoCreds.email} aria-label="Demo email" />
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => copyToClipboard(demoCreds.email, "Email")}
							>
								Copy email
							</Button>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							<Input readOnly value={demoCreds.password} aria-label="Demo password" />
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => copyToClipboard(demoCreds.password, "Password")}
							>
								Copy password
							</Button>
						</div>
					</div>
				) : null}

				<Separator />

				<ManualCompletionUnlockPanel
					completePending={complete.isPending}
					simulatePending={simulate.isPending}
					onMarkComplete={() =>
						void complete
							.mutateAsync(undefined)
							.then(() => toast.success("Course marked complete"))
							.catch(() => toast.error("Could not update course status"))
					}
					onSimulatePass={() =>
						void simulate
							.mutateAsync(undefined)
							.then(() => {
								toast.success("Dev: training marked complete")
								router.refresh()
							})
							.catch((e: unknown) => toast.error(errMessage(e)))
					}
				/>
			</CardContent>
		</Card>
	)
}

function InlineCertificationCourseStep() {
	const complete = useCompleteCertificationCourseMutation()

	return (
		<Card className="border-border/80 w-full shadow-md">
			<CardHeader className="space-y-1">
				<CardTitle className="text-xl">Certification course</CardTitle>
				<CardDescription>
					Five modules · nine lessons · read-through only. Mark complete when finished to unlock the
					ENP exam.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="border-border space-y-2 rounded-lg border p-2">
					{CERTIFICATION_MODULES.map(mod => (
						<details key={mod.id} className="group border-border not-last:border-b open:pb-2">
							<summary className="marker:text-muted-foreground cursor-pointer py-3 text-sm font-semibold outline-none">
								{mod.title}
							</summary>
							<ul className="space-y-4 pb-2">
								{mod.lessons.map(lesson => (
									<li key={lesson.id} className="space-y-2">
										<p className="text-sm font-medium">{lesson.title}</p>
										<p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
											{lesson.body}
										</p>
									</li>
								))}
							</ul>
						</details>
					))}
				</div>
				<Button
					type="button"
					size="lg"
					className="min-h-11 w-full sm:w-auto"
					disabled={complete.isPending}
					onClick={() =>
						void complete
							.mutateAsync(undefined)
							.then(() => toast.success("Course marked complete"))
							.catch(() => toast.error("Could not update course status"))
					}
				>
					{complete.isPending ? "Saving…" : "Mark course complete"}
				</Button>
			</CardContent>
		</Card>
	)
}

export function CertificationCourseStep({
	lmsIntegrationEnabled,
}: {
	lmsIntegrationEnabled: boolean
}) {
	if (lmsIntegrationEnabled) {
		return <QLearnCertificationCourseStep />
	}
	return <InlineCertificationCourseStep />
}
