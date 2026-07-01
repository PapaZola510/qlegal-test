import { z } from "zod"

import { QuicksignStatusEnum, SessionStatusEnum } from "../shared/enums.js"
import { TimestampFields } from "../shared/schemas.js"

export const SessionParticipantRoleSchema = z.enum(["enp", "client", "guest_signer"])

export const NotarialSessionSchema = z.object({
	id: z.string(),
	appointmentId: z.string(),
	livekitRoomName: z.string(),
	enpId: z.string(),
	clientId: z.string(),
	clientName: z.string(),
	status: SessionStatusEnum,
	startedAt: z.string().nullable(),
	endedAt: z.string().nullable(),
	recordingUrl: z.string().nullable(),
	documentIds: z.array(z.string()),
	notes: z.string().nullable(),
	...TimestampFields,
})

export const SessionIdSchema = z.object({
	id: z.coerce.string(),
})

export const UpdateSessionStatusSchema = z.object({
	id: z.coerce.string(),
	status: SessionStatusEnum,
	notes: z.string().optional(),
})

export const SessionGuestIntendedRoleSchema = z.enum(["principal", "witness"])

export const LobbyCheckInputSchema = z.object({
	appointmentId: z.string().uuid(),
	guestInviteToken: z.string().min(8).optional(),
})

export const LobbyCheckResultSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("unauthenticated") }),
	z.object({ kind: z.literal("not_found") }),
	z.object({ kind: z.literal("forbidden") }),
	z.object({ kind: z.literal("wrong_status"), status: z.string() }),
	z.object({ kind: z.literal("session_ended") }),
	z.object({ kind: z.literal("identity_required"), detail: z.string() }),
	z.object({ kind: z.literal("guest_requires_google") }),
	z.object({ kind: z.literal("guest_invite_invalid") }),
	z.object({ kind: z.literal("guest_invite_expired") }),
	z.object({
		kind: z.literal("ok"),
		sessionRoomId: z.string(),
		livekitRoomName: z.string(),
		participantRole: SessionParticipantRoleSchema,
		displayName: z.string(),
		appointmentTitle: z.string(),
		enpName: z.string(),
		/** Present for guest_signer lobby checks when the ENP chose a role at invite time. */
		guestIntendedRole: SessionGuestIntendedRoleSchema.optional(),
		/** HyperVerge onboarding completed (successful transaction on file). */
		guestKycComplete: z.boolean().optional(),
		/** Session-scoped liveness passed for this appointment. */
		guestLivenessComplete: z.boolean().optional(),
	}),
])

export const InviteSessionGuestInputSchema = z.object({
	appointmentId: z.string().uuid(),
	recipientEmail: z.string().email(),
	intendedRole: SessionGuestIntendedRoleSchema,
	sendEmail: z.boolean().default(true),
})

export const InviteSessionGuestOutputSchema = z.object({
	guestInviteToken: z.string(),
	expiresAt: z.string(),
	joinMeetingUrl: z.string().url(),
})

export const IssueJoinTokenInputSchema = z.object({
	appointmentId: z.string().uuid(),
})

export const SessionLivenessAppointmentInputSchema = z.object({
	appointmentId: z.string().uuid(),
	guestInviteToken: z.string().min(8).optional(),
	/** When set to `admin`, post-liveness redirect returns to `/admin/appointments/{id}/lobby`. */
	returnShell: z.enum(["site", "admin"]).optional(),
	/** Relative app path to return to after hosted liveness, used by non-appointment lobbies. */
	returnPath: z.string().startsWith("/").optional(),
})

export const StartHostedLivenessResponseSchema = z.object({
	redirectUrl: z.string().url(),
	transactionId: z.string().min(1),
	workflowId: z.string().min(1),
})

export const SessionLivenessStatusSchema = z.object({
	isVerified: z.boolean(),
	verifiedAt: z.string().nullable(),
	transactionId: z.string().nullable(),
})

export const LivenessDecisionSchema = z.object({
	isLive: z.boolean(),
	actionPassed: z.boolean(),
	isApproved: z.boolean(),
	message: z.string(),
	qualityIssues: z.array(z.string()),
	liveFaceValue: z.enum(["yes", "no", "unknown"]),
	summaryAction: z.enum(["pass", "fail", "unknown"]),
})

export const CompleteSessionLivenessInputSchema = z.object({
	appointmentId: z.string().uuid(),
	transactionId: z.string().min(1),
	guestInviteToken: z.string().min(8).optional(),
})

export const CompleteSessionLivenessResponseSchema = z.object({
	transactionId: z.string(),
	status: z.enum(["VERIFIED", "REJECTED"]),
	decision: LivenessDecisionSchema,
})

