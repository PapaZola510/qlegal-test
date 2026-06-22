import { oc } from "@orpc/contract"
import { z } from "zod"

import { MeetingPaymentBrandsSchema } from "../appointments/appointments.schema.js"
import { EnbAccessRequestSchema } from "../registry/enb-compliance.schema.js"
import {
	CreateCtcPaymentInputSchema,
	CreateCtcPaymentResultSchema,
	CtcPaymentStatusSchema,
	CtcRequestIdSchema,
	RequestCertifiedTrueCopySchema,
	SignedDocumentSchema,
} from "./signed.schema.js"

export const signedContract = {
	listDocuments: oc
		.route({
			method: "GET",
			path: "/signed/documents",
			summary: "List completed signed documents for the current client",
			tags: ["Signed"],
		})
		.output(z.array(SignedDocumentSchema)),

	requestCertifiedTrueCopy: oc
		.route({
			method: "POST",
			path: "/signed/documents/certified-true-copy",
			summary: "Request a certified true copy of a notarized document from the ENP",
			tags: ["Signed"],
		})
		.input(RequestCertifiedTrueCopySchema)
		.output(EnbAccessRequestSchema),

	getCtcPaymentStatus: oc
		.route({
			method: "GET",
			path: "/signed/ctc/{requestId}/payment",
			summary: "Certified true copy AltPayNet payment status for the requesting client",
			tags: ["Signed"],
		})
		.input(CtcRequestIdSchema)
		.output(CtcPaymentStatusSchema),

	listCtcPaymentBrands: oc
		.route({
			method: "GET",
			path: "/signed/ctc/{requestId}/payment-brands",
			summary: "AltPayNet TLPE payment brands for a certified true copy request",
			tags: ["Signed"],
		})
		.input(CtcRequestIdSchema)
		.output(MeetingPaymentBrandsSchema),

	createCtcPayment: oc
		.route({
			method: "POST",
			path: "/signed/ctc/{requestId}/payment",
			summary: "Start AltPayNet checkout for a certified true copy request",
			tags: ["Signed"],
		})
		.input(CreateCtcPaymentInputSchema)
		.output(CreateCtcPaymentResultSchema),

	simulateCtcPayment: oc
		.route({
			method: "POST",
			path: "/signed/ctc/{requestId}/payment/simulate",
			summary: "Mark CTC payment as paid in TLPE sandbox (development only)",
			tags: ["Signed"],
		})
		.input(CtcRequestIdSchema)
		.output(CtcPaymentStatusSchema),
}
