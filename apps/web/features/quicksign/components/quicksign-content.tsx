"use client"

import * as React from "react"
import { toast } from "sonner"

import type { QuicksignProject, UserProfile } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Card, CardContent } from "@/core/components/ui/card"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/core/components/ui/select"
import { LocalSigningModal } from "../components/local-signing-modal"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import { useAdvanceDocumentReviewQuicksignMutation } from "@/features/document-review/api/document-review.hooks"
import {
	clearReviewQuicksignBootstrap,
	loadReviewQuicksignBootstrap,
	notarizationFromReviewBootstrap,
	saveReviewQuicksignBootstrap,
	signerFromReviewBootstrap,
} from "@/features/document-review/lib/review-quicksign-bootstrap"

import {
	useCompleteQuicksignPlottingMutation,
	useCreateQuicksignProjectMutation,
	useFinalizeQuicksignMutation,
	useQuicksignProjectQuery,
	useQuicksignProjectsQuery,
} from "../api/quicksign.hooks"
import { useQuicksignPlotting } from "../api/use-quicksign-plotting"
import { buildScheduledAtIso } from "../lib/build-meeting-schedule"
import {
	createInitialQuickSignState,
	FIXTURE_FAILURE_OPTIONS,
	WIZARD_STEPS,
	type FixtureFailure,
	type QuickSignState,
	type WizardStep,
} from "../lib/fixtures"
import { formatQuicksignProjectLabel, getQuicksignErrorDetails } from "../lib/quicksign-error"
import {
	buildQuickSignStateFromProject,
	clearPersistedQuicksignSession,
	loadPersistedQuicksignSession,
	mergeQuickSignStateFromProject,
	pickResumableProject,
	savePersistedQuicksignSession,
} from "../lib/quicksign-session"
import { uploadQuicksignOriginalFile } from "../lib/upload-quicksign-file"
import { StepAssignSigner } from "./step-assign-signer"
import { StepCreateMeeting } from "./step-create-meeting"
import { StepPlotFields } from "./step-plot-fields"
import { StepSelectTypes } from "./step-select-types"
import { StepUpload } from "./step-upload"