export const JoinTokenPayloadSchema = z.object({
	token: z.string(),
	livekitUrl: z.string(),
	livekitRoomName: z.string(),
	sessionRoomId: z.string(),
	participantRole: SessionParticipantRoleSchema,
	displayName: z.string(),
})

export const IssueGuestJoinTokenInputSchema = z.object({
	appointmentId: z.string().uuid(),
	guestInviteToken: z.string().min(8),
})

export const EnableGuestSignerOutputSchema = z.object({
	guestInviteToken: z.string(),
	expiresAt: z.string(),
})

export const SessionChatMessageSchema = z.object({
	id: z.string(),
	sessionRoomId: z.string(),
	senderUserId: z.string(),
	senderName: z.string(),
	body: z.string(),
	createdAt: z.string(),
})

export const SessionRecordingNoticeSchema = z.object({
	sessionRoomId: z.string().uuid(),
	status: z.enum(["started", "acknowledged", "stopped"]),
	senderUserId: z.string().optional(),
	senderRole: z.enum(["enp", "client", "guest_signer"]).optional(),
	senderDisplayName: z.string().optional(),
	startedAt: z.string().datetime().optional(),
})

export const SendSessionChatInputSchema = z.object({
	id: z.coerce.string(),
	body: z.string().min(1).max(4000),
})

export const MeetingNotarizationTypeSchema = z.enum([
	"ACKNOWLEDGMENT",
	"AFFIRMATION",
	"JURAT",
	"SIGNATURE_WITNESSING",
])

export const UploadMeetingDocumentInputSchema = z.object({
	meetingId: z.string().min(1),
	name: z.string().min(1, "Document name is required"),
	file: z.string().min(1), // base64
	mimeType: z.string().min(1),
	size: z.number().int().positive(),
	description: z.string().optional(),
	notarizationType: MeetingNotarizationTypeSchema,
	fees: z.number().positive(),
})

export const ImportVaultFolderFileSchema = z.object({
	name: z.string().min(1),
	path: z.string().min(1),
	file: z.string().min(1), // base64
	mimeType: z.string().min(1),
	size: z.number().int().positive(),
})

export const ImportVaultFolderToMeetingInputSchema = z.object({
	meetingId: z.string().min(1),
	folderId: z.string().min(1),
	notarizationType: MeetingNotarizationTypeSchema,
	description: z.string().optional(),
	fees: z.number().positive(),
	files: z.array(ImportVaultFolderFileSchema).max(200),
})

export const MeetingDocumentUploadResultSchema = z.object({
	fileObjectId: z.string(),
	documentName: z.string().optional(),
	notarizationType: MeetingNotarizationTypeSchema.optional(),
	fees: z.number().positive().optional(),
	sizeBytes: z.number().int().positive().optional(),
	quicksignProjectId: z.string().nullable(),
	docoChainProjectUuid: z.string().nullable(),
	docoChain: z.object({
		projectCreated: z.boolean(),
		pendingManual: z.boolean(),
	}),
})

export const ImportFolderSkippedFileSchema = z.object({
	name: z.string(),
	path: z.string(),
	reason: z.string(),
})

export const ImportVaultFolderToMeetingResultSchema = z.object({
	importedCount: z.number().int().nonnegative(),
	skipped: z.array(ImportFolderSkippedFileSchema),
	documents: z.array(MeetingDocumentUploadResultSchema),
	docoChain: z.object({
		projectCreated: z.boolean(),
		pendingManual: z.boolean(),
	}),
})

export const EnsureDocoChainTokenInputSchema = z.object({
	meetingId: z.string().min(1),
})

export const EnsureDocoChainTokenResultSchema = z.object({
	ready: z.boolean(),
})

export const CreateDocoChainProjectInputSchema = z.object({
	documentId: z.string().min(1),
	meetingId: z.string().min(1),
})

export const AddDocoChainProjectSignerInputSchema = z.object({
	documentId: z.string().min(1),
	meetingId: z.string().min(1),
	email: z.string().email(),
	firstName: z.string().min(1),
	lastName: z.string().min(1),
	sequence: z.number().int().positive().default(1),
})

export const GenerateDocoChainSignLinkInputSchema = z.object({
	documentId: z.string().min(1),
	meetingId: z.string().min(1),
	signerEmail: z.string().email(),
})

export const GenerateDocoChainPlotLinkInputSchema = z.object({
	documentId: z.string().min(1),
	meetingId: z.string().min(1),
})

const PlotSignatureFieldSchema = z.object({
	signerEmail: z.string().email(),
	pageIndex: z.number().int().min(0),
	x: z.number().min(0),
	y: z.number().min(0),
	width: z.number().min(1),
	height: z.number().min(1),
})

