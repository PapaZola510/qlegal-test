import { oc } from "@orpc/contract"
import { z } from "zod"

import {
	BulkScSyncInputSchema,
	BulkScSyncResultSchema,
	CreateEnbAccessRequestSchema,
	CreateRegistryActSchema,
	DecideEnbAccessRequestSchema,
	EnbAccessRequestSchema,
	FinalizeSessionDraftInputSchema,
	ProtestProceedingsSchema,
	RecordIncompleteActSchema,
	RefreshRegistryNotarizedDocumentResultSchema,
	RegistryActIdSchema,
	RegistryActSchema,
	SubmitMonthlyNotarialBookResultSchema,
	SubmitMonthlyNotarialBookSchema,
	UpsertProtestProceedingsSchema,
} from "./registry.schema.js"

export const registryContract = {
	list: oc
		.route({
			method: "GET",
			path: "/registry",
			summary: "List registry acts",
			tags: ["Registry"],
		})
		.output(z.array(RegistryActSchema)),

	// Static GET paths must be registered before `/registry/{id}` so they are not captured as an act id.
	listEnbAccessRequests: oc
		.route({
			method: "GET",
			path: "/registry/enb-access-requests",
			summary: "List ENB inspect/copy requests (Rule 24-10-14-SC c)",
			tags: ["Registry"],
		})
		.output(z.array(EnbAccessRequestSchema)),

	create: oc
		.route({
			method: "POST",
			path: "/registry",
			summary: "Create registry act",
			tags: ["Registry"],
		})
		.input(CreateRegistryActSchema)
		.output(RegistryActSchema),

	finalizeSessionDraft: oc
		.route({
			method: "POST",
			path: "/registry/finalize-session-draft",
			summary: "Persist a finalized session notarial act into the registry",
			tags: ["Registry"],
		})
		.input(FinalizeSessionDraftInputSchema)
		.output(RegistryActSchema),

	bulkScSync: oc
		.route({
			method: "POST",
			path: "/registry/sc-sync",
			summary: "Bulk submit acts for SC sync",
			tags: ["Registry"],
		})
		.input(BulkScSyncInputSchema)
		.output(BulkScSyncResultSchema),

	recordIncompleteAct: oc
		.route({
			method: "POST",
			path: "/registry/incomplete",
			summary: "Record an incomplete notarial act in the ENB (Rule 24-10-14-SC b)",
			tags: ["Registry"],
		})
		.input(RecordIncompleteActSchema)
		.output(RegistryActSchema),

	createEnbAccessRequest: oc
		.route({
			method: "POST",
			path: "/registry/enb-access-requests",
			summary: "Log a request to inspect or copy ENB entries",
			tags: ["Registry"],
		})
		.input(CreateEnbAccessRequestSchema)
		.output(EnbAccessRequestSchema),

	decideEnbAccessRequest: oc
		.route({
			method: "POST",
			path: "/registry/enb-access-requests/decide",
			summary: "Grant or refuse an ENB inspect/copy request",
			tags: ["Registry"],
		})
		.input(DecideEnbAccessRequestSchema)
		.output(EnbAccessRequestSchema),

	upsertProtestProceedings: oc
		.route({
			method: "PUT",
			path: "/registry/protest-proceedings",
			summary: "Save protest proceedings (Rule 24-10-14-SC e)",
			tags: ["Registry"],
		})
		.input(UpsertProtestProceedingsSchema)
		.output(ProtestProceedingsSchema),

	submitMonthlyNotarialBook: oc
		.route({
			method: "POST",
			path: "/registry/monthly-book/submit",
			summary:
				"Submit a calendar-month notarial book to the Supreme Court Portal (SCP) or ENA archive",
			tags: ["Registry"],
		})
		.input(SubmitMonthlyNotarialBookSchema)
		.output(SubmitMonthlyNotarialBookResultSchema),

	get: oc
		.route({
			method: "GET",
			path: "/registry/{id}",
			summary: "Get registry act by ID",
			tags: ["Registry"],
		})
		.input(RegistryActIdSchema)
		.output(RegistryActSchema),

	refreshNotarizedDocument: oc
		.route({
			method: "POST",
			path: "/registry/{id}/refresh-notarized-document",
			summary: "Resolve notarized PDF from DocOnChain for a registry act",
			tags: ["Registry"],
		})
		.input(RegistryActIdSchema)
		.output(RefreshRegistryNotarizedDocumentResultSchema),

	getProtestProceedings: oc
		.route({
			method: "GET",
			path: "/registry/{id}/protest-proceedings",
			summary: "Get protest proceedings for a registry act",
			tags: ["Registry"],
		})
		.input(RegistryActIdSchema)
		.output(ProtestProceedingsSchema.nullable()),
}
