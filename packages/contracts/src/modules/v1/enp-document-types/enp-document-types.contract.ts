import { oc } from "@orpc/contract"
import { z } from "zod"

import {
	CreateEnpDocumentTypeSchema,
	DeleteEnpDocumentTypeResponseSchema,
	EnpDocumentTypeIdSchema,
	EnpDocumentTypeSchema,
	ListEnpDocumentTypesInputSchema,
	UpdateEnpDocumentTypeSchema,
} from "./enp-document-types.schema.js"

export const enpDocumentTypesContract = {
	listForEnp: oc
		.route({
			method: "GET",
			path: "/enp-document-types",
			summary: "List ENP document types (for booking selection)",
			tags: ["ENP Document Types"],
		})
		.input(ListEnpDocumentTypesInputSchema)
		.output(z.array(EnpDocumentTypeSchema)),

	listMine: oc
		.route({
			method: "GET",
			path: "/enp-document-types/me",
			summary: "List my ENP document types (ENP only)",
			tags: ["ENP Document Types"],
		})
		.input(z.object({}).optional())
		.output(z.array(EnpDocumentTypeSchema)),

	create: oc
		.route({
			method: "POST",
			path: "/enp-document-types",
			summary: "Create ENP document type (ENP only)",
			tags: ["ENP Document Types"],
		})
		.input(CreateEnpDocumentTypeSchema)
		.output(EnpDocumentTypeSchema),

	update: oc
		.route({
			method: "PUT",
			path: "/enp-document-types/{id}",
			summary: "Update ENP document type (ENP only)",
			tags: ["ENP Document Types"],
		})
		.input(UpdateEnpDocumentTypeSchema)
		.output(EnpDocumentTypeSchema),

	delete: oc
		.route({
			method: "DELETE",
			path: "/enp-document-types/{id}",
			summary: "Delete ENP document type (ENP only)",
			tags: ["ENP Document Types"],
		})
		.input(EnpDocumentTypeIdSchema)
		.output(DeleteEnpDocumentTypeResponseSchema),
}
