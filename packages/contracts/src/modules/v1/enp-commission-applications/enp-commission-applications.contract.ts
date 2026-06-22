import { oc } from "@orpc/contract"
import { z } from "zod"

import {
	DenyEnpCommissionApplicationSchema,
	EnpCommissionApplicationIdSchema,
	EnpCommissionApplicationSchema,
	EnpCommissionSchema,
	GrantEnpCommissionApplicationSchema,
	ScheduleEnpCommissionSummaryHearingSchema,
	SubmitEnpCommissionApplicationSchema,
} from "./enp-commission-applications.schema.js"

export const enpCommissionApplicationsContract = {
	submit: oc
		.route({
			method: "POST",
			path: "/enp-commission-applications",
			summary: "ENP submits electronic notarial commission application package to ENA",
			tags: ["ENP Commission Applications"],
		})
		.input(SubmitEnpCommissionApplicationSchema)
		.output(EnpCommissionApplicationSchema),

	listMine: oc
		.route({
			method: "GET",
			path: "/enp-commission-applications/mine",
			summary: "List commission applications submitted by the authenticated ENP",
			tags: ["ENP Commission Applications"],
		})
		.output(z.array(EnpCommissionApplicationSchema)),

	listForReview: oc
		.route({
			method: "GET",
			path: "/enp-commission-applications/review-queue",
			summary: "ENA lists commission applications awaiting review",
			tags: ["ENP Commission Applications"],
		})
		.output(z.array(EnpCommissionApplicationSchema)),

	get: oc
		.route({
			method: "GET",
			path: "/enp-commission-applications/{id}",
			summary: "Get a commission application (applicant or ENA reviewer)",
			tags: ["ENP Commission Applications"],
		})
		.input(EnpCommissionApplicationIdSchema)
		.output(EnpCommissionApplicationSchema),

	scheduleSummaryHearing: oc
		.route({
			method: "POST",
			path: "/enp-commission-applications/{id}/schedule-summary-hearing",
			summary: "ENA schedules a virtual summary hearing for a commission application",
			tags: ["ENP Commission Applications"],
		})
		.input(ScheduleEnpCommissionSummaryHearingSchema)
		.output(EnpCommissionApplicationSchema),

	grant: oc
		.route({
			method: "POST",
			path: "/enp-commission-applications/{id}/grant",
			summary: "ENA grants an ENP commission application and issues a commission",
			tags: ["ENP Commission Applications"],
		})
		.input(GrantEnpCommissionApplicationSchema)
		.output(EnpCommissionApplicationSchema),

	deny: oc
		.route({
			method: "POST",
			path: "/enp-commission-applications/{id}/deny",
			summary: "ENA denies an ENP commission application",
			tags: ["ENP Commission Applications"],
		})
		.input(DenyEnpCommissionApplicationSchema)
		.output(EnpCommissionApplicationSchema),

	getCommission: oc
		.route({
			method: "GET",
			path: "/enp-commission-applications/{id}/commission",
			summary: "Get the issued commission for an ENP commission application",
			tags: ["ENP Commission Applications"],
		})
		.input(EnpCommissionApplicationIdSchema)
		.output(EnpCommissionSchema),
}
