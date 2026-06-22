import { oc } from "@orpc/contract"

import {
	LmsTrainingCertificateSchema,
	LmsTrainingProgressSchema,
	SimulateLmsCompletionResponseSchema,
	StartLmsTrainingResponseSchema,
	SyncAccountToLmsResponseSchema,
	SyncLmsCourseCompletionResponseSchema,
} from "./integration.schema.js"

/** QLegal routes that call QLearn's `/integration/*` APIs (draft ENP integration). */
export const integrationContract = {
	startTraining: oc
		.route({
			method: "POST",
			path: "/integration/lms/training/start",
			summary: "Upsert + enroll + SSO code (draft §1–§3), return QLearn redirect URL",
			tags: ["Integration"],
		})
		.output(StartLmsTrainingResponseSchema),

	syncAccount: oc
		.route({
			method: "POST",
			path: "/integration/lms/sync-account",
			summary: "Upsert + enroll only (draft §1–§2); no browser redirect / SSO code",
			tags: ["Integration"],
		})
		.output(SyncAccountToLmsResponseSchema),

	progress: oc
		.route({
			method: "GET",
			path: "/integration/lms/training/progress",
			summary: "Learner progress (draft §4)",
			tags: ["Integration"],
		})
		.output(LmsTrainingProgressSchema),

	certificate: oc
		.route({
			method: "GET",
			path: "/integration/lms/training/certificate",
			summary: "Certificate metadata (draft §5)",
			tags: ["Integration"],
		})
		.output(LmsTrainingCertificateSchema),

	syncCourseCompletion: oc
		.route({
			method: "POST",
			path: "/integration/lms/training/sync-completion",
			summary: "Mark ENP course complete when QLearn progress is completed/passed",
			tags: ["Integration"],
		})
		.output(SyncLmsCourseCompletionResponseSchema),

	simulateCompletion: oc
		.route({
			method: "POST",
			path: "/integration/lms/training/_dev/simulate-completion",
			summary: "DEV-ONLY: bypass QLearn and mark training complete locally",
			tags: ["Integration"],
		})
		.output(SimulateLmsCompletionResponseSchema),
}
