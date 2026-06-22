import { Injectable, Logger } from "@nestjs/common"
import { createHash, randomUUID, timingSafeEqual } from "node:crypto"
import { ORPCError } from "@orpc/server"
import { and, desc, eq } from "drizzle-orm"

import {
	appointments,
	clientProfiles,
	enpProfiles,
	hypervergeTransactions,
	livenessValidations,
	sessionRoomGuests,
	sessionRooms,
	users,
} from "@repo/db/schema"

import {
	HypervergeKycLogsService,
	pickBestFaceImageUrlFromLogs,
} from "@/services/hyperverge/hyperverge-kyc-logs.service"
import {
	HypervergeLivenessService,
	type LivenessDecisionResult,
} from "@/services/hyperverge/hyperverge-liveness.service"
import { workflowKindFromTxnRaw } from "@/services/hyperverge/hyperverge-workflow"
import { db } from "@/common/database/database.client"
import type { V1Outputs } from "@/config/contract-types"
import { env, publicAppUrl } from "@/config/env.config"

type StartDto = V1Outputs["session"]["startHostedLiveness"]
type StatusDto = V1Outputs["session"]["getSessionLivenessStatus"]
type CompleteDto = V1Outputs["session"]["completeSessionLiveness"]

function webAppBaseUrl(): string {
	return env.CORS_ORIGINS.split(",")[0]?.trim() || "http://localhost:3001"
}

function generateLivenessTransactionId(userId: string): string {
	return `liveness_${userId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`.toUpperCase()
}

function sha256Hex(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex")
}

function stripDataUrlPrefix(base64OrDataUrl: string): string {
	if (base64OrDataUrl.startsWith("data:")) {
		const parts = base64OrDataUrl.split(",")
		return parts[1] ?? base64OrDataUrl
	}
	return base64OrDataUrl
}

@Injectable()
export class SessionLivenessService {
	private readonly logger = new Logger(SessionLivenessService.name)

	constructor(
		private readonly hypervergeLiveness: HypervergeLivenessService,
		private readonly hypervergeKycLogs: HypervergeKycLogsService
	) {}

	private async assertLobbyLivenessAccess(
		userId: string,
		appointmentId: string,
		guestInviteToken?: string
	) {
		const [apt] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!apt) throw new ORPCError("NOT_FOUND", { message: "Appointment not found" })
		if (apt.clientUserId === userId || apt.enpUserId === userId) return apt

		const [room] = await db
			.select({ id: sessionRooms.id })
			.from(sessionRooms)
			.where(eq(sessionRooms.appointmentId, appointmentId))
			.limit(1)
		if (room) {
			const [guest] = await db
				.select({ userId: sessionRoomGuests.userId })
				.from(sessionRoomGuests)
				.where(
					and(eq(sessionRoomGuests.sessionRoomId, room.id), eq(sessionRoomGuests.userId, userId))
				)
				.limit(1)
			if (guest) return apt
		}

		const token = guestInviteToken?.trim()
		if (token && room) {
			const ok = await this.verifyGuestInviteToken(room.id, token)
			if (ok) return apt
		}

