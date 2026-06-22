import { Injectable } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { ORPCError } from "@orpc/server"
import { and, eq } from "drizzle-orm"

import { auditEvents, clientProfiles, enpProfiles, hypervergeTransactions } from "@repo/db/schema"

import { HypervergeKycLogsService } from "@/services/hyperverge/hyperverge-kyc-logs.service"
import {
	workflowKindFromTxnRaw,
	type HypervergeWorkflowKind,
} from "@/services/hyperverge/hyperverge-workflow"
import { HypervergeClient } from "@/services/hyperverge/hyperverge.client"
import { db } from "@/common/database/database.client"
import type { V1Outputs } from "@/config/contract-types"
import {
	expireClientIdentityIfNeeded,
	expireEnpIdentityIfNeeded,
	expireIdentityIfGovernmentIdExpired,
} from "@/modules/v1/auth-profile/lib/expire-enp-identity-if-needed"
import { IntegrationService } from "@/modules/v1/integration/integration.service"

import { deriveOnboardingStep } from "./derive-onboarding-step"
import { mapHypervergeStatusToDbStatus } from "./hyperverge-status-mapping"
import { syncGovernmentIdExpiryFromKyc } from "./lib/sync-government-id-expiry-from-kyc"

const STEP_ORDER = [
	"profile",
	"client_profile",
	"professional_profile",
	"identity_verification",
	"certification_course",
	"certificate_upload",
	"commission_details",
	"review",
	"complete",
] as const

type OnboardingStepKey = (typeof STEP_ORDER)[number]
type OnboardingProgressDto = V1Outputs["onboarding"]["progress"]
type StartAttemptDto = V1Outputs["onboarding"]["startHypervergeAttempt"]
type SdkCallbackDto = V1Outputs["onboarding"]["syncHypervergeSdkCallback"]

const FLOW_ENP = [
	"professional_profile",
	"certification_course",
	"certificate_upload",
	"commission_details",
	"complete",
] as const satisfies readonly OnboardingStepKey[]

function progressFlow(
	enp: typeof enpProfiles.$inferSelect | undefined,
	client: typeof clientProfiles.$inferSelect | undefined
): readonly OnboardingStepKey[] {
	if (!enp) return ["complete"] as const
	return FLOW_ENP
}

function completedStepsBefore(
	current: OnboardingStepKey,
	flow: readonly OnboardingStepKey[]
): OnboardingStepKey[] {
	const idx = flow.indexOf(current)
	if (idx <= 0) return []
	return flow.slice(0, idx) as OnboardingStepKey[]
}

@Injectable()
export class OnboardingService {
	constructor(
		private readonly hypervergeClient: HypervergeClient,
		private readonly integration: IntegrationService,
		private readonly hypervergeKycLogs: HypervergeKycLogsService
	) {}

