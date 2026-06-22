import { oc } from "@orpc/contract"
import { z } from "zod"

import {
	ListAppointmentIenAttestationsSchema,
	ListIenAttestationsResponseSchema,
	RecordAppointmentIenAttestationSchema,
	ResolveIenSignUrlResponseSchema,
	ResolveIenSignUrlSchema,
} from "../ien-attestation/ien-attestation.schema.js"
import {
	AppointmentAttachmentSchema,
	AppointmentBookedDocumentTypeSchema,
	AppointmentIdSchema,
	AppointmentListResponseSchema,
	AppointmentSchema,
	CreateAppointmentSchema,
	CreateMeetingDocumentProjectInputSchema,
	CreateMeetingPaymentInputSchema,
	CreateMeetingPaymentResultSchema,
	DeclineBookingQuoteSchema,
	DeleteMeetingDocumentResultSchema,
	DeleteMeetingRecordingInputSchema,
	DirectorySearchSchema,
	LinkMeetingDocumentInputSchema,
	LinkMeetingRecordingInputSchema,
	ListAppointmentsInputSchema,
	MeetingDocumentFileInputSchema,
	MeetingPaymentBrandsSchema,
	MeetingPaymentStatusSchema,
	MeetingRecordingSchema,
	NotaryDirectoryEntrySchema,
	ResolveBookingInviteInputSchema,
	ResolvedBookingInviteSchema,
	RotateBookingInviteResponseSchema,
	SendBookingQuoteSchema,
	UpdateAppointmentStatusSchema,
	UpdateMeetingDocumentFeeInputSchema,
} from "./appointments.schema.js"

