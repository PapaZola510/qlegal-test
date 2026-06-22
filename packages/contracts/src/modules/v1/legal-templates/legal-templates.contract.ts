import { oc } from "@orpc/contract"
import { z } from "zod"

import {
	GetDraftInputSchema,
	LegalTemplateDraftSchema,
	UpsertDraftInputSchema,
} from "./legal-templates.schema.js"

export const legalTemplatesContract = {
	getDraft: oc
		.route({
			method: "GET",
			path: "/legal-templates/drafts/{templateId}",
			summary: "Get saved draft for a legal template",
			tags: ["Legal Templates"],
		})
		.input(GetDraftInputSchema)
		.output(LegalTemplateDraftSchema.nullable()),

	upsertDraft: oc
		.route({
			method: "PUT",
			path: "/legal-templates/drafts/{templateId}",
			summary: "Save (upsert) draft data for a legal template",
			tags: ["Legal Templates"],
		})
		.input(UpsertDraftInputSchema)
		.output(LegalTemplateDraftSchema),
}
