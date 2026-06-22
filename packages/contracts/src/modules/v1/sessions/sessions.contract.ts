import { oc } from "@orpc/contract"
import { z } from "zod"

import { locationVerificationContract } from "./location-verification.contract.js"
import {
	CompleteSessionLivenessInputSchema,
	CompleteSessionLivenessResponseSchema,
	DocoChainPlotLinkResultSchema,
	DocoChainSignLinkResultSchema,
	EnableGuestSignerOutputSchema,
	GenerateDocoChainPlotLinkInputSchema,
	GenerateDocoChainSignLinkInputSchema,
	InitiateMeetingSigningInputSchema,
	InitiateMeetingSigningResultSchema,
	InviteSessionGuestInputSchema,
	InviteSessionGuestOutputSchema,
	IssueGuestJoinTokenInputSchema,
	IssueJoinTokenInputSchema,
	JoinTokenPayloadSchema,
	ListMeetingDocumentSignerAssignmentsInputSchema,
	ListMeetingDocumentSignerAssignmentsResultSchema,
	ListMeetingDocumentSignersInputSchema,
	ListMeetingDocumentSignersResultSchema,
	ListMeetingSignerParticipantsInputSchema,
	LobbyCheckInputSchema,
	LobbyCheckResultSchema,
	MarkMeetingDocumentPlottedInputSchema,
	MarkMeetingDocumentPlottedResultSchema,
	MarkSignedForCurrentUserInputSchema,
	MarkSignedForCurrentUserResultSchema,
	MeetingEnbSignatureRequestSchema,
	MeetingEnbSigningStatusSchema,
	MeetingIdSchema,
	MeetingSignerParticipantSchema,
	NotarialSessionSchema,
	SendSessionChatInputSchema,
	SessionChatMessageSchema,
	SessionIdSchema,
	SessionLivenessAppointmentInputSchema,
	SessionLivenessStatusSchema,
	SetMeetingDocumentSignersInputSchema,
	SignMeetingEnbEntryInputSchema,
	SignMeetingEnbEntryResultSchema,
	StartHostedLivenessResponseSchema,
	StartMeetingEnbSigningResultSchema,
	UpdateSessionStatusSchema,
} from "./sessions.schema.js"

