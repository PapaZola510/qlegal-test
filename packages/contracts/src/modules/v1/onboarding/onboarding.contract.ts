import { oc } from "@orpc/contract"

import {
	EnpOnboardingGateResponseSchema,
	HypervergeSdkCallbackInputSchema,
	HypervergeSdkCallbackResponseSchema,
	OnboardingProgressSchema,
	OnboardingStepResultSchema,
	StartHypervergeAttemptInputSchema,
	StartHypervergeAttemptResponseSchema,
	StartQLearnCourseResponseSchema,
	SubmitOnboardingStepSchema,
} from "./onboarding.schema.js"

export const onboardingContract = {
	progress: oc
		.route({
			method: "GET",
			path: "/onboarding/progress",
			summary: "Get onboarding progress",
			tags: ["Onboarding"],
		})
		.output(OnboardingProgressSchema),

	submitStep: oc
		.route({
			method: "POST",
			path: "/onboarding/step",
			summary: "Submit an onboarding step",
			tags: ["Onboarding"],
		})
		.input(SubmitOnboardingStepSchema)
		.output(OnboardingStepResultSchema),

	startHypervergeAttempt: oc
		.route({
			method: "POST",
			path: "/onboarding/hyperverge/start",
			summary: "Start a Hyperverge identity attempt (mint SDK token, persist transaction row)",
			tags: ["Onboarding"],
		})
		.input(StartHypervergeAttemptInputSchema)
		.output(StartHypervergeAttemptResponseSchema),

	syncHypervergeSdkCallback: oc
		.route({
			method: "POST",
			path: "/onboarding/hyperverge/sdk-callback",
			summary: "Persist HyperVerge Web SDK callback outcome (parallel to webhook)",
			tags: ["Onboarding"],
		})
		.input(HypervergeSdkCallbackInputSchema)
		.output(HypervergeSdkCallbackResponseSchema),

	skipEnpKyc: oc
		.route({
			method: "POST",
			path: "/onboarding/enp/kyc/skip",
			summary: "Skip KYC for now (ENP onboarding); complete verification later from the dashboard",
			tags: ["Onboarding"],
		})
		.output(EnpOnboardingGateResponseSchema),

	completeCertificationCourse: oc
		.route({
			method: "POST",
			path: "/onboarding/enp/course/complete",
			summary: "Mark the read-through certification course complete (ENP)",
			tags: ["Onboarding"],
		})
		.output(EnpOnboardingGateResponseSchema),

	startQLearnCourse: oc
		.route({
			method: "POST",
			path: "/onboarding/enp/qlearn/start",
			summary:
				"Begin QLearn handoff: draft §1 upsert, §2 enroll, §3 SSO code — returns redirect URL",
			tags: ["Onboarding"],
		})
		.output(StartQLearnCourseResponseSchema),
}
