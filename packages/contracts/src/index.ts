/**
 * @repo/contracts
 * Shared oRPC contracts for type-safe API communication
 */

// Export version contracts and types
export * from "./contracts.js"

// Re-export useful types from @orpc packages for convenience
export type { ContractRouter } from "@orpc/contract"
export type {
	LegalTemplateDraft,
	TemplateId,
} from "./modules/v1/legal-templates/legal-templates.schema.js"
export { TemplateIdSchema } from "./modules/v1/legal-templates/legal-templates.schema.js"

// Commonly used inferred DTOs for web + services
export type {
	Appointment,
	AppointmentAttachment,
	AppointmentBookedDocumentType,
	AppointmentListResponse,
	AppointmentStatusCounts,
	MeetingRecording,
	MeetingDocumentTypePreset,
	CreateAppointment,
	DeclineBookingQuote,
	SendBookingQuote,
	BookingQuoteLineItem,
	DirectorySearchInput,
	ListAppointmentsInput,
	NotaryDirectoryEntry,
	ResolvedBookingInvite,
	MeetingFeeBreakdown,
	MeetingPaymentStatus,
	CreateMeetingPaymentResult,
	TlpePaymentBrand,
	MeetingPaymentBrands,
} from "./modules/v1/appointments/appointments.schema.js"
export {
	DirectorySearchSchema,
	MeetingDocumentTypePresetEnum,
} from "./modules/v1/appointments/appointments.schema.js"
export type {
	Conversation,
	DmPeer,
	DmPeerProfile,
	GetMessagesInput,
	Message,
	MessageListResponse,
	SearchDmPeersInput,
	SendMessage,
} from "./modules/v1/messages/messages.schema.js"
export {
	DM_MESSAGE_MAX_LENGTH,
	DM_MESSAGES_DEFAULT_PAGE_SIZE,
} from "./modules/v1/messages/messages.schema.js"
export type {
	DocoChainPlotLinkResult,
	DocoChainSignLinkResult,
	InitiateMeetingSigningResult,
	InviteSessionGuestInput,
	JoinTokenPayload,
	ListMeetingDocumentSignerAssignmentsResult,
	ListMeetingDocumentSignersResult,
	LobbyCheckResult,
	MarkMeetingDocumentPlottedResult,
	MarkSignedForCurrentUserResult,
	MeetingEnbSignatureRequest,
	MeetingEnbSigningStatus,
	MeetingEnbSigningWsEvent,
	MeetingSignerParticipant,
	SignMeetingEnbEntryInput,
	NotarialSession,
	SessionChatMessage,
	SessionRecordingNotice,
	SessionGuestIntendedRole,
	SessionStatus,
} from "./modules/v1/sessions/sessions.schema.js"
export type {
	CheckVpnInput,
	CheckVpnResult,
	EmbassyLocation,
	LobbyLocationStatusInput,
	LobbyLocationStatusResult,
	LocationDebugInfo,
	LocationReason,
	LocationVerificationDetails,
	VerifyLocationInput,
	VerifyLocationResult,
} from "./modules/v1/sessions/location-verification.schema.js"
export type {
	CreateQuicksignProject,
	QuicksignErrorCode,
	QuicksignProject,
	SignatureField,
} from "./modules/v1/quicksign/quicksign.schema.js"
export type {
	CreateCtcPaymentResult,
	CtcPaymentStatus,
	RequestCertifiedTrueCopy,
	SignedDocument,
	SignedDocumentCtcRequest,
} from "./modules/v1/signed/signed.schema.js"
export type { VerifyDocumentResult } from "./modules/v1/verify/verify.schema.js"
export type {
	BulkScSyncResult,
	CreateRegistryAct,
	CreateEnbAccessRequest,
	DecideEnbAccessRequest,
	EnbAccessRequest,
	FinalizeSessionDraftInput,
	ProtestProceedings,
	RecordIncompleteAct,
	RegistryAct,
	SubmitMonthlyNotarialBook,
	SubmitMonthlyNotarialBookResult,
	UpsertProtestProceedings,
} from "./modules/v1/registry/registry.schema.js"
export type {
	CtcComplianceForm,
	CtcPaymentMethod,
	EnbEntryLookupResult,
	LookupEnbEntryForAccess,
	SubmitVirtualEnbAccessRequest,
} from "./modules/v1/registry/enb-compliance.schema.js"
export {
	formatEnbEntryNumber,
	parseDocumentNoFromActNumber,
	resolveNotarialBookFooterFields,
	type NotarialBookFooterFields,
} from "./utils/enb-entry-number.js"
export type {
	BootstrapRole,
	DismissCommissionExpiryWarning,
	DismissGovernmentIdExpiryWarning,
	SnoozeCommissionExpiryWarning,
	SnoozeGovernmentIdExpiryWarning,
	UpdateProfile,
	UserProfile,
} from "./modules/v1/auth-profile/auth-profile.schema.js"
export type { AdminRegistryOversightEntry, AdminUser } from "./modules/v1/admin/admin.schema.js"
export type {
	AccessLogEntry,
	AvRecording,
	ChainVerifyResult,
	CommissionRecord,
	ComplianceDateRange,
	ComplianceExportRequest,
	ComplianceExportResult,
	ComplianceListFilter,
	EnbEntry,
	EnbInspectFilter,
	EnbInspectResult,
	EnbSummary,
	NotarizedDocument,
	RequestEnbCopyInput,
	RequestEnbCopyResult,
} from "./modules/v1/compliance-audit/compliance-audit.schema.js"
export type {
	MaintenanceAudience,
	MaintenanceWindow,
	CreateMaintenanceWindowInput,
	MaintenanceStatus,
	SetMaintenanceModeInput,
} from "./modules/v1/maintenance/maintenance.schema.js"
export type {
	IenAttestationEntry,
	IenAttestationRole,
	ListIenAttestationsResponse,
	ResolveIenSignUrlResponse,
} from "./modules/v1/ien-attestation/ien-attestation.schema.js"
export {
	IEN_ATTESTATION_CHECKBOX_LABEL,
	IEN_ATTESTATION_ROLE_LABELS,
	IEN_ATTESTATION_TEXTS,
	ienAttestationTextForRole,
	meetingAttestationRoleForUser,
	notarialAttestationChannel,
	notarialAttestationTextFor,
	requiresNotarialAttestation,
	witnessAttestationApplies,
} from "./modules/v1/ien-attestation/ien-attestation-texts.js"
export type {
	NotarialAttestationActType,
	NotarialAttestationSessionMode,
	NotarialAttestationSigningMode,
} from "./modules/v1/ien-attestation/notarial-attestation-texts.js"
export type {
	AdvanceDocumentReviewQuicksignResponse,
	ApproveDocumentReviewQuicksignBootstrap,
	ApproveDocumentReviewRequest,
	ApproveDocumentReviewRequestResponse,
	CreateDocumentReviewRequest,
	DocumentReviewApprovalPath,
	DocumentReviewQuicksignQueue,
	DocumentReviewRequest,
	DocumentReviewRequestFile,
	RejectDocumentReviewRequest,
} from "./modules/v1/document-review-requests/document-review-requests.schema.js"
export type {
	DenyEnpCommissionApplication,
	EnpCommission,
	EnpCommissionApplication,
	EnpCommissionApplicationDocument,
	EnpCommissionSummaryHearing,
	GrantEnpCommissionApplication,
	ScheduleEnpCommissionSummaryHearing,
	SubmitEnpCommissionApplication,
} from "./modules/v1/enp-commission-applications/enp-commission-applications.schema.js"
export type {
	CommissionHearing,
	CommissionHearingChatMessage,
	CommissionHearingId,
	CommissionHearingJoinToken,
	CommissionHearingJoinTokenInput,
	CommissionHearingLobbyCheckInput,
	CommissionHearingLobbyCheckResult,
	CommissionHearingOpposition,
	CommissionHearingOppositionStatus,
	CommissionHearingParticipantRole,
	CommissionHearingPaymentStatus,
	CommissionHearingRecordingStarted,
	CommissionHearingRecordingStopped,
	CommissionHearingStatus,
	DecideCommissionHearingOpposition,
	FileCommissionHearingOpposition,
	InviteCommissionApplicant,
	InviteCommissionApplicantResult,
	SendCommissionHearingChat,
} from "./modules/v1/commission-hearings/commission-hearings.schema.js"
export type {
	CreateEnpDocumentType,
	EnpDocumentType,
	ListEnpDocumentTypesInput,
	UpdateEnpDocumentType,
} from "./modules/v1/enp-document-types/enp-document-types.schema.js"
export type { SubOrg } from "./modules/v1/sub-orgs/sub-orgs.schema.js"
export type { UserRole } from "./modules/v1/shared/enums.js"
export type {
	HypervergeSdkCallbackInput,
	HypervergeWorkflowKind,
	OnboardingProgress,
	StartHypervergeAttemptResponse,
	StartQLearnCourseResponse,
} from "./modules/v1/onboarding/onboarding.schema.js"
export type {
	LmsDemoCredentials,
	LmsTrainingCertificate,
	LmsTrainingProgress,
	StartLmsTrainingResponse,
	SyncAccountToLmsResponse,
} from "./modules/v1/integration/integration.schema.js"
