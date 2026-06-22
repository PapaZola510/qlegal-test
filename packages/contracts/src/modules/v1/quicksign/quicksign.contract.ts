import { oc } from "@orpc/contract"
import { z } from "zod"

import {
	ListIenAttestationsResponseSchema,
	ListQuicksignIenAttestationsSchema,
	RecordQuicksignIenAttestationSchema,
} from "../ien-attestation/ien-attestation.schema.js"
import {
	CreateQuicksignProjectSchema,
	QuicksignAddSignerSchema,
	QuicksignFinalizeResponseSchema,
	QuicksignFinalizeSchema,
	QuicksignIdSchema,
	QuicksignPlotLinkResponseSchema,
	QuicksignProjectSchema,
	SignatureFieldsInputSchema,
	SignatureFieldsResponseSchema,
	StampSignatureInputSchema,
	StampSignatureResponseSchema,
} from "./quicksign.schema.js"

export const quicksignContract = {
	list: oc
		.route({
			method: "GET",
			path: "/quicksign",
			summary: "List QuickSign projects for the authenticated ENP",
			tags: ["QuickSign"],
		})
		.output(z.array(QuicksignProjectSchema)),

	get: oc
		.route({
			method: "GET",
			path: "/quicksign/{id}",
			summary: "Get QuickSign project by ID",
			tags: ["QuickSign"],
		})
		.input(QuicksignIdSchema)
		.output(QuicksignProjectSchema),

	/** Step 1 — create DB row and DOCONCHAIN project from an uploaded `qs_original` file (D2). */
	create: oc
		.route({
			method: "POST",
			path: "/quicksign",
			summary: "Create QuickSign project (upload + DOCONCHAIN project)",
			tags: ["QuickSign"],
		})
		.input(CreateQuicksignProjectSchema)
		.output(QuicksignProjectSchema),

	/** Step 2 — register client signer; triggers DOCONCHAIN invite email when configured. */
	addSigner: oc
		.route({
			method: "POST",
			path: "/quicksign/{id}/signers",
			summary: "Add signer to QuickSign project",
			tags: ["QuickSign"],
		})
		.input(QuicksignAddSignerSchema)
		.output(QuicksignProjectSchema),

	/** Step 3a — short plotter link (do not follow redirects server-side). */
	getPlotLink: oc
		.route({
			method: "POST",
			path: "/quicksign/{id}/plot-link",
			summary: "Get DOCONCHAIN plotter short link",
			tags: ["QuickSign"],
		})
		.input(QuicksignIdSchema)
		.output(QuicksignPlotLinkResponseSchema),

	/** Step 3b — ENP confirms plotting finished (recovery when popup blocked). */
	completePlotting: oc
		.route({
			method: "POST",
			path: "/quicksign/{id}/plotting/complete",
			summary: "Mark field plotting complete",
			tags: ["QuickSign"],
		})
		.input(QuicksignIdSchema)
		.output(QuicksignProjectSchema),

	/** Step 3c — save signature field coordinates (replaces DocOnChain plotter). */
	saveSignatureFields: oc
		.route({
			method: "PUT",
			path: "/quicksign/{id}/plotting/fields",
			summary: "Save signature field positions placed by the ENP",
			tags: ["QuickSign"],
		})
		.input(SignatureFieldsInputSchema)
		.output(QuicksignProjectSchema),

	/** Step 3d — get saved signature field coordinates. */
	getSignatureFields: oc
		.route({
			method: "GET",
			path: "/quicksign/{id}/plotting/fields",
			summary: "Get saved signature field positions for a project",
			tags: ["QuickSign"],
		})
		.input(QuicksignIdSchema)
		.output(SignatureFieldsResponseSchema),

	/** Retry DOCONCHAIN project creation with the same uploaded file (no re-upload). */
	retryDcProject: oc
		.route({
			method: "POST",
			path: "/quicksign/{id}/retry-dc",
			summary: "Retry DOCONCHAIN project creation",
			tags: ["QuickSign"],
		})
		.input(QuicksignIdSchema)
		.output(QuicksignProjectSchema),

	recordIenAttestation: oc
		.route({
			method: "POST",
			path: "/quicksign/{id}/ien-attestation",
			summary: "IEN: ENP acknowledges the notarial certification before sending signing links",
			tags: ["QuickSign"],
		})
		.input(RecordQuicksignIenAttestationSchema)
		.output(ListIenAttestationsResponseSchema),

	listIenAttestations: oc
		.route({
			method: "GET",
			path: "/quicksign/{id}/ien-attestations",
			summary: "IEN: list recorded checkbox acknowledgments for a QuickSign project",
			tags: ["QuickSign"],
		})
		.input(ListQuicksignIenAttestationsSchema)
		.output(ListIenAttestationsResponseSchema),

	/** Step 3e — stamp a PNG signature onto the local PDF copy. */
	stampSignature: oc
		.route({
			method: "POST",
			path: "/quicksign/{id}/stamp-signature",
			summary: "Stamp a PNG signature onto the local PDF for a signer",
			tags: ["QuickSign"],
		})
		.input(StampSignatureInputSchema)
		.output(StampSignatureResponseSchema),

	/** Step 4 — book `kind=quicksign` appointment and link it to the project. */
	finalize: oc
		.route({
			method: "POST",
			path: "/quicksign/{id}/finalize",
			summary: "Create QuickSign appointment session",
			tags: ["QuickSign"],
		})
		.input(QuicksignFinalizeSchema)
		.output(QuicksignFinalizeResponseSchema),
}
