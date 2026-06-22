import type { DocumentReviewQuicksignQueue, QuicksignProject } from "@repo/contracts"

import {
	createInitialQuickSignState,
	type FixtureFailure,
	type NotarizationType,
	type PlotFieldsState,
	type QuickSignState,
	type SignerPayload,
	type WizardStep,
} from "./fixtures"
import { formatQuicksignProjectLabel } from "./quicksign-error"

const STORAGE_KEY = "qlegal-quicksign-wizard-session:v2"

const WIZARD_STEP_VALUES: WizardStep[] = [
	"assign_signer",
	"select_types",
	"upload",
	"plot_fields",
	"create_meeting",
]

const STEP_RANK: Record<WizardStep, number> = {
	assign_signer: 0,
	select_types: 1,
	upload: 2,
	plot_fields: 3,
	create_meeting: 4,
}

function maxWizardStep(a: WizardStep, b: WizardStep): WizardStep {
	return STEP_RANK[a] >= STEP_RANK[b] ? a : b
}

function stepFromProject(project: QuicksignProject): WizardStep {
	if (!project.doconchainProjectUuid?.trim()) return "upload"
	if (project.signatories.length === 0) return "assign_signer"
	if (!project.plotCompletedAt) return "plot_fields"
	return "create_meeting"
}

export type PersistedQuicksignSession = {
	projectId?: string | null
	documentFileId?: string | null
	step?: WizardStep
	upload?: Omit<QuickSignState["upload"], "file">
	plotFields?: PlotFieldsState
	signer?: SignerPayload
	documentTypeIds?: string[]
	fixtureFailure?: FixtureFailure
	meetingCreated?: boolean
	meeting?: QuickSignState["meeting"]
	clientJoinLink?: string
	enpJoinLink?: string
	signDocumentUrl?: string
	enpSignDocumentUrl?: string
	appointmentId?: string | null
	principalSignerStatus?: QuickSignState["principalSignerStatus"]
	signingComplete?: boolean
	registrySynced?: boolean
	reviewQueue?: DocumentReviewQuicksignQueue | null
	ienFromReview?: boolean
}

const NOTARIZATION_TYPES: NotarizationType[] = [
	"acknowledgment",
	"jurat",
	"oath_affirmation",
	"copy_certification",
	"signature_witnessing",
]

export function loadPersistedQuicksignSession(): PersistedQuicksignSession | null {
	if (typeof window === "undefined") return null
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as PersistedQuicksignSession & { step?: string }
		const step = WIZARD_STEP_VALUES.includes(parsed.step as WizardStep)
			? (parsed.step as WizardStep)
			: "assign_signer"
		return parsed
			? {
					...parsed,
					projectId:
						typeof parsed.projectId === "string" && parsed.projectId.trim()
							? parsed.projectId
							: null,
					step,
					documentTypeIds: Array.isArray(parsed.documentTypeIds)
						? parsed.documentTypeIds.filter(id => typeof id === "string" && id.trim())
						: [],
				}
			: null
	} catch {
		return null
	}
}

export function savePersistedQuicksignSession(state: QuickSignState): void {
	if (typeof window === "undefined") return
	const payload: PersistedQuicksignSession = {
		projectId: state.projectId,
		documentFileId: state.documentFileId,
		step: state.step,
		upload: {
			fileName: state.upload.fileName,
			notarizationType: state.upload.notarizationType,
		},
		plotFields: state.plotFields,
		signer: state.signer,
		documentTypeIds: state.documentTypeIds,
		fixtureFailure: state.fixtureFailure,
		meetingCreated: state.meetingCreated,
		meeting: state.meeting,
		clientJoinLink: state.clientJoinLink,
		enpJoinLink: state.enpJoinLink,
		signDocumentUrl: state.signDocumentUrl,
		enpSignDocumentUrl: state.enpSignDocumentUrl,
		appointmentId: state.appointmentId,
		principalSignerStatus: state.principalSignerStatus,
		signingComplete: state.signingComplete,
		registrySynced: state.registrySynced,
		reviewQueue: state.reviewQueue,
		ienFromReview: state.ienFromReview,
	}
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
	} catch {
		/* quota / private mode */
	}
}