export function QuickSignContent() {
	const [state, setState] = React.useState<QuickSignState>(createInitialQuickSignState)
	const [sessionReady, setSessionReady] = React.useState(false)
	const profileQ = useAuthProfileMeQuery()
	const profile = profileQ.data as UserProfile | undefined
	const subOrgId = profile?.subOrgId ?? null
	const projectsQ = useQuicksignProjectsQuery()
	const activeProjectQ = useQuicksignProjectQuery(state.projectId, {
		enabled: sessionReady && Boolean(state.projectId),
	})

	const createProject = useCreateQuicksignProjectMutation()
	const completePlotting = useCompleteQuicksignPlottingMutation()
	const finalizeMeeting = useFinalizeQuicksignMutation()
	const advanceReviewQuicksign = useAdvanceDocumentReviewQuicksignMutation()

	const plotting = useQuicksignPlotting({
		projectId: state.projectId,
		documentName:
			state.upload.fileName.trim() || state.upload.file?.name.replace(/\.pdf$/i, "") || null,
		onPlotterOpened: () => {
			setState(prev => ({
				...prev,
				plotFields: {
					...prev.plotFields,
					plotterOpened: true,
					confirmed: false,
					enpAlreadyPlotted: false,
				},
				error: null,
				errorCode: null,
			}))
		},
		onPlottingComplete: () =>
			patch({
				step: "create_meeting",
				error: null,
				errorCode: null,
				plotFields: {
					plotterOpened: true,
					confirmed: true,
					enpAlreadyPlotted: true,
				},
			}),
	})

	React.useEffect(() => {
		if (sessionReady || projectsQ.isPending) return

		const reviewBootstrap = loadReviewQuicksignBootstrap()
		const persisted = loadPersistedQuicksignSession()
		const projects = (projectsQ.data as QuicksignProject[] | undefined) ?? []
		const resumable = pickResumableProject(projects, persisted)

		if (resumable && (!reviewBootstrap || resumable.id === reviewBootstrap.quicksignProjectId)) {
			setState(prev => {
				const fromProject = buildQuickSignStateFromProject(
					resumable,
					persisted,
					persisted?.fixtureFailure ?? prev.fixtureFailure
				)
				if (!reviewBootstrap) return fromProject
				return {
					...fromProject,
					reviewQueue: persisted?.reviewQueue ?? reviewBootstrap.queue,
					ienFromReview: persisted?.ienFromReview ?? true,
					signer: persisted?.signer?.email
						? fromProject.signer
						: signerFromReviewBootstrap(reviewBootstrap),
				}
			})
		} else if (reviewBootstrap) {
			setState(prev => ({
				...createInitialQuickSignState(),
				fixtureFailure: prev.fixtureFailure,
				step: "plot_fields",
				projectId: reviewBootstrap.quicksignProjectId,
				projectRef: formatQuicksignProjectLabel(reviewBootstrap.quicksignProjectId),
				documentFileId: reviewBootstrap.documentFileId,
				upload: {
					file: null,
					fileName: reviewBootstrap.documentTitle,
					notarizationType: notarizationFromReviewBootstrap(reviewBootstrap),
				},
				signer: signerFromReviewBootstrap(reviewBootstrap),
				signerAdded: true,
				reviewQueue: reviewBootstrap.queue,
				ienFromReview: true,
			}))
		} else if (persisted) {
			setState(prev => {
				const initial = createInitialQuickSignState()
				return {
					...initial,
					fixtureFailure: persisted.fixtureFailure ?? prev.fixtureFailure,
					step: persisted.step ?? initial.step,
					documentFileId: persisted.documentFileId ?? null,
					signer: persisted.signer ?? initial.signer,
					documentTypeIds: persisted.documentTypeIds ?? initial.documentTypeIds,
					upload: {
						...initial.upload,
						fileName: persisted.upload?.fileName ?? initial.upload.fileName,
						notarizationType: persisted.upload?.notarizationType ?? initial.upload.notarizationType,
					},
					plotFields: persisted.plotFields ?? initial.plotFields,
					meeting: persisted.meeting ?? initial.meeting,
					reviewQueue: persisted.reviewQueue ?? null,
					ienFromReview: persisted.ienFromReview ?? false,
				}
			})
		}
		setSessionReady(true)
	}, [projectsQ.isPending, projectsQ.data, sessionReady])

	React.useEffect(() => {
		if (!sessionReady || !state.projectId) return
		savePersistedQuicksignSession(state)
	}, [sessionReady, state])

	React.useEffect(() => {
		const project = activeProjectQ.data as QuicksignProject | undefined
		if (!sessionReady || !project || project.id !== state.projectId) return
		const persisted = loadPersistedQuicksignSession()
		setState(prev => mergeQuickSignStateFromProject(prev, project, persisted))
	}, [activeProjectQ.data, sessionReady, state.projectId])

	const plotRepairAttemptedRef = React.useRef<string | null>(null)
	React.useEffect(() => {
		if (!sessionReady || !state.projectId) return
		const atOrPastPlot =
			state.step === "create_meeting" ||
			state.plotFields.confirmed ||
			state.plotFields.enpAlreadyPlotted
		if (!atOrPastPlot) return

		const project = activeProjectQ.data as QuicksignProject | undefined
		if (project?.plotCompletedAt) return
		if (plotRepairAttemptedRef.current === state.projectId) return
		plotRepairAttemptedRef.current = state.projectId

		void completePlotting.mutateAsync(state.projectId).catch(() => {
			plotRepairAttemptedRef.current = null
		})
	}, [
		sessionReady,
		state.projectId,
		state.step,
		state.plotFields.confirmed,
		state.plotFields.enpAlreadyPlotted,
		activeProjectQ.data,
		completePlotting,
	])

	function patch(updates: Partial<QuickSignState>) {
		setState(prev => ({ ...prev, ...updates }))
	}

	function applyProjectSuccess(projectId: string) {
		const projectRef = formatQuicksignProjectLabel(projectId)
		patch({
			isLoading: false,
			error: null,
			errorCode: null,
			projectId,
			projectRef,
			signerAdded: true,
			step: "plot_fields",
		})
		toast.success(`project ${projectRef} created. Continue to plot signature fields.`)
	}

	async function handleUploadSubmit() {
		const { upload } = state
		if (!upload.file) return
		if (!subOrgId) {
			patch({
				error: "Your profile is missing an organization context. Complete ENP setup and try again.",
			})
			return
		}

		patch({ isLoading: true, error: null, errorCode: null })

		try {
			const title =
				upload.fileName.trim() || upload.file.name.replace(/\.pdf$/i, "").trim() || upload.file.name
			const { fileObjectId } = await uploadQuicksignOriginalFile({
				file: upload.file,
				subOrgId,
			})
			patch({
				documentFileId: fileObjectId,
				upload: {
					...state.upload,
					fileName: title,
				},
			})
			const project = await createProject.mutateAsync({
				title,
				description: `QuickSign · ${upload.notarizationType}`,
				documentFileId: fileObjectId,
				signer: {
					email: state.signer.email.trim(),
					firstName: state.signer.firstName.trim(),
					lastName: state.signer.lastName.trim(),
				},
				enpDocumentTypeIds: state.documentTypeIds,
			})

			if (!project.doconchainProjectUuid) {
				throw new Error("project was not created. Try again.")
			}

			patch({
				documentFileId: fileObjectId,
				upload: {
					...state.upload,
					file: null,
					fileName: title,
				},
			})
			applyProjectSuccess(project.id)
		} catch (e) {
			const { message, code, projectId } = getQuicksignErrorDetails(
				e,
				"Could not create the project."
			)
			patch({
				isLoading: false,
				error: message,
				errorCode: code,
				...(projectId
					? {
							projectId,
							projectRef: formatQuicksignProjectLabel(projectId),
						}
					: {}),
			})
		}
	}

	async function handleRetryProject() {
		if (!state.documentFileId) {
			patch({ error: "No document to retry. Upload the document again." })
			return
		}

		patch({ isLoading: true, error: null, errorCode: null })

		try {
			const project = await createProject.mutateAsync({
				title: state.upload.fileName.trim(),
				description: `QuickSign · ${state.upload.notarizationType}`,
				documentFileId: state.documentFileId,
				signer: {
					email: state.signer.email.trim(),
					firstName: state.signer.firstName.trim(),
					lastName: state.signer.lastName.trim(),
				},
				enpDocumentTypeIds: state.documentTypeIds,
			})
			if (!project.doconchainProjectUuid) {
				throw new Error("Project was not created. Try again.")
			}
			applyProjectSuccess(project.id)
		} catch (e) {
			const { message, code } = getQuicksignErrorDetails(e, "Retry failed.")
			patch({ isLoading: false, error: message, errorCode: code })
		}
	}

	function handleRecreateProject() {
		setState({
			...createInitialQuickSignState(),
			fixtureFailure: state.fixtureFailure,
		})
	}

	async function handleCreateMeeting() {
		const projectId = state.projectId
		if (!projectId) return

		patch({ isLoading: true, error: null, errorCode: null })

		try {
			const result = await finalizeMeeting.mutateAsync({
				id: projectId,
				scheduledAt: buildScheduledAtIso(state.meeting.date, state.meeting.time),
				title: state.upload.fileName.trim() || undefined,
				notarizationType: state.upload.notarizationType,
				sessionMode: state.ienFromReview ? "in_person" : "hybrid",
				notes: state.meeting.notes.trim() || undefined,
			})

			patch({
				isLoading: false,
				meetingCreated: true,
				appointmentId: result.appointmentId,
				clientJoinLink: result.clientJoinUrl,
				enpJoinLink: result.enpJoinUrl,
				signDocumentUrl: result.signDocumentUrl,
				enpSignDocumentUrl: result.enpSignDocumentUrl,
				principalSignerStatus: result.principalSignerStatus,
				signingComplete: result.signingComplete,
				registrySynced: result.registrySynced,
				error: null,
				errorCode: null,
			})
			toast.success(
				state.ienFromReview
					? "Signing links sent. Complete in-person signatures with the principal."
					: "Session created. An invite was sent to the signer."
			)
		} catch (e) {
			const { message, code } = getQuicksignErrorDetails(e, "Could not create the meeting.")
			const displayMessage =
				code === "SIGNER_NOT_REGISTERED"
					? "The signer email must match a registered client account. Ask them to sign up with the same Gmail you added, then try again."
					: message
			patch({ isLoading: false, error: displayMessage, errorCode: code })
		}
	}

	async function handleContinueReviewQueue() {
		if (!state.reviewQueue) return
		patch({ isLoading: true, error: null, errorCode: null })
		try {
			const result = await advanceReviewQuicksign.mutateAsync(state.reviewQueue.reviewRequestId)
			if (!result.quicksign) {
				clearReviewQuicksignBootstrap()
				clearPersistedQuicksignSession()
				toast.success("All documents from this review are fully signed.")
				setState({
					...createInitialQuickSignState(),
					fixtureFailure: state.fixtureFailure,
				})
				return
			}
			saveReviewQuicksignBootstrap({ ...result.quicksign, fromReview: true })
			clearPersistedQuicksignSession()
			const bootstrap = result.quicksign
			setState({
				...createInitialQuickSignState(),
				fixtureFailure: state.fixtureFailure,
				step: "plot_fields",
				projectId: bootstrap.quicksignProjectId,
				projectRef: formatQuicksignProjectLabel(bootstrap.quicksignProjectId),
				documentFileId: bootstrap.documentFileId,
				upload: {
					file: null,
					fileName: bootstrap.documentTitle,
					notarizationType: bootstrap.notarizationType,
				},
				signer: signerFromReviewBootstrap({ ...bootstrap, fromReview: true }),
				signerAdded: true,
				reviewQueue: bootstrap.queue,
				ienFromReview: true,
			})
			toast.success(
				`Document ${bootstrap.queue.currentIndex} of ${bootstrap.queue.totalDocuments} — plot signature fields.`
			)
		} catch (e) {
			patch({
				isLoading: false,
				error: e instanceof Error ? e.message : "Could not load the next document.",
			})
		}
	}

	function handleStartAnother() {
		clearPersistedQuicksignSession()
		clearReviewQuicksignBootstrap()
		setState({
			...createInitialQuickSignState(),
			fixtureFailure: state.fixtureFailure,
		})
	}

	function handleStartNewQuicksign() {
		handleStartAnother()
		toast.info("QuickSign reset. Upload a new document to begin.")
	}

	const hasQuicksignProgress =
		state.projectId !== null ||
		state.step !== "assign_signer" ||
		state.upload.file !== null ||
		state.documentTypeIds.length > 0 ||
		state.meetingCreated

	const stepIndex = WIZARD_STEPS.findIndex(s => s.key === state.step)
	const signerComplete =
		state.signer.firstName.trim().length > 0 &&
		state.signer.lastName.trim().length > 0 &&
		/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.signer.email.trim())
	const canGoNext =
		state.step === "assign_signer"
			? signerComplete
			: state.step === "select_types"
				? state.documentTypeIds.length > 0
				: state.step === "upload"
					? Boolean(state.projectId && state.documentFileId)
					: state.step === "plot_fields"
						? state.plotFields.confirmed || state.plotFields.enpAlreadyPlotted
						: false
	const canCreateProjectFromUpload =
		state.step === "upload" &&
		!state.projectId &&
		!state.documentFileId &&
		state.upload.file !== null &&
		!state.isLoading
	const uploadPrimaryLabel =
		state.projectId && state.documentFileId
			? "Continue"
			: state.isLoading
				? "Creating…"
				: "Create Project"

	function goBack() {
		if (state.step === "select_types") patch({ step: "assign_signer" })
		if (state.step === "upload") patch({ step: "select_types" })
		if (state.step === "plot_fields")
			patch({ step: state.ienFromReview ? "assign_signer" : "upload" })
		if (state.step === "create_meeting") patch({ step: "plot_fields" })
	}

	function goNext() {
		if (!canGoNext) return
		if (state.step === "assign_signer")
			patch({ step: "select_types", error: null, errorCode: null })
		if (state.step === "select_types") patch({ step: "upload", error: null, errorCode: null })
		if (state.step === "upload") patch({ step: "plot_fields", error: null, errorCode: null })
		if (state.step === "plot_fields")
			patch({ step: "create_meeting", error: null, errorCode: null })
	}

	function handleFooterPrimary() {
		if (state.step === "upload") {
			if (state.projectId && state.documentFileId) {
				patch({ step: "plot_fields", error: null, errorCode: null })
				return
			}
			void handleUploadSubmit()
			return
		}
		goNext()
	}

	return (
		<div className="space-y-4">
			{/* Dev fixture controls — hidden in production builds if desired later */}
			<Card className="border-dashed border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10">
				<CardContent className="py-3">
					<div className="flex flex-wrap items-end gap-4">
						<div className="flex items-center gap-2">
							<Badge
								variant="outline"
								className="border-amber-500/40 text-amber-700 dark:text-amber-400"
							>
								Fixture
							</Badge>
							<span className="text-xs font-medium">Failure Scenario</span>
						</div>
						<Select
							value={state.fixtureFailure}
							onValueChange={v => patch({ fixtureFailure: v as FixtureFailure })}
						>
							<SelectTrigger className="w-56">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{FIXTURE_FAILURE_OPTIONS.map(o => (
									<SelectItem key={o.value} value={o.value}>
										{o.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button variant="outline" size="sm" onClick={handleStartAnother}>
							Reset
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="ml-auto"
							onClick={handleStartNewQuicksign}
							disabled={state.isLoading || !hasQuicksignProgress}
						>
							Start New Quick Sign
						</Button>
					</div>
				</CardContent>
			</Card>

			{!sessionReady ? (
				<Card className="mx-auto max-w-lg">
					<CardContent className="text-muted-foreground py-8 text-center text-sm">
						Restoring your QuickSign session…
					</CardContent>
				</Card>
			) : null}

			<div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-6">
				{sessionReady && state.reviewQueue && state.ienFromReview && (
					<p className="text-muted-foreground max-w-lg text-center text-sm">
						From document review — document {state.reviewQueue.currentIndex} of{" "}
						{state.reviewQueue.totalDocuments}
					</p>
				)}

				{sessionReady && !state.meetingCreated && (
					<nav aria-label="Wizard progress" className="flex w-full max-w-3xl items-center gap-2">
						{WIZARD_STEPS.map((ws, i) => {
							const isCurrent = ws.key === state.step
							const isCompleted = i < stepIndex
							return (
								<React.Fragment key={ws.key}>
									{i > 0 && (
										<div className={`h-px flex-1 ${isCompleted ? "bg-primary" : "bg-border"}`} />
									)}
									<div className="flex items-center gap-1.5">
										<span
											className={`flex size-6 items-center justify-center rounded-full text-xs font-medium ${
												isCompleted
													? "bg-primary text-primary-foreground"
													: isCurrent
														? "bg-primary/10 text-primary ring-primary ring-1"
														: "bg-muted text-muted-foreground"
											}`}
										>
											{isCompleted ? "✓" : ws.number}
										</span>
										<span
											className={`hidden text-xs sm:inline ${isCurrent ? "font-medium" : "text-muted-foreground"}`}
										>
											{ws.label}
										</span>
									</div>
								</React.Fragment>
							)
						})}
					</nav>
				)}

				{sessionReady && state.step === "assign_signer" && (
					<StepAssignSigner
						signer={state.signer}
						onChange={signer => patch({ signer, error: null, errorCode: null })}
					/>
				)}

				{sessionReady && state.step === "select_types" && (
					<StepSelectTypes
						selectedIds={state.documentTypeIds}
						onChange={documentTypeIds => patch({ documentTypeIds, error: null, errorCode: null })}
					/>
				)}

				{sessionReady && state.step === "upload" && (
					<StepUpload
						upload={state.upload}
						savedDocumentName={
							state.documentFileId ? state.upload.fileName.trim() || "Uploaded document" : null
						}
						hasCreatedProject={Boolean(state.projectId && state.documentFileId)}
						isLoading={state.isLoading}
						error={state.error}
						errorCode={state.errorCode}
						onUpdate={u => patch({ upload: { ...state.upload, ...u } })}
						onRetry={handleRetryProject}
						onRecreate={handleRecreateProject}
						canRetryWithoutReupload={Boolean(state.documentFileId)}
					/>
				)}

				{sessionReady && state.step === "plot_fields" && (
					<StepPlotFields
						projectRef={state.projectRef ?? ""}
						plotterOpened={plotting.plotterOpened || state.plotFields.plotterOpened}
						isOpeningPlotter={plotting.isOpeningPlotter}
						isConfirmingPlot={plotting.isConfirmingPlot}
						error={state.error}
						onOpenPlotter={() => void plotting.openPlotter()}
						onManualConfirm={() => plotting.setLocalSigningOpen(true)}
					/>
				)}

				{sessionReady && state.step === "create_meeting" && (
					<StepCreateMeeting
						meeting={state.meeting}
						isLoading={state.isLoading || finalizeMeeting.isPending}
						error={state.error}
						meetingCreated={state.meetingCreated}
						clientJoinLink={state.clientJoinLink}
						enpJoinLink={state.enpJoinLink}
						signDocumentUrl={state.signDocumentUrl}
						enpSignDocumentUrl={state.enpSignDocumentUrl}
						principalSignerStatus={state.principalSignerStatus}
						quicksignProjectId={state.projectId}
						appointmentId={state.appointmentId}
						documentFileId={state.documentFileId}
						documentTitle={state.upload.fileName.trim()}
						signingComplete={state.signingComplete}
						registrySynced={state.registrySynced}
						signerEmail={state.signer.email.trim()}
						projectRef={state.projectRef ?? ""}
						onUpdate={m => patch({ meeting: { ...state.meeting, ...m } })}
						onSubmit={() => void handleCreateMeeting()}
						onStartAnother={handleStartAnother}
						onBack={() => patch({ step: "plot_fields" as WizardStep })}
						ienFromReview={state.ienFromReview}
						reviewQueue={state.reviewQueue}
						onContinueReviewQueue={() => void handleContinueReviewQueue()}
						isAdvancingReview={advanceReviewQuicksign.isPending}
						notarizationType={state.upload.notarizationType}
						onNotarizationTypeChange={notarizationType =>
							patch({ upload: { ...state.upload, notarizationType } })
						}
					/>
				)}

				{sessionReady &&
					!state.meetingCreated &&
					(state.step === "assign_signer" ||
						state.step === "select_types" ||
						state.step === "upload" ||
						state.step === "plot_fields") && (
						<div className="flex w-full max-w-lg items-center justify-between gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={goBack}
								disabled={state.step === "assign_signer" || state.isLoading}
							>
								Back
							</Button>
							{state.step === "upload" ? (
								<Button
									type="button"
									onClick={handleFooterPrimary}
									disabled={
										state.isLoading ||
										(!canCreateProjectFromUpload && !Boolean(state.projectId && state.documentFileId))
									}
								>
									{uploadPrimaryLabel}
								</Button>
							) : (
								<Button
									type="button"
									onClick={handleFooterPrimary}
									disabled={!canGoNext || state.isLoading}
								>
									Continue
								</Button>
							)}
						</div>
					)}
			</div>

			<LocalSigningModal
				open={plotting.localSigningOpen}
				onOpenChange={plotting.setLocalSigningOpen}
				projectId={state.projectId}
				signerEmail={state.signer.email.trim()}
				signerName={`${state.signer.firstName.trim()} ${state.signer.lastName.trim()}`.trim() || null}
				onStamped={plotting.handleLocalSigningStamped}
			/>
		</div>
	)
}