	async getProgress(userId: string): Promise<OnboardingProgressDto> {
		let [enpRow] = await db
			.select()
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, userId))
			.limit(1)
		let [clientRow] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)

		await expireIdentityIfGovernmentIdExpired(userId)
		if (enpRow) {
			await expireEnpIdentityIfNeeded(userId)
			;[enpRow] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		}
		if (clientRow) {
			await expireClientIdentityIfNeeded(userId)
			;[clientRow] = await db
				.select()
				.from(clientProfiles)
				.where(eq(clientProfiles.userId, userId))
				.limit(1)
		}

		const currentStep = deriveOnboardingStep(enpRow, clientRow) as OnboardingStepKey
		const flow = progressFlow(enpRow, clientRow)
		return {
			currentStep,
			completedSteps: completedStepsBefore(currentStep, [...flow]),
			isComplete: currentStep === "complete",
		}
	}

	async submitStep(userId: string, step: string, _data: Record<string, unknown>) {
		const progress = await this.getProgress(userId)
		const stepTyped = step as OnboardingStepKey
		if (!STEP_ORDER.includes(stepTyped)) {
			throw new ORPCError("BAD_REQUEST", { message: "Invalid onboarding step" })
		}
		if (stepTyped !== progress.currentStep) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Cannot submit "${stepTyped}" while current step is "${progress.currentStep}"`,
			})
		}

		if (stepTyped === "identity_verification") {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Identity verification is completed via the Hyperverge SDK and server webhook; use startHypervergeAttempt then wait for verification.",
			})
		}

		if (stepTyped === "profile") {
			const [enpRow] = await db
				.select()
				.from(enpProfiles)
				.where(eq(enpProfiles.userId, userId))
				.limit(1)
			const [clientRow] = await db
				.select()
				.from(clientProfiles)
				.where(eq(clientProfiles.userId, userId))
				.limit(1)
			if (clientRow) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Profile bootstrap step applies before a client profile exists.",
				})
			}
			if (!enpRow || !enpRow.firstName?.trim() || !enpRow.lastName?.trim()) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Complete your ENP profile (name) before marking the profile step done.",
				})
			}
			const next = (await this.getProgress(userId)).currentStep
			return {
				step: stepTyped,
				success: true,
				nextStep: next === "complete" ? null : next,
				message: "Profile requirements satisfied.",
			}
		}

		if (stepTyped === "client_profile") {
			const [c] = await db
				.select()
				.from(clientProfiles)
				.where(eq(clientProfiles.userId, userId))
				.limit(1)
			if (!c?.phoneE164?.trim()) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Add a phone number on your profile before continuing.",
				})
			}
			const next = (await this.getProgress(userId)).currentStep
			return {
				step: stepTyped,
				success: true,
				nextStep: next === "complete" ? null : next,
				message: "Client profile complete.",
			}
		}

		throw new ORPCError("NOT_IMPLEMENTED", {
			message: "This onboarding step is driven by other modules (certification, commission, etc.).",
		})
	}

	async startHypervergeAttempt(
		userId: string,
		workflow: HypervergeWorkflowKind = "onboarding"
	): Promise<StartAttemptDto> {
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		const [client] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		if (!enp && !client) {
			throw new ORPCError("FORBIDDEN", {
				message: "No workspace profile found for identity verification.",
			})
		}

		const attempt = await this.hypervergeClient.startAttempt(userId, workflow)
		const now = new Date()

		await db.insert(hypervergeTransactions).values({
			userId,
			hvTransactionId: attempt.transactionId,
			status: "started",
			rawResponseJson: { workflowKind: workflow, workflowId: attempt.workflowId },
			createdAt: now,
			updatedAt: now,
		})

		return {
			transactionId: attempt.transactionId,
			sdkToken: attempt.sdkToken,
			appId: attempt.appId,
			workflowId: attempt.workflowId,
			sdkVersion: attempt.sdkVersion,
		}
	}

	async syncHypervergeSdkCallback(
		userId: string,
		input: { transactionId: string; status: string }
	): Promise<SdkCallbackDto> {
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		const [client] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		if (!enp && !client) {
			throw new ORPCError("FORBIDDEN", {
				message: "No workspace profile found for identity verification.",
			})
		}

		const tid = input.transactionId.trim()
		const [txn] = await db
			.select()
			.from(hypervergeTransactions)
			.where(
				and(
					eq(hypervergeTransactions.hvTransactionId, tid),
					eq(hypervergeTransactions.userId, userId)
				)
			)
			.limit(1)

		if (!txn) {
			throw new ORPCError("NOT_FOUND", { message: "Unknown transaction" })
		}

		const workflowKind = workflowKindFromTxnRaw(txn.rawResponseJson)
		const dbStatus = mapHypervergeStatusToDbStatus(input.status)
		const identityNext: "verified" | "failed" = dbStatus === "success" ? "verified" : "failed"
		const now = new Date()

		if (txn.sdkCallbackAt && txn.status === dbStatus) {
			if (identityNext === "verified" && workflowKind !== "liveness") {
				await syncGovernmentIdExpiryFromKyc(this.hypervergeKycLogs, txn.userId, tid)
			}
			return { ok: true as const }
		}

		const priorRaw = txn.rawResponseJson
		const mergedRaw =
			priorRaw && typeof priorRaw === "object" && !Array.isArray(priorRaw)
				? {
						...(priorRaw as Record<string, unknown>),
						workflowKind,
						sdkCallback: { status: input.status, at: now.toISOString() },
					}
				: { workflowKind, sdkCallback: { status: input.status, at: now.toISOString() } }

		await db.transaction(async tx => {
			await tx
				.update(hypervergeTransactions)
				.set({
					status: dbStatus,
					sdkCallbackAt: now,
					rawResponseJson: mergedRaw,
					updatedAt: now,
				})
				.where(eq(hypervergeTransactions.id, txn.id))

			const [enpRow] = await tx
				.select()
				.from(enpProfiles)
				.where(eq(enpProfiles.userId, txn.userId))
				.limit(1)
			const [clientRow] = await tx
				.select()
				.from(clientProfiles)
				.where(eq(clientProfiles.userId, txn.userId))
				.limit(1)

			if (workflowKind === "liveness") {
				const auditSubOrgId = enpRow?.subOrgId ?? clientRow?.subOrgId ?? null
				await tx.insert(auditEvents).values({
					id: randomUUID(),
					actorUserId: userId,
					subOrgId: auditSubOrgId,
					eventType: "hyperverge_liveness_sdk_callback",
					targetTable: "hyperverge_transactions",
					targetId: txn.id,
					payload: { status: dbStatus, transactionId: tid, workflowKind },
					occurredAt: now,
				})
				return
			}

			const shouldBumpRetake =
				identityNext === "failed" && txn.webhookReceivedAt === null && txn.sdkCallbackAt === null

			let auditSubOrgId: string | null = null
			if (enpRow) {
				await tx
					.update(enpProfiles)
					.set({
						identityStatus: identityNext,
						latestHypervergeTxnId: txn.id,
						updatedAt: now,
						...(identityNext === "verified"
							? { identityVerifiedAt: now, identityLastExpiredAt: null }
							: { identityVerifiedAt: null }),
						...(shouldBumpRetake ? { retakeCount: enpRow.retakeCount + 1 } : {}),
					})
					.where(eq(enpProfiles.userId, txn.userId))
				auditSubOrgId = enpRow.subOrgId
			} else if (clientRow) {
				await tx
					.update(clientProfiles)
					.set({
						identityStatus: identityNext,
						latestHypervergeTxnId: txn.id,
						updatedAt: now,
						...(identityNext === "verified"
							? { identityVerifiedAt: now, identityLastExpiredAt: null }
							: { identityVerifiedAt: null }),
						...(shouldBumpRetake ? { retakeCount: clientRow.retakeCount + 1 } : {}),
					})
					.where(eq(clientProfiles.userId, txn.userId))
				auditSubOrgId = clientRow.subOrgId ?? null
			} else {
				return
			}

			await tx.insert(auditEvents).values({
				id: randomUUID(),
				actorUserId: userId,
				subOrgId: auditSubOrgId,
				eventType: "hyperverge_identity_sdk_callback",
				targetTable: "hyperverge_transactions",
				targetId: txn.id,
				payload: { status: dbStatus, transactionId: tid, identityStatus: identityNext },
				occurredAt: now,
			})
		})

		if (identityNext === "verified" && workflowKind !== "liveness") {
			await syncGovernmentIdExpiryFromKyc(this.hypervergeKycLogs, txn.userId, tid)
		}

		return { ok: true as const }
	}

	async skipEnpKyc(userId: string) {
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		const [client] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		const now = new Date()

		if (enp) {
			throw new ORPCError("BAD_REQUEST", {
				message: "ENP identity verification is managed from Profile, not onboarding.",
			})
		}

		if (client) {
			const step = deriveOnboardingStep(undefined, client)
			if (step !== "identity_verification") {
				throw new ORPCError("BAD_REQUEST", {
					message: `KYC skip is only available during identity verification (current: ${step}).`,
				})
			}
			await db
				.update(clientProfiles)
				.set({ kycSkippedAt: now, updatedAt: now })
				.where(eq(clientProfiles.userId, userId))
			const next = deriveOnboardingStep(undefined, {
				...client,
				kycSkippedAt: now,
			}) as OnboardingStepKey
			return { success: true as const, onboardingStep: next }
		}

		throw new ORPCError("FORBIDDEN", { message: "No workspace profile found for KYC onboarding." })
	}

	async completeCertificationCourse(userId: string) {
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		if (!enp) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only ENP accounts can complete the certification course.",
			})
		}
		const step = deriveOnboardingStep(enp, undefined)
		if (step !== "certification_course") {
			throw new ORPCError("BAD_REQUEST", {
				message: `Course completion is only available on the certification course step (current: ${step}).`,
			})
		}
		const now = new Date()
		await db
			.update(enpProfiles)
			.set({ courseCompletedAt: now, updatedAt: now })
			.where(eq(enpProfiles.userId, userId))
		const next = deriveOnboardingStep(
			{ ...enp, courseCompletedAt: now },
			undefined
		) as OnboardingStepKey
		return { success: true as const, onboardingStep: next }
	}

	/** Draft §1–§3 via `IntegrationService.startTraining`. */
	async startQLearnCourse(userId: string) {
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		if (!enp) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only ENP accounts can start the QLearn certification course.",
			})
		}
		const step = deriveOnboardingStep(enp, undefined)
		if (step !== "certification_course") {
			throw new ORPCError("BAD_REQUEST", {
				message: `QLearn course is only available on the certification course step (current: ${step}).`,
			})
		}
		return this.integration.startTraining(userId)
	}
}