export function clearPersistedQuicksignSession(): void {
	if (typeof window === "undefined") return
	try {
		sessionStorage.removeItem(STORAGE_KEY)
	} catch {
		/* ignore */
	}
}

export function isResumableQuicksignProject(project: QuicksignProject): boolean {
	if (
		project.status === "completed" ||
		project.status === "expired" ||
		project.status === "cancelled"
	) {
		return false
	}
	return true
}

export function deriveWizardStepFromProject(
	project: QuicksignProject,
	persisted?: PersistedQuicksignSession | null
): WizardStep {
	if (project.appointmentId) return "create_meeting"

	let step = stepFromProject(project)
	if (persisted?.projectId !== project.id) return step

	if (persisted.step) {
		step = maxWizardStep(step, persisted.step)
	}
	if (persisted.plotFields?.confirmed && step === "plot_fields") {
		step = "create_meeting"
	}
	return step
}

function parseNotarizationType(description: string | null): NotarizationType {
	if (!description) return "acknowledgment"
	const match = description.match(/QuickSign\s*·\s*(\w+)/i)
	const raw = match?.[1]?.toLowerCase().replace(/\s+/g, "_") ?? ""
	if (NOTARIZATION_TYPES.includes(raw as NotarizationType)) {
		return raw as NotarizationType
	}
	return "acknowledgment"
}

function signerPayloadFromSignatory(
	signatory: QuicksignProject["signatories"][number]
): SignerPayload {
	const parts = signatory.name.trim().split(/\s+/).filter(Boolean)
	if (parts.length === 0) {
		return { email: signatory.email, firstName: "", lastName: "" }
	}
	if (parts.length === 1) {
		return { email: signatory.email, firstName: parts[0]!, lastName: "" }
	}
	return {
		email: signatory.email,
		firstName: parts[0]!,
		lastName: parts.slice(1).join(" "),
	}
}

export function buildQuickSignStateFromProject(
	project: QuicksignProject,
	persisted: PersistedQuicksignSession | null,
	fixtureFailure: FixtureFailure
): QuickSignState {
	const initial = createInitialQuickSignState()
	const firstSignatory = project.signatories[0]
	const signerFromDb = firstSignatory ? signerPayloadFromSignatory(firstSignatory) : initial.signer
	const usePersistedSigner =
		persisted?.projectId === project.id &&
		persisted.signer &&
		(persisted.signer.email.trim() || persisted.signer.firstName.trim())

	const samePersisted = persisted?.projectId === project.id
	const projectDocumentTypeIds = (project.documentTypes ?? []).map(t => t.id)
	const meetingCreated =
		Boolean(project.appointmentId) || (samePersisted && Boolean(persisted?.meetingCreated))

	return {
		...initial,
		fixtureFailure: persisted?.fixtureFailure ?? fixtureFailure,
		step: deriveWizardStepFromProject(project, persisted),
		projectId: project.id,
		projectRef: formatQuicksignProjectLabel(project.id),
		documentFileId:
			samePersisted && persisted?.documentFileId ? persisted.documentFileId : project.documentFileId,
		upload: {
			file: null,
			fileName:
				samePersisted && persisted?.upload?.fileName ? persisted.upload.fileName : project.title,
			notarizationType:
				samePersisted && persisted?.upload?.notarizationType
					? persisted.upload.notarizationType
					: parseNotarizationType(project.description),
		},
		signer: usePersistedSigner ? { ...signerFromDb, ...persisted!.signer } : signerFromDb,
		signerAdded: project.signatories.length > 0,
		documentTypeIds:
			samePersisted && persisted?.documentTypeIds?.length
				? persisted.documentTypeIds
				: projectDocumentTypeIds,
		plotFields:
			samePersisted && persisted.plotFields
				? {
						plotterOpened: persisted.plotFields.plotterOpened ?? false,
						confirmed: persisted.plotFields.confirmed ?? Boolean(project.plotCompletedAt),
						enpAlreadyPlotted:
							persisted.plotFields.enpAlreadyPlotted ?? Boolean(project.plotCompletedAt),
					}
				: {
						plotterOpened: false,
						confirmed: Boolean(project.plotCompletedAt),
						enpAlreadyPlotted: Boolean(project.plotCompletedAt),
					},
		meetingCreated,
		meeting: samePersisted && persisted.meeting ? persisted.meeting : initial.meeting,
		clientJoinLink: samePersisted ? (persisted.clientJoinLink ?? "") : "",
		enpJoinLink: samePersisted ? (persisted.enpJoinLink ?? "") : "",
		signDocumentUrl: samePersisted ? (persisted.signDocumentUrl ?? "") : "",
		enpSignDocumentUrl: samePersisted ? (persisted.enpSignDocumentUrl ?? "") : "",
		principalSignerStatus:
			samePersisted && persisted.principalSignerStatus ? persisted.principalSignerStatus : null,
		appointmentId:
			project.appointmentId ?? (samePersisted ? (persisted.appointmentId ?? null) : null),
		signingComplete: samePersisted ? (persisted.signingComplete ?? false) : false,
		registrySynced: samePersisted ? (persisted.registrySynced ?? false) : false,
		reviewQueue: samePersisted ? (persisted.reviewQueue ?? null) : null,
		ienFromReview: samePersisted ? (persisted.ienFromReview ?? false) : false,
	}
}