		throw new ORPCError("FORBIDDEN", { message: "You cannot access this appointment" })
	}

	private async verifyGuestInviteToken(sessionRoomId: string, plaintext: string): Promise<boolean> {
		const [room] = await db
			.select({
				hash: sessionRooms.guestInviteTokenHash,
				exp: sessionRooms.guestInviteExpiresAt,
			})
			.from(sessionRooms)
			.where(eq(sessionRooms.id, sessionRoomId))
			.limit(1)
		if (!room?.hash || !room.exp) return false
		if (room.exp.getTime() < Date.now()) return false
		const hash = sha256Hex(plaintext)
		const a = Buffer.from(room.hash, "hex")
		const b = Buffer.from(hash, "hex")
		return a.length === b.length && timingSafeEqual(a, b)
	}

	private isIdentityVerified(
		enp: typeof enpProfiles.$inferSelect | undefined,
		client: typeof clientProfiles.$inferSelect | undefined
	): boolean {
		return enp?.identityStatus === "verified" || client?.identityStatus === "verified"
	}

	private async hasSuccessfulHyperverge(userId: string): Promise<boolean> {
		const [row] = await db
			.select({ id: hypervergeTransactions.id })
			.from(hypervergeTransactions)
			.where(
				and(eq(hypervergeTransactions.userId, userId), eq(hypervergeTransactions.status, "success"))
			)
			.orderBy(desc(hypervergeTransactions.createdAt))
			.limit(1)
		return !!row
	}

	private async fetchReferenceFromTransaction(hvTransactionId: string): Promise<string | null> {
		try {
			const logs = await this.hypervergeKycLogs.getKycLogs(hvTransactionId)
			const url = pickBestFaceImageUrlFromLogs(logs)
			if (!url) return null
			const dataUrl = await this.hypervergeKycLogs.fetchImageUrlAsDataUrl(url)
			return dataUrl ? stripDataUrlPrefix(dataUrl) : null
		} catch (e) {
			this.logger.warn(`Could not fetch KYC reference image for ${hvTransactionId}: ${String(e)}`)
			return null
		}
	}

	/** KYC face reference for workflow_liveness face-match (inputImage), when available. */
	private async resolveReferenceInputImage(userId: string): Promise<string | null> {
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		const [client] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)

		if (!this.isIdentityVerified(enp, client)) return null

		const profileTxnIds = [enp?.latestHypervergeTxnId, client?.latestHypervergeTxnId].filter(
			(id): id is string => Boolean(id)
		)
		for (const profileTxnId of profileTxnIds) {
			const [row] = await db
				.select({ hvTransactionId: hypervergeTransactions.hvTransactionId })
				.from(hypervergeTransactions)
				.where(eq(hypervergeTransactions.id, profileTxnId))
				.limit(1)
			if (row?.hvTransactionId) {
				const ref = await this.fetchReferenceFromTransaction(row.hvTransactionId)
				if (ref) return ref
			}
		}

		const recentTxns = await db
			.select()
			.from(hypervergeTransactions)
			.where(
				and(eq(hypervergeTransactions.userId, userId), eq(hypervergeTransactions.status, "success"))
			)
			.orderBy(desc(hypervergeTransactions.createdAt))
			.limit(15)

		for (const txn of recentTxns) {
			if (!txn.hvTransactionId) continue
			if (workflowKindFromTxnRaw(txn.rawResponseJson) === "liveness") continue
			const ref = await this.fetchReferenceFromTransaction(txn.hvTransactionId)
			if (ref) return ref
		}

		return null
	}

	private selfieOnlyAttemptConfig(
		base: Parameters<HypervergeLivenessService["startHostedWorkflow"]>[0]
	): Parameters<HypervergeLivenessService["startHostedWorkflow"]>[0] {
		const { inputs: _inputs, ...rest } = base
		return {
			...rest,
			validateWorkflowInputs: "no",
			allowEmptyWorkflowInputs: "yes",
		}
	}

	private async launchHostedWorkflow(
		attemptConfig: Parameters<HypervergeLivenessService["startHostedWorkflow"]>[0]
	): Promise<string> {
		const attempts: Parameters<HypervergeLivenessService["startHostedWorkflow"]>[0][] = [
			attemptConfig,
		]
		if (attemptConfig.inputs) {
			attempts.push(this.selfieOnlyAttemptConfig(attemptConfig))
		}

		let lastError: unknown
		for (const config of attempts) {
			try {
				const result = await this.hypervergeLiveness.startHostedWorkflow(config)
				const startUrl = result.result?.startKycUrl
				if (startUrl) return startUrl
			} catch (e) {
				lastError = e
				const msg = e instanceof Error ? e.message : String(e)
				const inputRelated =
					msg.toLowerCase().includes("input") ||
					msg.toLowerCase().includes("workflow inputs") ||
					msg.toLowerCase().includes("unexpected")
				if (!inputRelated) throw e
			}
		}
		if (lastError) throw lastError
		throw new Error("No startKycUrl returned from HyperVerge")
	}

	async startHostedLiveness(
		userId: string,
		appointmentId: string,
		guestInviteToken?: string,
		returnShell: "site" | "admin" = "site",
		returnPathOverride?: string
	): Promise<StartDto> {
		await this.assertLobbyLivenessAccess(userId, appointmentId, guestInviteToken)

		const transactionId = generateLivenessTransactionId(userId)
		const trimmedGuest = guestInviteToken?.trim()
		const returnParams = new URLSearchParams()
		if (trimmedGuest) returnParams.set("guest", trimmedGuest)
		const returnQuery = returnParams.toString()
		const lobbyPath =
			returnShell === "admin"
				? `/admin/appointments/${appointmentId}/lobby`
				: `/appointments/${appointmentId}/lobby`
		const safeReturnPath = returnPathOverride?.startsWith("/") ? returnPathOverride : undefined
		const returnPath = trimmedGuest
			? `${publicAppUrl().replace(/\/$/, "")}/appointments/${appointmentId}/meeting${returnQuery ? `?${returnQuery}` : ""}`
			: `${webAppBaseUrl()}${safeReturnPath ?? lobbyPath}`
		const callbackParams = new URLSearchParams({
			redirect: returnPath,
			appointmentId,
		})
		if (trimmedGuest) callbackParams.set("guest", trimmedGuest)
		const callbackUrl = `${webAppBaseUrl()}/appointments/liveness/callback?${callbackParams.toString()}`

		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		const [client] = await db
			.select()
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, userId))
			.limit(1)
		const [user] = await db
			.select({ platformRole: users.platformRole })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)
		const platformIdentityAllowed =
			user?.platformRole === "admin" ||
			user?.platformRole === "super_admin" ||
			user?.platformRole === "sub_org_admin"
		const identityVerified = platformIdentityAllowed || this.isIdentityVerified(enp, client)
		const guestKycComplete = trimmedGuest ? await this.hasSuccessfulHyperverge(userId) : false
		if (!identityVerified && !(trimmedGuest && guestKycComplete)) {
			throw new ORPCError("PRECONDITION_FAILED", {
				message: trimmedGuest
					? "Complete identity verification (government ID) in this session first, then run the liveness check."
					: "Complete identity verification on your Profile first, then run the session liveness check.",
			})
		}

		const referenceImage = await this.resolveReferenceInputImage(userId)

		const now = new Date()
		try {
			await db.insert(livenessValidations).values({
				id: randomUUID(),
				userId,
				appointmentId,
				transactionId,
				status: "pending",
				attemptNumber: 1,
				createdAt: now,
				updatedAt: now,
			})
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			if (msg.includes("liveness_validations") || msg.includes("does not exist")) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message:
						"Session liveness is not set up in the database yet. Run `pnpm db:push` from the repo root, then restart the API.",
				})
			}
			throw e
		}

		const workflowId = this.hypervergeLiveness.livenessWorkflowId()
		const baseAttempt = {
			workflowId,
			transactionId,
			redirectUrl: callbackUrl,
			forceLaunchSDK: "yes" as const,
		}

		let startUrl: string
		try {
			if (referenceImage) {
				startUrl = await this.launchHostedWorkflow({
					...baseAttempt,
					validateWorkflowInputs: "yes",
					allowEmptyWorkflowInputs: "yes",
					inputs: { inputImage: referenceImage },
				})
			} else {
				// Selfie-only workflow_liveness when no face reference is on file.
				startUrl = await this.launchHostedWorkflow({
					...baseAttempt,
					validateWorkflowInputs: "no",
					allowEmptyWorkflowInputs: "yes",
				})
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			if (!identityVerified) {
				throw new ORPCError("PRECONDITION_FAILED", {
					message:
						"Complete identity verification on your Profile first, then run the session liveness check again.",
				})
			}
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: msg || "Failed to start HyperVerge liveness workflow",
			})
		}

		return { redirectUrl: startUrl, transactionId, workflowId }
	}

	async getSessionLivenessStatus(
		userId: string,
		appointmentId: string,
		guestInviteToken?: string
	): Promise<StatusDto> {
		await this.assertLobbyLivenessAccess(userId, appointmentId, guestInviteToken)

		const [row] = await db
			.select()
			.from(livenessValidations)
			.where(
				and(
					eq(livenessValidations.userId, userId),
					eq(livenessValidations.appointmentId, appointmentId),
					eq(livenessValidations.status, "pass")
				)
			)
			.orderBy(desc(livenessValidations.createdAt))
			.limit(1)

		return {
			isVerified: !!row,
			verifiedAt: row?.createdAt?.toISOString() ?? null,
			transactionId: row?.transactionId ?? null,
		}
	}

	async completeSessionLiveness(
		userId: string,
		appointmentId: string,
		transactionId: string,
		guestInviteToken?: string
	): Promise<CompleteDto> {
		await this.assertLobbyLivenessAccess(userId, appointmentId, guestInviteToken)

		const tid = transactionId.trim()
		const [existing] = await db
			.select()
			.from(livenessValidations)
			.where(
				and(eq(livenessValidations.userId, userId), eq(livenessValidations.transactionId, tid))
			)
			.limit(1)

		if (!existing) {
			throw new ORPCError("NOT_FOUND", { message: "Unknown liveness transaction" })
		}

		if (existing.status === "pass" || existing.status === "fail") {
			const decision = existing.decisionJson as LivenessDecisionResult | null
			if (decision) {
				return {
					transactionId: tid,
					status: decision.isApproved ? "VERIFIED" : "REJECTED",
					decision,
				}
			}
		}

		const output = await this.hypervergeLiveness.getWorkflowOutput(tid)
		const decision = output.decision
		if (!decision) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "No decision returned from HyperVerge output",
			})
		}

		const now = new Date()
		await db
			.update(livenessValidations)
			.set({
				status: decision.isApproved ? "pass" : "fail",
				errorMessage: decision.isApproved ? null : decision.message,
				decisionJson: decision,
				rawResultJson: output,
				updatedAt: now,
			})
			.where(eq(livenessValidations.id, existing.id))

		return {
			transactionId: tid,
			status: decision.isApproved ? "VERIFIED" : "REJECTED",
			decision,
		}
	}
}
