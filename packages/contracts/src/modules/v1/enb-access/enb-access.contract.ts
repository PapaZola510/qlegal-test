import { oc } from "@orpc/contract"
import { z } from "zod"

import {
	EnbAccessRequestSchema,
	EnbEntryLookupResultSchema,
	LookupEnbEntryForAccessSchema,
	SubmitVirtualEnbAccessRequestSchema,
} from "../registry/enb-compliance.schema.js"

export const enbAccessContract = {
	lookupEntry: oc
		.route({
			method: "POST",
			path: "/enb-access/lookup-entry",
			summary: "Look up an ENB entry before submitting a virtual inspect/copy request",
			tags: ["ENB Access"],
		})
		.input(LookupEnbEntryForAccessSchema)
		.output(EnbEntryLookupResultSchema),

	submitVirtualRequest: oc
		.route({
			method: "POST",
			path: "/enb-access/virtual-request",
			summary: "Virtually request to inspect or copy ENB entries through the ENF",
			tags: ["ENB Access"],
		})
		.input(SubmitVirtualEnbAccessRequestSchema)
		.output(EnbAccessRequestSchema),

	listMyRequests: oc
		.route({
			method: "GET",
			path: "/enb-access/my-requests",
			summary: "List ENB inspect/copy requests submitted by the current user",
			tags: ["ENB Access"],
		})
		.output(z.array(EnbAccessRequestSchema)),
}