/** Reconcile live wizard state with authoritative project row (GET /quicksign/:id). */
export function mergeQuickSignStateFromProject(
	prev: QuickSignState,
	project: QuicksignProject,
	persisted: PersistedQuicksignSession | null
): QuickSignState {
	const next = buildQuickSignStateFromProject(project, persisted, prev.fixtureFailure)
	if (prev.projectId !== project.id) return next

	return {
		...next,
		step: maxWizardStep(next.step, prev.step),
		isLoading: prev.isLoading,
		error: prev.error,
		errorCode: prev.errorCode,
		meetingCreated: next.meetingCreated || prev.meetingCreated,
		meeting: prev.meeting.date.trim() || prev.meeting.time.trim() ? prev.meeting : next.meeting,
		clientJoinLink: prev.clientJoinLink || next.clientJoinLink,
		enpJoinLink: prev.enpJoinLink || next.enpJoinLink,
		signDocumentUrl: prev.signDocumentUrl || next.signDocumentUrl,
		enpSignDocumentUrl: prev.enpSignDocumentUrl || next.enpSignDocumentUrl,
		principalSignerStatus: prev.principalSignerStatus ?? next.principalSignerStatus,
		appointmentId: next.appointmentId ?? prev.appointmentId,
		signingComplete: next.signingComplete || prev.signingComplete,
		registrySynced: next.registrySynced || prev.registrySynced,
		reviewQueue: prev.reviewQueue ?? next.reviewQueue,
		ienFromReview: prev.ienFromReview || next.ienFromReview,
		documentTypeIds: prev.documentTypeIds.length ? prev.documentTypeIds : next.documentTypeIds,
		plotFields: {
			plotterOpened: prev.plotFields.plotterOpened || next.plotFields.plotterOpened,
			confirmed: prev.plotFields.confirmed || next.plotFields.confirmed,
			enpAlreadyPlotted: prev.plotFields.enpAlreadyPlotted || next.plotFields.enpAlreadyPlotted,
		},
	}
}

export function pickResumableProject(
	projects: QuicksignProject[],
	persisted: PersistedQuicksignSession | null
): QuicksignProject | null {
	const resumable = projects.filter(isResumableQuicksignProject)
	if (!resumable.length) return null

	if (persisted?.projectId) {
		const match = resumable.find(p => p.id === persisted.projectId)
		if (match) return match
	}

	return resumable[0] ?? null
}
