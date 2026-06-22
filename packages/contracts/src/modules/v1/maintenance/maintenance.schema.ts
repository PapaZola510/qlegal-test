import { z } from "zod"

export const MaintenanceAudienceEnum = z.enum(["all", "enp", "client"])

export const MaintenanceWindowSchema = z.object({
	id: z.string(),
	title: z.string(),
	message: z.string(),
	audience: MaintenanceAudienceEnum,
	startsAt: z.string(),
	endsAt: z.string(),
	durationMinutes: z.number().int().positive(),
	createdAt: z.string(),
	updatedAt: z.string(),
})

export const CreateMaintenanceWindowSchema = z
	.object({
		title: z.string().min(1).max(120),
		message: z.string().min(1).max(2000),
		audience: MaintenanceAudienceEnum.default("all"),
		startsAt: z.string().datetime(),
		endsAt: z.string().datetime(),
	})
	.refine(
		v => new Date(v.endsAt).getTime() > new Date(v.startsAt).getTime(),
		"endsAt must be after startsAt"
	)

export const ListMaintenanceWindowsInputSchema = z.object({
	includePast: z.coerce.boolean().optional().default(false),
})

/** No filters — returns all active scheduled maintenance for the user's audience. */
export const UserMaintenanceNoticesInputSchema = z.object({}).default({})

export const MaintenanceWindowIdSchema = z.object({
	id: z.string().min(1),
})

export const MaintenanceDismissResponseSchema = z.object({
	ok: z.literal(true),
})

/** Live maintenance-mode kill-switch state (public). */
export const MaintenanceStatusSchema = z.object({
	enabled: z.boolean(),
	message: z.string().nullable(),
})

/** Admin payload to toggle the live maintenance-mode kill switch. */
export const SetMaintenanceModeSchema = z.object({
	enabled: z.boolean(),
	message: z.string().max(2000).optional(),
})

export type MaintenanceAudience = z.infer<typeof MaintenanceAudienceEnum>
export type MaintenanceWindow = z.infer<typeof MaintenanceWindowSchema>
export type CreateMaintenanceWindowInput = z.infer<typeof CreateMaintenanceWindowSchema>
export type MaintenanceStatus = z.infer<typeof MaintenanceStatusSchema>
export type SetMaintenanceModeInput = z.infer<typeof SetMaintenanceModeSchema>
