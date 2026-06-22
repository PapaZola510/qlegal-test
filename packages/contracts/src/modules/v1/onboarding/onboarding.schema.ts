import { z } from "zod"

import { OnboardingStepEnum } from "../shared/enums.js"

export const OnboardingProgressSchema = z.object({
	currentStep: OnboardingStepEnum,
	completedSteps: z.array(OnboardingStepEnum),
	isComplete: z.boolean(),
})

export const SubmitOnboardingStepSchema = z.object({
	step: OnboardingStepEnum,
	data: z.record(z.string(), z.unknown()),
})

export const OnboardingStepResultSchema = z.object({
	step: OnboardingStepEnum,
	success: z.boolean(),
	nextStep: OnboardingStepEnum.nullable(),
	message: z.string().optional(),
})

export const HypervergeWorkflowKindSchema = z.enum(["onboarding", "liveness"])

export const StartHypervergeAttemptInputSchema = z.object({
	/** `onboarding` = full ID + selfie KYC; `liveness` = selfie-only session lobby check. */
	workflow: HypervergeWorkflowKindSchema.default("onboarding"),
})

/** Server mints SDK credentials; `sdkToken` is null when Hyperverge API credentials are not configured (local dev). */
export const StartHypervergeAttemptResponseSchema = z.object({
	transactionId: z.string().min(1),
	sdkToken: z.string().nullable(),
	appId: z.string().nullable(),
	workflowId: z.string(),
	sdkVersion: z.string(),
})

export const EnpOnboardingGateResponseSchema = z.object({
	success: z.literal(true),
	onboardingStep: OnboardingStepEnum,
})

export const HypervergeSdkCallbackInputSchema = z.object({
	transactionId: z.string().min(1),
	/** Raw status from HyperVerge Web SDK callback (e.g. auto_approved, user_cancelled). */
	status: z.string().min(1),
})

export const HypervergeSdkCallbackResponseSchema = z.object({
	ok: z.literal(true),
})

export { StartLmsTrainingResponseSchema as StartQLearnCourseResponseSchema } from "../integration/integration.schema.js"
export type { StartLmsTrainingResponse as StartQLearnCourseResponse } from "../integration/integration.schema.js"

export type OnboardingProgress = z.infer<typeof OnboardingProgressSchema>
export type SubmitOnboardingStep = z.infer<typeof SubmitOnboardingStepSchema>
export type OnboardingStepResult = z.infer<typeof OnboardingStepResultSchema>
export type HypervergeWorkflowKind = z.infer<typeof HypervergeWorkflowKindSchema>
export type StartHypervergeAttemptInput = z.infer<typeof StartHypervergeAttemptInputSchema>
export type StartHypervergeAttemptResponse = z.infer<typeof StartHypervergeAttemptResponseSchema>
export type EnpOnboardingGateResponse = z.infer<typeof EnpOnboardingGateResponseSchema>
export type HypervergeSdkCallbackInput = z.infer<typeof HypervergeSdkCallbackInputSchema>
export type HypervergeSdkCallbackResponse = z.infer<typeof HypervergeSdkCallbackResponseSchema>
