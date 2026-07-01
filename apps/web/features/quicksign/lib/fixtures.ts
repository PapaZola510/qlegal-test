"use client"

import type { DocumentReviewQuicksignQueue, QuicksignErrorCode } from "@repo/contracts"

export type NotarizationType =
	| "acknowledgment"
	| "jurat"
	| "oath_affirmation"
	| "copy_certification"
	| "signature_witnessing"

export const NOTARIZATION_TYPE_OPTIONS: { value: NotarizationType; label: string }[] = [
	{ value: "acknowledgment", label: "Acknowledgment" },
	{ value: "jurat", label: "Jurat" },
	{ value: "oath_affirmation", label: "Oath / Affirmation" },
	{ value: "copy_certification", label: "Copy Certification" },
	{ value: "signature_witnessing", label: "Signature Witnessing" },
]

export type WizardStep =
	| "assign_signer"
	| "select_types"
	| "upload"
	| "plot_fields"
	| "create_meeting"

export const WIZARD_STEPS: { key: WizardStep; label: string; number: number }[] = [
	{ key: "assign_signer", label: "Assign Signer", number: 1 },
	{ key: "select_types", label: "Select Types", number: 2 },
	{ key: "upload", label: "Upload Document", number: 3 },
	{ key: "plot_fields", label: "Plot Fields", number: 4 },
	{ key: "create_meeting", label: "Create Meeting", number: 5 },
]

export interface UploadPayload {
	file: File | null
	fileName: string
	notarizationType: NotarizationType
}

export interface SignerPayload {
	email: string
	firstName: string
	lastName: string
}

export interface PlotFieldsState {
	plotterOpened: boolean
	confirmed: boolean
	/** ENP placed signature/date fields before or outside the in-app plotter flow. */
	enpAlreadyPlotted: boolean
}

export interface MeetingPayload {
	date: string
	time: string
	notes: string
}

export type FixtureFailure =
	| "none"
	| "project_creation"
	| "add_signer"
	| "plotter_blocked"
	| "project_expired"

export const FIXTURE_FAILURE_OPTIONS: { value: FixtureFailure; label: string }[] = [
	{ value: "none", label: "No failure" },
	{ value: "project_creation", label: "Project creation fails" },
	{ value: "add_signer", label: "Add signer fails" },
	{ value: "plotter_blocked", label: "Plotter blocked" },
	{ value: "project_expired", label: "Project expired" },
]

export interface QuickSignState {
	step: WizardStep
	upload: UploadPayload
	/** QuickSign project id from API (set after create / retry). */
	projectId: string | null
	/** Human-readable label derived from project id. */
	projectRef: string | null
	/** Stored `qs_original` file id after upload (for retry without re-upload). */
	documentFileId: string | null
	signer: SignerPayload
	signerAdded: boolean
	documentTypeIds: string[]
	plotFields: PlotFieldsState
	meetingCreated: boolean
	meeting: MeetingPayload
	clientJoinLink: string
	enpJoinLink: string
	/** Principal/client URL (invite email). */
	signDocumentUrl: string
	enpSignDocumentUrl: string
	principalSignerStatus: {
		email: string
		name: string
		hasSigned: boolean
		signedAt: string | null
	} | null
	appointmentId: string | null
	signingComplete: boolean
	registrySynced: boolean
	fixtureFailure: FixtureFailure
	/** Machine-readable code from last API error (Flow 8 recovery). */
	errorCode: QuicksignErrorCode | null
	isLoading: boolean
	error: string | null
	/** Set when continuing an IEN document-review approval queue */
	reviewQueue: DocumentReviewQuicksignQueue | null
	ienFromReview: boolean
}

export function createInitialQuickSignState(): QuickSignState {
	return {
		step: "assign_signer",
		upload: {
			file: null,
			fileName: "",
			notarizationType: "acknowledgment",
		},
		projectId: null,
		projectRef: null,
		documentFileId: null,
		signer: { email: "", firstName: "", lastName: "" },
		signerAdded: false,
		documentTypeIds: [],
		plotFields: { plotterOpened: false, confirmed: false, enpAlreadyPlotted: false },
		meetingCreated: false,
		meeting: { date: "", time: "", notes: "" },
		clientJoinLink: "",
		enpJoinLink: "",
		signDocumentUrl: "",
		enpSignDocumentUrl: "",
		principalSignerStatus: null,
		appointmentId: null,
		signingComplete: false,
		registrySynced: false,
		fixtureFailure: "none",
		errorCode: null,
		isLoading: false,
		error: null,
		reviewQueue: null,
		ienFromReview: false,
	}
}
