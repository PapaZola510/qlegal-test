import { oc } from "@orpc/contract"

import { VerifyDocumentInputSchema, VerifyDocumentResultSchema } from "./verify.schema.js"

export const verifyContract = {
	document: oc
		.route({
			method: "POST",
			path: "/verify/document",
			summary: "Verify a notarized document by Registry code",
			tags: ["Verify"],
			spec: spec => ({ ...spec, security: [] }),
		})
		.input(VerifyDocumentInputSchema)
		.output(VerifyDocumentResultSchema),
}
