import {
	BadRequestException,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common"
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import { eq } from "drizzle-orm"

import { auditEvents, clientProfiles, enpProfiles, hypervergeTransactions } from "@repo/db/schema"

import { HypervergeKycLogsService } from "@/services/hyperverge/hyperverge-kyc-logs.service"
import {
	mergeTxnRawWithWebhook,
	workflowKindFromTxnRaw,
} from "@/services/hyperverge/hyperverge-workflow"
import { db } from "@/common/database/database.client"
import { env } from "@/config/env.config"

import { mapHypervergeStatusToDbStatus } from "./hyperverge-status-mapping"
import { syncGovernmentIdExpiryFromKyc } from "./lib/sync-government-id-expiry-from-kyc"

function readHeader(headers: Record<string, unknown>, name: string): string | undefined {
	const lower = name.toLowerCase()
	for (const [k, v] of Object.entries(headers)) {
		if (k.toLowerCase() === lower) {
			if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : undefined
			return typeof v === "string" ? v : undefined
		}
	}
	return undefined
}

function verifySignature(rawBody: Buffer, provided: string, secret: string): boolean {
	const normalized = provided.replace(/^sha256=/i, "").trim()
	const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
	const a = Buffer.from(expected, "utf8")
	const b = Buffer.from(normalized, "utf8")
	if (a.length !== b.length) return false
	return timingSafeEqual(a, b)
}

function extractStatusFromPayload(o: Record<string, unknown>): string {
	const direct = o.status ?? o.applicationStatus
	if (typeof direct === "string" && direct.length > 0) return direct
	const result = o.result
	if (result && typeof result === "object") {
		const r = result as Record<string, unknown>
		if (typeof r.status === "string") return r.status
		if (typeof r.applicationStatus === "string") return r.applicationStatus
	}
	return ""
}

function extractTransactionId(o: Record<string, unknown>): string {
	const id = o.transactionId ?? o.transaction_id ?? o.requestId ?? o.id
	return typeof id === "string" ? id : ""
}

@Injectable()
export class HypervergeWebhookService {
	constructor(private readonly hypervergeKycLogs: HypervergeKycLogsService) {}

	assertValidSignature(headers: Record<string, unknown>, rawBody: Buffer): void {
		const secret = env.HYPERVERGE_WEBHOOK_SECRET?.trim()
		if (!secret) {
			throw new UnauthorizedException("Hyperverge webhook is not configured")
		}
		const headerName = env.HYPERVERGE_WEBHOOK_SIGNATURE_HEADER?.trim() || "x-hyperverge-signature"
		const sig = readHeader(headers, headerName)
		if (!sig) {
			throw new UnauthorizedException("Missing webhook signature")
		}
		if (!verifySignature(rawBody, sig, secret)) {
			throw new UnauthorizedException("Invalid webhook signature")
		}
	}

	/**
	 * Authoritative identity outcome: updates `hyperverge_transactions`, denormalizes identity on `enp_profiles` or
	 * `client_profiles`, and increments `retake_count` on first-time failed processing per transaction row.
	 */
	async handleVerifiedJsonPayload(json: unknown): Promise<void> {
		if (!json || typeof json !== "object") {
			throw new BadRequestException("Invalid JSON body")
		}
		const o = json as Record<string, unknown>
		const transactionId = extractTransactionId(o)
		if (!transactionId) {
			throw new BadRequestException("Missing transaction id")
		}
		const hyperStatus = extractStatusFromPayload(o)
		if (!hyperStatus) {
			throw new BadRequestException("Missing status")
		}
		const dbStatus = mapHypervergeStatusToDbStatus(hyperStatus)

		const [txn] = await db
			.select()
			.from(hypervergeTransactions)
			.where(eq(hypervergeTransactions.hvTransactionId, transactionId))
			.limit(1)

		if (!txn) {
			throw new NotFoundException("Unknown transaction")
		}

		const now = new Date()
		const workflowKind = workflowKindFromTxnRaw(txn.rawResponseJson)
		const identityNext: "verified" | "failed" = dbStatus === "success" ? "verified" : "failed"
		const idempotentSkip = txn.webhookReceivedAt !== null && txn.status === dbStatus

		if (idempotentSkip) {
			if (identityNext === "verified" && workflowKind !== "liveness") {
				await syncGovernmentIdExpiryFromKyc(this.hypervergeKycLogs, txn.userId, transactionId)
			}
			return
		}
		const mergedRaw = mergeTxnRawWithWebhook(txn.rawResponseJson, o, workflowKind)

		await db.transaction(async tx => {
			await tx
				.update(hypervergeTransactions)
				.set({
					status: dbStatus,
					webhookReceivedAt: now,
					rawResponseJson: mergedRaw,
					updatedAt: now,
				})
				.where(eq(hypervergeTransactions.id, txn.id))

			const [enp] = await tx
				.select()
				.from(enpProfiles)
				.where(eq(enpProfiles.userId, txn.userId))
				.limit(1)
			const [client] = await tx
				.select()
				.from(clientProfiles)
				.where(eq(clientProfiles.userId, txn.userId))
				.limit(1)

			if (workflowKind === "liveness") {
				const auditSubOrgId = enp?.subOrgId ?? client?.subOrgId ?? null
				await tx.insert(auditEvents).values({
					id: randomUUID(),
					actorUserId: null,
					subOrgId: auditSubOrgId,
					eventType: "hyperverge_liveness_webhook",
					targetTable: "hyperverge_transactions",
					targetId: txn.id,
					payload: { status: dbStatus, transactionId, workflowKind },
					occurredAt: now,
				})
				return
			}

			const shouldBumpRetake =
				identityNext === "failed" && txn.webhookReceivedAt === null && txn.sdkCallbackAt === null

			let auditSubOrgId: string | null = null
			if (enp) {
				await tx
					.update(enpProfiles)
					.set({
						identityStatus: identityNext,
						latestHypervergeTxnId: txn.id,
						updatedAt: now,
						...(identityNext === "verified"
							? { identityVerifiedAt: now, identityLastExpiredAt: null }
							: { identityVerifiedAt: null }),
						...(shouldBumpRetake ? { retakeCount: enp.retakeCount + 1 } : {}),
					})
					.where(eq(enpProfiles.userId, txn.userId))
				auditSubOrgId = enp.subOrgId
			} else if (client) {
				await tx
					.update(clientProfiles)
					.set({
						identityStatus: identityNext,
						latestHypervergeTxnId: txn.id,
						updatedAt: now,
						...(identityNext === "verified"
							? { identityVerifiedAt: now, identityLastExpiredAt: null }
							: { identityVerifiedAt: null }),
						...(shouldBumpRetake ? { retakeCount: client.retakeCount + 1 } : {}),
					})
					.where(eq(clientProfiles.userId, txn.userId))
				auditSubOrgId = client.subOrgId ?? null
			} else {
				return
			}

			await tx.insert(auditEvents).values({
				id: randomUUID(),
				actorUserId: null,
				subOrgId: auditSubOrgId,
				eventType: "hyperverge_identity_webhook",
				targetTable: "hyperverge_transactions",
				targetId: txn.id,
				payload: { status: dbStatus, transactionId, identityStatus: identityNext },
				occurredAt: now,
			})
		})

		if (identityNext === "verified" && workflowKind !== "liveness") {
			await syncGovernmentIdExpiryFromKyc(this.hypervergeKycLogs, txn.userId, transactionId)
		}
	}
}
