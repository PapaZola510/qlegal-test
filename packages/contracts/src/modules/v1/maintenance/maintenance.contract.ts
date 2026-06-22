import { oc } from "@orpc/contract"
import { z } from "zod"

import {
	CreateMaintenanceWindowSchema,
	ListMaintenanceWindowsInputSchema,
	MaintenanceDismissResponseSchema,
	MaintenanceStatusSchema,
	MaintenanceWindowIdSchema,
	MaintenanceWindowSchema,
	SetMaintenanceModeSchema,
	UserMaintenanceNoticesInputSchema,
} from "./maintenance.schema.js"

export const maintenanceContract = {
	listForAdmin: oc
		.route({
			method: "GET",
			path: "/admin/maintenance",
			summary: "List scheduled maintenance windows (admin)",
			tags: ["Maintenance"],
		})
		.input(ListMaintenanceWindowsInputSchema)
		.output(z.array(MaintenanceWindowSchema)),

	createForAdmin: oc
		.route({
			method: "POST",
			path: "/admin/maintenance",
			summary: "Create scheduled maintenance window (admin)",
			tags: ["Maintenance"],
		})
		.input(CreateMaintenanceWindowSchema)
		.output(MaintenanceWindowSchema),

	cancelForAdmin: oc
		.route({
			method: "DELETE",
			path: "/admin/maintenance/{id}",
			summary: "Cancel scheduled maintenance window (admin)",
			tags: ["Maintenance"],
		})
		.input(MaintenanceWindowIdSchema)
		.output(MaintenanceDismissResponseSchema),

	completeForAdmin: oc
		.route({
			method: "POST",
			path: "/admin/maintenance/{id}/complete",
			summary: "Mark maintenance window as done (admin)",
			tags: ["Maintenance"],
		})
		.input(MaintenanceWindowIdSchema)
		.output(MaintenanceDismissResponseSchema),

	listForUser: oc
		.route({
			method: "GET",
			path: "/maintenance/notices",
			summary: "List upcoming maintenance notices for the current user",
			tags: ["Maintenance"],
		})
		.input(UserMaintenanceNoticesInputSchema)
		.output(z.array(MaintenanceWindowSchema)),

	getStatus: oc
		.route({
			method: "GET",
			path: "/maintenance/status",
			summary: "Get live maintenance-mode kill-switch state (public)",
			tags: ["Maintenance"],
		})
		.input(z.object({}).default({}))
		.output(MaintenanceStatusSchema),

	setMode: oc
		.route({
			method: "POST",
			path: "/admin/maintenance/mode",
			summary: "Toggle live maintenance-mode kill switch (admin)",
			tags: ["Maintenance"],
		})
		.input(SetMaintenanceModeSchema)
		.output(MaintenanceStatusSchema),
}
