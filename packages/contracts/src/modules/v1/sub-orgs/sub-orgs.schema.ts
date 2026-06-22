import { z } from "zod"

import { TimestampFields } from "../shared/schemas.js"

export const SubOrgKindEnum = z.enum(["personal", "firm"])

export const SubOrgSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	description: z.string().nullable(),
	logoUrl: z.string().nullable(),
	kind: SubOrgKindEnum,
	ownerName: z.string(),
	memberCount: z.number().int(),
	isActive: z.boolean(),
	...TimestampFields,
})

export const SubOrgMemberSchema = z.object({
	id: z.string(),
	userId: z.string(),
	subOrgId: z.string(),
	userName: z.string(),
	userEmail: z.string(),
	role: z.enum(["admin", "member"]),
	joinedAt: z.string(),
})

export const CreateSubOrgSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().optional(),
})

export const SubOrgIdSchema = z.object({
	id: z.coerce.string(),
})

export type SubOrg = z.infer<typeof SubOrgSchema>
export type SubOrgMember = z.infer<typeof SubOrgMemberSchema>
export type CreateSubOrg = z.infer<typeof CreateSubOrgSchema>