export const appointmentsContract = {
	searchDirectory: oc
		.route({
			method: "GET",
			path: "/appointments/directory",
			summary: "Search certified ENPs for booking",
			tags: ["Appointments"],
		})
		.input(DirectorySearchSchema)
		.output(z.array(NotaryDirectoryEntrySchema)),

	resolveBookingInvite: oc
		.route({
			method: "GET",
			path: "/appointments/booking-invite/resolve",
			summary: "Resolve ENP booking invite token",
			tags: ["Appointments"],
		})
		.input(ResolveBookingInviteInputSchema)
		.output(ResolvedBookingInviteSchema),

	rotateBookingInvite: oc
		.route({
			method: "POST",
			path: "/appointments/booking-invite",
			summary: "Rotate ENP booking invite link token",
			tags: ["Appointments"],
		})
		.output(RotateBookingInviteResponseSchema),

	list: oc
		.route({
			method: "GET",
			path: "/appointments",
			summary: "List appointments (paginated)",
			tags: ["Appointments"],
		})
		.input(ListAppointmentsInputSchema.optional())
		.output(AppointmentListResponseSchema),

	listAllMeetingRecordings: oc
		.route({
			method: "GET",
			path: "/appointments/meeting-recordings",
			summary: "List all stored meeting recordings accessible to the current user",
			tags: ["Appointments"],
		})
		.input(z.object({}).optional())
		.output(z.array(MeetingRecordingSchema)),

	get: oc
		.route({
			method: "GET",
			path: "/appointments/{id}",
			summary: "Get appointment by ID",
			tags: ["Appointments"],
		})
		.input(AppointmentIdSchema)
		.output(AppointmentSchema),

	listAttachments: oc
		.route({
			method: "GET",
			path: "/appointments/{id}/attachments",
			summary: "List file attachments linked to this appointment (for session review)",
			tags: ["Appointments"],
		})
		.input(AppointmentIdSchema)
		.output(z.array(AppointmentAttachmentSchema)),

	listBookedDocumentTypes: oc
		.route({
			method: "GET",
			path: "/appointments/{id}/booked-document-types",
			summary: "List ENP document types selected when this appointment was booked",
			tags: ["Appointments"],
		})
		.input(AppointmentIdSchema)
		.output(z.array(AppointmentBookedDocumentTypeSchema)),

	listMeetingRecordings: oc
		.route({
			method: "GET",
			path: "/appointments/{id}/meeting-recordings",
			summary: "List stored meeting recordings for this appointment",
			tags: ["Appointments"],
		})
		.input(AppointmentIdSchema)
		.output(z.array(MeetingRecordingSchema)),

	linkMeetingDocument: oc
		.route({
			method: "POST",
			path: "/appointments/{id}/meeting-documents",
			summary: "Link an uploaded file to the appointment during a live session (ENP only)",
			tags: ["Appointments"],
		})
		.input(LinkMeetingDocumentInputSchema)
		.output(AppointmentAttachmentSchema),

	createMeetingDocumentProject: oc
		.route({
			method: "POST",
			path: "/appointments/{id}/meeting-documents/{fileObjectId}/create-project",
			summary: "Provision DocOnChain project for a previously-linked meeting document (ENP only)",
			tags: ["Appointments"],
		})
		.input(CreateMeetingDocumentProjectInputSchema)
		.output(AppointmentAttachmentSchema),

	updateMeetingDocumentFee: oc
		.route({
			method: "PUT",
			path: "/appointments/{id}/meeting-documents/{fileObjectId}/fee",
			summary: "Update notarization fee for a meeting document (ENP only)",
			tags: ["Appointments"],
		})
		.input(UpdateMeetingDocumentFeeInputSchema)
		.output(AppointmentAttachmentSchema),

	deleteMeetingDocument: oc
		.route({
			method: "DELETE",
			path: "/appointments/{id}/meeting-documents/{fileObjectId}",
			summary: "Remove a meeting document before signers are assigned (ENP only)",
			tags: ["Appointments"],
		})
		.input(MeetingDocumentFileInputSchema)
		.output(DeleteMeetingDocumentResultSchema),

	linkMeetingRecording: oc
		.route({
			method: "POST",
			path: "/appointments/{id}/meeting-recordings",
			summary: "Link an uploaded session recording to this appointment (ENP only)",
			tags: ["Appointments"],
		})
		.input(LinkMeetingRecordingInputSchema)
		.output(MeetingRecordingSchema),

	deleteMeetingRecording: oc
		.route({
			method: "DELETE",
			path: "/appointments/{id}/meeting-recordings/{fileObjectId}",
			summary: "Delete a stored meeting recording (ENP only)",
			tags: ["Appointments"],
		})
		.input(DeleteMeetingRecordingInputSchema)
		.output(z.object({ ok: z.boolean() })),

	getMeetingPaymentStatus: oc
		.route({
			method: "GET",
			path: "/appointments/{id}/meeting-payment",
			summary: "Meeting session payment status (QRPH total for uploaded documents)",
			tags: ["Appointments"],
		})
		.input(AppointmentIdSchema)
		.output(MeetingPaymentStatusSchema),

	listMeetingPaymentBrands: oc
		.route({
			method: "GET",
			path: "/appointments/{id}/meeting-payment/brands",
			summary: "AltPayNet TLPE payment brands from GET /options with checkout process per brand",
			tags: ["Appointments"],
		})
		.input(AppointmentIdSchema)
		.output(MeetingPaymentBrandsSchema),

	createMeetingPayment: oc
		.route({
			method: "POST",
			path: "/appointments/{id}/meeting-payment",
			summary: "Create or refresh TLPE payment for meeting session fees (client only)",
			tags: ["Appointments"],
		})
		.input(CreateMeetingPaymentInputSchema)
		.output(CreateMeetingPaymentResultSchema),

	simulateMeetingPayment: oc
		.route({
			method: "POST",
			path: "/appointments/{id}/meeting-payment/simulate",
			summary:
				"Development only: mark meeting session payment succeeded (HitPay sandbox QRPH cannot be completed on hosted checkout)",
			tags: ["Appointments"],
		})
		.input(AppointmentIdSchema)
		.output(MeetingPaymentStatusSchema),

	create: oc
		.route({
			method: "POST",
			path: "/appointments",
			summary: "Create appointment",
			tags: ["Appointments"],
		})
		.input(CreateAppointmentSchema)
		.output(AppointmentSchema),

	updateStatus: oc
		.route({
			method: "PUT",
			path: "/appointments/{id}/status",
			summary: "Update appointment status",
			tags: ["Appointments"],
		})
		.input(UpdateAppointmentStatusSchema)
		.output(AppointmentSchema),

	sendBookingQuote: oc
		.route({
			method: "POST",
			path: "/appointments/{id}/booking-quote",
			summary: "ENP sends per-document notarial act and fee quote to the client",
			tags: ["Appointments"],
		})
		.input(SendBookingQuoteSchema)
		.output(AppointmentSchema),

	acceptBookingQuote: oc
		.route({
			method: "POST",
			path: "/appointments/{id}/booking-quote/accept",
			summary: "Client accepts the ENP booking quote",
			tags: ["Appointments"],
		})
		.input(AppointmentIdSchema)
		.output(AppointmentSchema),

	declineBookingQuote: oc
		.route({
			method: "POST",
			path: "/appointments/{id}/booking-quote/decline",
			summary: "Client declines the ENP booking quote",
			tags: ["Appointments"],
		})
		.input(DeclineBookingQuoteSchema)
		.output(AppointmentSchema),

	recordIenAttestation: oc
		.route({
			method: "POST",
			path: "/appointments/{id}/ien-attestation",
			summary: "IEN: signer acknowledges the notarial statement before DocOnChain signing",
			tags: ["Appointments"],
		})
		.input(RecordAppointmentIenAttestationSchema)
		.output(ListIenAttestationsResponseSchema),

	listIenAttestations: oc
		.route({
			method: "GET",
			path: "/appointments/{id}/ien-attestations",
			summary: "IEN: list recorded checkbox acknowledgments for an appointment document",
			tags: ["Appointments"],
		})
		.input(ListAppointmentIenAttestationsSchema)
		.output(ListIenAttestationsResponseSchema),

	resolveIenSignUrl: oc
		.route({
			method: "GET",
			path: "/appointments/{id}/ien-sign-url",
			summary: "IEN: resolve DocOnChain sign URL after the signer has acknowledged",
			tags: ["Appointments"],
		})
		.input(ResolveIenSignUrlSchema)
		.output(ResolveIenSignUrlResponseSchema),
}