export const MarkMeetingDocumentPlottedInputSchema = z.object({
	documentId: z.string().min(1),
	meetingId: z.string().min(1),
	signatureFields: z.array(PlotSignatureFieldSchema).optional(),
})

/** After Signing window closes — marks meeting_signature_requests row SIGNED for the current user. */
export const MarkSignedForCurrentUserInputSchema = z.object({
	documentId: z.string().min(1),
	meetingId: z.string().min(1),
	/** Raw signature PNG (data-URI base64) for local stamping. */
	signaturePngBase64: z.string().optional(),
})

export const DocoChainSignLinkResultSchema = z.object({
	signLink: z.string().url(),
})

export const DocoChainPlotLinkResultSchema = z.object({
	// Relaxed from `.url()`: DC may return short redirect hosts before normalization.
	plotLink: z.string().min(1),
})

export const MarkMeetingDocumentPlottedResultSchema = z.object({
	ok: z.boolean(),
})

export const MarkSignedForCurrentUserResultSchema = z.object({
	ok: z.boolean(),
})

export const ListMeetingSignerParticipantsInputSchema = z.object({
	meetingId: z.string().min(1),
})

export const MeetingSignerParticipantSchema = z.object({
	userId: z.string(),
	displayName: z.string(),
	email: z.string().email(),
	role: z.enum(["enp", "client", "guest_signer"]),
})

export const ListMeetingDocumentSignersInputSchema = z.object({
	meetingId: z.string().min(1),
	documentId: z.string().min(1),
})

export const MeetingDocumentSignerStatusSchema = z.object({
	userId: z.string(),
	// Avoid `.email()` here: / legacy rows may hold non-RFC strings; strict validation caused HTTP 500 on listSigners.
	email: z.string().min(1),
	displayName: z.string(),
	sequence: z.number().int().nonnegative(),
	role: z.enum(["notary", "principal", "witness"]),
	signedAt: z.string().nullable(),
	status: z.enum(["signed", "current", "waiting"]),
})

export const InitiateMeetingSigningInputSchema = z
	.object({
		meetingId: z.string().min(1),
		documentId: z.string().min(1),
		email: z.string().email(),
		projectUuid: z.string().min(1).optional(),
		isPlotting: z.boolean().optional(),
	})
	.strict()

export const InitiateMeetingSigningResultSchema = z.object({
	projectUuid: z.string().min(1),
	link: z.string().min(1),
	kind: z.enum(["sign", "plot"]),
})

export const MeetingSignerAssignmentSchema = z.object({
	userId: z.string(),
	role: z.enum(["notary", "principal", "witness"]),
	signingOrder: z.number().int().positive(),
})

export const SetMeetingDocumentSignersInputSchema = z.object({
	meetingId: z.coerce.string(),
	documentId: z.string().min(1),
	signers: z
		.array(
			z.object({
				userId: z.string().min(1),
				role: z.enum(["notary", "principal", "witness"]),
			})
		)
		.min(1),
})

export const ListMeetingDocumentSignerAssignmentsInputSchema = z.object({
	meetingId: z.coerce.string(),
	documentId: z.string().min(1),
})

export const ListMeetingDocumentSignerAssignmentsResultSchema = z.object({
	signers: z.array(MeetingSignerAssignmentSchema),
})

export const ListMeetingDocumentSignersResultSchema = z.object({
	signers: z.array(MeetingDocumentSignerStatusSchema),
	/** Rows stored in QuickSign signer table for this document’s project */
	persistedSignerCount: z.number().int().nonnegative(),
	signedCount: z.number().int().nonnegative(),
	totalCount: z.number().int().nonnegative(),
	completed: z.boolean(),
	/** ISO8601 when ENP confirmed plotting finished in-meeting; null if not yet. */
	plotCompletedAt: z.string().nullable(),
	/** QuickSign project internal id — used to call saveSignatureFields. */
	projectId: z.string().nullable(),
	/** Authoritative create-project id — always read from server, never cached client UUID. */
	doconchainProjectUuid: z.string().nullable(),
	/**
	 * Runtime HTTPS URL to the sealed PDF (from vault `files[].file_url` or project GET).
	 * Resolved via `doconchainProjectUuid` only — Registry list row `uuid` is never persisted.
	 */
	// Relaxed from `.url()`: DC occasionally returns odd-but-fetchable URLs; strict output validation surfaced as HTTP 500.
	notarizedDocumentUrl: z.string().nullable(),
	/** QuickSign project status for this meeting document (`quicksign_projects.status`). */
	notarizationStatus: QuicksignStatusEnum.nullable(),
	/** Sealed PDF copied from into our object storage (`notarized_file_object_id`). */
	notarizedStoredInDb: z.boolean(),
	/** View/Download enabled when has published the sealed notarized PDF (`Document Completed` or vault completed). */
	notarizedPdfReady: z.boolean(),
})

