import { oc } from "@orpc/contract"
import { z } from "zod"

import {
	AdvanceDocumentReviewQuicksignResponseSchema,
	ApproveDocumentReviewRequestResponseSchema,
	ApproveDocumentReviewRequestSchema,
	CreateDocumentReviewRequestSchema,
	DocumentReviewRequestIdSchema,
	DocumentReviewRequestSchema,
	RejectDocumentReviewRequestSchema,
} from "./document-review-requests.schema.js"

export const documentReviewRequestsContract = {
	list: oc
		.route({
			method: "GET",
			path: "/document-review-requests",
			summary: "List document review requests (scoped: client sees sent, ENP sees received)",
			tags: ["Document Review Requests"],
		})
		.output(z.array(DocumentReviewRequestSchema)),

	get: oc
		.route({
			method: "GET",
			path: "/document-review-requests/{id}",
			summary: "Get a document review request by ID",
			tags: ["Document Review Requests"],
		})
		.input(DocumentReviewRequestIdSchema)
		.output(DocumentReviewRequestSchema),

	create: oc
		.route({
			method: "POST",
			path: "/document-review-requests",
			summary: "Client creates a document review request and sends it to an ENP",
			tags: ["Document Review Requests"],
		})
		.input(CreateDocumentReviewRequestSchema)
		.output(DocumentReviewRequestSchema),

	approve: oc
		.route({
			method: "POST",
			path: "/document-review-requests/{id}/approve",
			summary:
				"ENP approves the review: REN creates a meeting, IEN starts a QuickSign document queue",
			tags: ["Document Review Requests"],
		})
		.input(ApproveDocumentReviewRequestSchema)
		.output(ApproveDocumentReviewRequestResponseSchema),

	advanceQuicksign: oc
		.route({
			method: "POST",
			path: "/document-review-requests/{id}/quicksign-next",
			summary:
				"After the current IEN QuickSign document is fully signed, start the next document from the same review",
			tags: ["Document Review Requests"],
		})
		.input(DocumentReviewRequestIdSchema)
		.output(AdvanceDocumentReviewQuicksignResponseSchema),

	reject: oc
		.route({
			method: "POST",
			path: "/document-review-requests/{id}/reject",
			summary: "ENP rejects the review with a reason",
			tags: ["Document Review Requests"],
		})
		.input(RejectDocumentReviewRequestSchema)
		.output(DocumentReviewRequestSchema),

	cancel: oc
		.route({
			method: "POST",
			path: "/document-review-requests/{id}/cancel",
			summary: "Client cancels their own pending review request",
			tags: ["Document Review Requests"],
		})
		.input(DocumentReviewRequestIdSchema)
		.output(DocumentReviewRequestSchema),
}