/** Session room, chat, and in-meeting document signer configuration. */
export const sessionsContract = {
	list: oc
		.route({
			method: "GET",
			path: "/sessions",
			summary: "List notarial sessions for the current user",
			tags: ["Sessions"],
		})
		.output(z.array(NotarialSessionSchema)),

	get: oc
		.route({
			method: "GET",
			path: "/sessions/{id}",
			summary: "Get session room by ID",
			tags: ["Sessions"],
		})
		.input(SessionIdSchema)
		.output(NotarialSessionSchema),

	updateStatus: oc
		.route({
			method: "PUT",
			path: "/sessions/{id}/status",
			summary: "Update session status (ENP may end via completed/cancelled)",
			tags: ["Sessions"],
		})
		.input(UpdateSessionStatusSchema)
		.output(NotarialSessionSchema),

	lobbyCheck: oc
		.route({
			method: "POST",
			path: "/sessions/lobby-check",
			summary: "Pre-join lobby checks (typed outcome for UI)",
			tags: ["Sessions"],
		})
		.input(LobbyCheckInputSchema)
		.output(LobbyCheckResultSchema),

	startHostedLiveness: oc
		.route({
			method: "POST",
			path: "/sessions/liveness/start",
			summary: "Start HyperVerge hosted workflow_liveness for session lobby",
			tags: ["Sessions"],
		})
		.input(SessionLivenessAppointmentInputSchema)
		.output(StartHostedLivenessResponseSchema),

	getSessionLivenessStatus: oc
		.route({
			method: "GET",
			path: "/sessions/liveness/status",
			summary: "Check if user completed liveness for an appointment",
			tags: ["Sessions"],
		})
		.input(SessionLivenessAppointmentInputSchema)
		.output(SessionLivenessStatusSchema),

	completeSessionLiveness: oc
		.route({
			method: "POST",
			path: "/sessions/liveness/complete",
			summary: "Fetch HyperVerge /v1/output once after hosted liveness redirect",
			tags: ["Sessions"],
		})
		.input(CompleteSessionLivenessInputSchema)
		.output(CompleteSessionLivenessResponseSchema),

	issueJoinToken: oc
		.route({
			method: "POST",
			path: "/sessions/join-token",
			summary: "Mint LiveKit token for ENP or client after lobby checks",
			tags: ["Sessions"],
		})
		.input(IssueJoinTokenInputSchema)
		.output(JoinTokenPayloadSchema),

	issueGuestJoinToken: oc
		.route({
			method: "POST",
			path: "/sessions/guest/join-token",
			summary: "Mint LiveKit token for guest signer (Google + Hyperverge + invite)",
			tags: ["Sessions"],
		})
		.input(IssueGuestJoinTokenInputSchema)
		.output(JoinTokenPayloadSchema),

	enableGuestSigner: oc
		.route({
			method: "POST",
			path: "/sessions/{id}/guest-invite",
			summary: "Issue guest invite token (ENP, active session)",
			tags: ["Sessions"],
		})
		.input(SessionIdSchema)
		.output(EnableGuestSignerOutputSchema),

	inviteSessionGuest: oc
		.route({
			method: "POST",
			path: "/sessions/invite-guest",
			summary: "ENP invites principal or witness to session lobby (link + optional email)",
			tags: ["Sessions"],
		})
		.input(InviteSessionGuestInputSchema)
		.output(InviteSessionGuestOutputSchema),

	listSessionChat: oc
		.route({
			method: "GET",
			path: "/sessions/{id}/messages",
			summary: "List in-session chat messages",
			tags: ["Sessions"],
		})
		.input(SessionIdSchema)
		.output(z.array(SessionChatMessageSchema)),

	sendSessionChat: oc
		.route({
			method: "POST",
			path: "/sessions/{id}/messages",
			summary: "Send in-session chat message (persisted + WebSocket fan-out)",
			tags: ["Sessions"],
		})
		.input(SendSessionChatInputSchema)
		.output(SessionChatMessageSchema),

	listMeetingSignerParticipants: oc
		.route({
			method: "GET",
			path: "/sessions/meetings/{meetingId}/signer-participants",
			summary: "List users who may be assigned as signers for a live meeting (appointment id)",
			tags: ["Sessions"],
		})
		.input(ListMeetingSignerParticipantsInputSchema)
		.output(z.array(MeetingSignerParticipantSchema)),

	listMeetingDocumentSignerAssignments: oc
		.route({
			method: "GET",
			path: "/sessions/meetings/{meetingId}/documents/{documentId}/signer-assignments",
			summary: "Persisted signer assignments for a meeting document",
			tags: ["Sessions"],
		})
		.input(ListMeetingDocumentSignerAssignmentsInputSchema)
		.output(ListMeetingDocumentSignerAssignmentsResultSchema),

	setMeetingDocumentSigners: oc
		.route({
			method: "PUT",
			path: "/sessions/meetings/{meetingId}/documents/{documentId}/signers",
			summary: "Assign signers and signing order for a meeting document (ENP only)",
			tags: ["Sessions"],
		})
		.input(SetMeetingDocumentSignersInputSchema)
		.output(ListMeetingDocumentSignerAssignmentsResultSchema),

	listMeetingDocumentSigners: oc
		.route({
			method: "GET",
			path: "/sessions/meetings/{meetingId}/documents/{documentId}/signers",
			summary: "Signer roster with signing status for a meeting document",
			tags: ["Sessions"],
		})
		.input(ListMeetingDocumentSignersInputSchema)
		.output(ListMeetingDocumentSignersResultSchema),

	generateMeetingDocumentPlotLink: oc
		.route({
			method: "POST",
			path: "/sessions/meetings/{meetingId}/documents/{documentId}/plot-link",
			summary: "DocOnChain edit/draft plot link for ENP (place signature fields)",
			tags: ["Sessions"],
		})
		.input(GenerateDocoChainPlotLinkInputSchema)
		.output(DocoChainPlotLinkResultSchema),

	markMeetingDocumentPlotted: oc
		.route({
			method: "POST",
			path: "/sessions/meetings/{meetingId}/documents/{documentId}/mark-plotted",
			summary: "ENP confirms plotting finished for a meeting document",
			tags: ["Sessions"],
		})
		.input(MarkMeetingDocumentPlottedInputSchema)
		.output(MarkMeetingDocumentPlottedResultSchema),

	initiateMeetingSigning: oc
		.route({
			method: "POST",
			path: "/sessions/meetings/{meetingId}/documents/{documentId}/initiate-signing",
			summary: "Open DocOnChain plot or per-signer signing link",
			tags: ["Sessions"],
		})
		.input(InitiateMeetingSigningInputSchema)
		.output(InitiateMeetingSigningResultSchema),

	generateMeetingDocumentSignLink: oc
		.route({
			method: "POST",
			path: "/sessions/meetings/{meetingId}/documents/{documentId}/sign-link",
			summary: "Per-signer signing link (signer-owned DocOnChain token fallback)",
			tags: ["Sessions"],
		})
		.input(GenerateDocoChainSignLinkInputSchema)
		.output(DocoChainSignLinkResultSchema),

	markSignedForCurrentUser: oc
		.route({
			method: "POST",
			path: "/sessions/meetings/{meetingId}/documents/{documentId}/mark-signed",
			summary: "Mark current user as signed after DocOnChain popup closes",
			tags: ["Sessions"],
		})
		.input(MarkSignedForCurrentUserInputSchema)
		.output(MarkSignedForCurrentUserResultSchema),

	getMeetingEnbSigningStatus: oc
		.route({
			method: "GET",
			path: "/sessions/meetings/{meetingId}/enb-signing",
			summary: "ENB principal e-sign phase status for a live meeting",
			tags: ["Sessions"],
		})
		.input(MeetingIdSchema)
		.output(MeetingEnbSigningStatusSchema),

	startMeetingEnbSigning: oc
		.route({
			method: "POST",
			path: "/sessions/meetings/{meetingId}/enb-signing/start",
			summary: "ENP: create draft registry acts and open ENB signing for principals",
			tags: ["Sessions"],
		})
		.input(MeetingIdSchema)
		.output(StartMeetingEnbSigningResultSchema),

	listMeetingEnbSignatureRequests: oc
		.route({
			method: "GET",
			path: "/sessions/meetings/{meetingId}/enb-signing/requests",
			summary: "List ENB signature requests for a meeting",
			tags: ["Sessions"],
		})
		.input(MeetingIdSchema)
		.output(z.array(MeetingEnbSignatureRequestSchema)),

	signMeetingEnbEntry: oc
		.route({
			method: "POST",
			path: "/sessions/meetings/{meetingId}/enb-signing/sign",
			summary: "Principal signs an ENB entry during the live session",
			tags: ["Sessions"],
		})
		.input(SignMeetingEnbEntryInputSchema)
		.output(SignMeetingEnbEntryResultSchema),

	locationVerification: locationVerificationContract,
}