export type NotarialSession = z.infer<typeof NotarialSessionSchema>
export type SessionStatus = z.infer<typeof SessionStatusEnum>
export type LobbyCheckResult = z.infer<typeof LobbyCheckResultSchema>
export type JoinTokenPayload = z.infer<typeof JoinTokenPayloadSchema>
export type SessionChatMessage = z.infer<typeof SessionChatMessageSchema>
export type SessionRecordingNotice = z.infer<typeof SessionRecordingNoticeSchema>
export type MeetingSignerParticipant = z.infer<typeof MeetingSignerParticipantSchema>
export type ListMeetingDocumentSignerAssignmentsResult = z.infer<
	typeof ListMeetingDocumentSignerAssignmentsResultSchema
>
export type ListMeetingDocumentSignersResult = z.infer<
	typeof ListMeetingDocumentSignersResultSchema
>
export type DocoChainPlotLinkResult = z.infer<typeof DocoChainPlotLinkResultSchema>
export type DocoChainSignLinkResult = z.infer<typeof DocoChainSignLinkResultSchema>
export type MarkMeetingDocumentPlottedResult = z.infer<
	typeof MarkMeetingDocumentPlottedResultSchema
>
export type InitiateMeetingSigningResult = z.infer<typeof InitiateMeetingSigningResultSchema>
export type MarkSignedForCurrentUserResult = z.infer<typeof MarkSignedForCurrentUserResultSchema>
export type SessionGuestIntendedRole = z.infer<typeof SessionGuestIntendedRoleSchema>
export type InviteSessionGuestInput = z.infer<typeof InviteSessionGuestInputSchema>

// --- Meeting ENB principal e-signing (Rule §4) ---

export const MeetingEnbSigningStatusEnum = z.enum(["not_started", "active", "completed"])

export const MeetingIdSchema = z.object({
	meetingId: z.coerce.string(),
})

export const MeetingEnbSignatureRequestSchema = z.object({
	id: z.string(),
	appointmentId: z.string(),
	registryActId: z.string(),
	signerUserId: z.string(),
	signerRole: z.enum(["principal", "witness"]),
	signerName: z.string(),
	entryNumber: z.string(),
	documentTitle: z.string(),
	status: z.enum(["pending", "signed"]),
	signatureAcknowledgment: z.string().nullable(),
	/** PNG data URL captured from the in-app signature pad. */
	signatureImageData: z.string().nullable(),
	signedAt: z.string().nullable(),
})

export const MeetingEnbSigningStatusSchema = z.object({
	appointmentId: z.string(),
	status: MeetingEnbSigningStatusEnum,
	startedAt: z.string().nullable(),
	completedAt: z.string().nullable(),
	totalRequests: z.number().int().nonnegative(),
	signedCount: z.number().int().nonnegative(),
	pendingCount: z.number().int().nonnegative(),
	/** Pending requests for the current user (empty for ENP unless they are also a signer). */
	myPending: z.array(MeetingEnbSignatureRequestSchema),
})

export const StartMeetingEnbSigningResultSchema = MeetingEnbSigningStatusSchema

export const SignMeetingEnbEntryInputSchema = z.object({
	meetingId: z.coerce.string(),
	requestId: z.string().min(1),
	/** Typed legal name attestation captured in-session. */
	signatureAcknowledgment: z.string().min(3).max(500),
	/** PNG data URL from in-app signature pad (required). */
	signatureImageData: z
		.string()
		.min(32)
		.max(600_000)
		.refine(v => v.startsWith("data:image/"), "Signature image must be a data URL"),
})

export const SignMeetingEnbEntryResultSchema = z.object({
	ok: z.boolean(),
	status: MeetingEnbSigningStatusSchema,
})

export const MeetingEnbSigningWsEventSchema = z.object({
	appointmentId: z.string(),
	status: MeetingEnbSigningStatusEnum,
	pendingCount: z.number().int().nonnegative(),
	signedCount: z.number().int().nonnegative(),
})

export const ReSignNotarizedDocumentInputSchema = z.object({
	meetingId: z.string().min(1),
	documentId: z.string().min(1),
})

export const ReSignNotarizedDocumentResultSchema = z.object({
	ok: z.boolean(),
})

export type MeetingEnbSigningStatus = z.infer<typeof MeetingEnbSigningStatusSchema>
export type MeetingEnbSignatureRequest = z.infer<typeof MeetingEnbSignatureRequestSchema>
export type MeetingEnbSigningWsEvent = z.infer<typeof MeetingEnbSigningWsEventSchema>
export type SignMeetingEnbEntryInput = z.infer<typeof SignMeetingEnbEntryInputSchema>
