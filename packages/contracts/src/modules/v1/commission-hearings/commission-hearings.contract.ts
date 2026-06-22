import { oc } from "@orpc/contract"
import { z } from "zod"

import {
	CommissionHearingChatMessageSchema,
	CommissionHearingIdSchema,
	CommissionHearingJoinTokenInputSchema,
	CommissionHearingJoinTokenSchema,
	CommissionHearingLobbyCheckInputSchema,
	CommissionHearingLobbyCheckResultSchema,
	CommissionHearingOppositionApplicationIdSchema,
	CommissionHearingOppositionIdSchema,
	CommissionHearingOppositionSchema,
	CommissionHearingPaymentStatusSchema,
	CommissionHearingRecordingStartedSchema,
	CommissionHearingRecordingStoppedSchema,
	CommissionHearingSchema,
	DecideCommissionHearingOppositionSchema,
	FileCommissionHearingOppositionSchema,
	InviteCommissionApplicantResultSchema,
	InviteCommissionApplicantSchema,
	SendCommissionHearingChatSchema,
} from "./commission-hearings.schema.js"

const tags = ["Commission Hearings"]

export const commissionHearingsContract = {
	get: oc
		.route({
			method: "GET",
			path: "/commission-hearings/{id}",
			summary: "Get a commission hearing room",
			tags,
		})
		.input(CommissionHearingIdSchema)
		.output(CommissionHearingSchema),

	listMine: oc
		.route({
			method: "GET",
			path: "/commission-hearings/mine",
			summary: "List commission hearings for the authenticated applicant",
			tags,
		})
		.output(z.array(CommissionHearingSchema)),

	listForAdmin: oc
		.route({
			method: "GET",
			path: "/commission-hearings/admin-queue",
			summary: "List commission hearings for the authenticated admin",
			tags,
		})
		.output(z.array(CommissionHearingSchema)),

	openSession: oc
		.route({
			method: "POST",
			path: "/commission-hearings/{id}/open",
			summary: "Open an admin commission hearing and start server-side recording",
			tags,
		})
		.input(CommissionHearingIdSchema)
		.output(CommissionHearingSchema),

	endSession: oc
		.route({
			method: "POST",
			path: "/commission-hearings/{id}/end",
			summary: "End an admin commission hearing and stop server-side recording",
			tags,
		})
		.input(CommissionHearingIdSchema)
		.output(CommissionHearingSchema),

	issueJoinToken: oc
		.route({
			method: "POST",
			path: "/commission-hearings/{id}/join-token",
			summary: "Mint a LiveKit token for the admin host or applicant",
			tags,
		})
		.input(CommissionHearingJoinTokenInputSchema)
		.output(CommissionHearingJoinTokenSchema),

	inviteApplicant: oc
		.route({
			method: "POST",
			path: "/commission-hearings/{id}/invite",
			summary: "Invite the applicant to a commission hearing",
			tags,
		})
		.input(InviteCommissionApplicantSchema)
		.output(InviteCommissionApplicantResultSchema),

	lobbyCheck: oc
		.route({
			method: "POST",
			path: "/commission-hearings/{id}/lobby-check",
			summary: "Run minimal commission hearing lobby checks",
			tags,
		})
		.input(CommissionHearingLobbyCheckInputSchema)
		.output(CommissionHearingLobbyCheckResultSchema),

	recordingStarted: oc
		.route({
			method: "POST",
			path: "/commission-hearings/{id}/recording/started",
			summary: "Record commission hearing egress start bookkeeping",
			tags,
		})
		.input(CommissionHearingRecordingStartedSchema)
		.output(CommissionHearingSchema),

	recordingStopped: oc
		.route({
			method: "POST",
			path: "/commission-hearings/{id}/recording/stopped",
			summary: "Record commission hearing egress stop bookkeeping",
			tags,
		})
		.input(CommissionHearingRecordingStoppedSchema)
		.output(CommissionHearingSchema),

	getPaymentStatus: oc
		.route({
			method: "GET",
			path: "/commission-hearings/{id}/payment",
			summary: "Get commission hearing payment status",
			tags,
		})
		.input(CommissionHearingIdSchema)
		.output(CommissionHearingPaymentStatusSchema),

	createPayment: oc
		.route({
			method: "POST",
			path: "/commission-hearings/{id}/payment",
			summary: "Create commission hearing payment request",
			tags,
		})
		.input(CommissionHearingIdSchema)
		.output(CommissionHearingPaymentStatusSchema),

	simulatePayment: oc
		.route({
			method: "POST",
			path: "/commission-hearings/{id}/payment/simulate",
			summary: "Simulate commission hearing payment completion",
			tags,
		})
		.input(CommissionHearingIdSchema)
		.output(CommissionHearingPaymentStatusSchema),

	listChat: oc
		.route({
			method: "GET",
			path: "/commission-hearings/{id}/chat",
			summary: "List commission hearing chat messages",
			tags,
		})
		.input(CommissionHearingIdSchema)
		.output(z.array(CommissionHearingChatMessageSchema)),

	sendChat: oc
		.route({
			method: "POST",
			path: "/commission-hearings/{id}/chat",
			summary: "Send commission hearing chat message",
			tags,
		})
		.input(SendCommissionHearingChatSchema)
		.output(CommissionHearingChatMessageSchema),

	fileOpposition: oc
		.route({
			method: "POST",
			path: "/enp-commission-applications/{applicationId}/oppositions",
			summary: "File a verified opposition to an ENP commission application",
			tags,
		})
		.input(FileCommissionHearingOppositionSchema)
		.output(CommissionHearingOppositionSchema),

	listOppositions: oc
		.route({
			method: "GET",
			path: "/enp-commission-applications/{applicationId}/oppositions",
			summary: "List oppositions for an ENP commission application",
			tags,
		})
		.input(CommissionHearingOppositionApplicationIdSchema)
		.output(z.array(CommissionHearingOppositionSchema)),

	forwardOpposition: oc
		.route({
			method: "POST",
			path: "/commission-hearings/{id}/oppositions/{oppositionId}/forward",
			summary: "Forward an opposition to the applicant",
			tags,
		})
		.input(CommissionHearingOppositionIdSchema)
		.output(CommissionHearingOppositionSchema),

	grantOppositorAccess: oc
		.route({
			method: "POST",
			path: "/commission-hearings/{id}/oppositions/{oppositionId}/grant-access",
			summary: "Grant an oppositor access to a commission hearing",
			tags,
		})
		.input(CommissionHearingOppositionIdSchema)
		.output(InviteCommissionApplicantResultSchema),

	decideOpposition: oc
		.route({
			method: "POST",
			path: "/commission-hearings/{id}/oppositions/{oppositionId}/decision",
			summary: "Record the ENA decision for an opposition",
			tags,
		})
		.input(DecideCommissionHearingOppositionSchema)
		.output(CommissionHearingOppositionSchema),
}
