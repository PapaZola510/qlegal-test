import { oc } from "@orpc/contract"
import { z } from "zod"

import {
	CreateSubOrgSchema,
	SubOrgIdSchema,
	SubOrgMemberSchema,
	SubOrgSchema,
} from "./sub-orgs.schema.js"

export const subOrgsContract = {
	list: oc
		.route({
			method: "GET",
			path: "/sub-orgs",
			summary: "List sub-organizations",
			tags: ["Sub-Organizations"],
		})
		.output(z.array(SubOrgSchema)),

	get: oc
		.route({
			method: "GET",
			path: "/sub-orgs/{id}",
			summary: "Get sub-organization by ID",
			tags: ["Sub-Organizations"],
		})
		.input(SubOrgIdSchema)
		.output(SubOrgSchema),

	create: oc
		.route({
			method: "POST",
			path: "/sub-orgs",
			summary: "Create sub-organization",
			tags: ["Sub-Organizations"],
		})
		.input(CreateSubOrgSchema)
		.output(SubOrgSchema),

	members: oc
		.route({
			method: "GET",
			path: "/sub-orgs/{id}/members",
			summary: "List sub-org members",
			tags: ["Sub-Organizations"],
		})
		.input(SubOrgIdSchema)
		.output(z.array(SubOrgMemberSchema)),
}
