import { Logger } from "@nestjs/common"
import { eq } from "drizzle-orm"

import { clientProfiles, enpProfiles } from "@repo/db/schema"

import type { HypervergeKycLogsService } from "@/services/hyperverge/hyperverge-kyc-logs.service"
import {
	extractExpiryDateFromLogs,
	pickOcrFieldsFromLogs,
} from "@/services/hyperverge/hyperverge-kyc-ocr"
import { db } from "@/common/database/database.client"

const log = new Logger("SyncGovernmentIdExpiryFromKyc")

/** HyperVerge Logs API is often empty right after SDK callback; retry before giving up. */
const LOGS_RETRY_DELAYS_MS = [0, 2000, 4000, 6000, 10000] as const

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

async function resolveExpiryYmdFromLogs(
	kycLogs: HypervergeKycLogsService,
	hvTransactionId: string,
	userId: string
): Promise<string | null> {
	let lastHadOcr = false

	for (const [attempt, delay] of LOGS_RETRY_DELAYS_MS.entries()) {
		if (delay > 0) await sleep(delay)

		try {
			const logs = await kycLogs.getKycLogs(hvTransactionId)
			const ocr = pickOcrFieldsFromLogs(logs)
			if (ocr) lastHadOcr = true

			const expiryYmd = extractExpiryDateFromLogs(logs)
			if (expiryYmd) {
				if (attempt > 0) {
					log.log(
						`GOV_ID_EXPIRY_OCR_READY_AFTER_RETRY userId=${userId} transactionId=${hvTransactionId} attempt=${attempt + 1}`
					)
				}
				return expiryYmd
			}

			if (lastHadOcr) {
				log.warn(
					`GOV_ID_EXPIRY_NOT_IN_OCR userId=${userId} transactionId=${hvTransactionId} attempt=${attempt + 1}`
				)
				return null
			}
		} catch (error) {
			log.warn(
				`GOV_ID_EXPIRY_LOGS_ATTEMPT_FAILED userId=${userId} transactionId=${hvTransactionId} attempt=${attempt + 1}: ${error instanceof Error ? error.message : String(error)}`
			)
		}
	}

	log.warn(`GOV_ID_EXPIRY_NO_OCR userId=${userId} transactionId=${hvTransactionId}`)
	return null
}

/**
 * After successful onboarding KYC, fetch HyperVerge OCR and persist government ID
 * expiration to the user's profile (`government_id_valid_until`).
 */
export async function syncGovernmentIdExpiryFromKyc(
	kycLogs: HypervergeKycLogsService,
	userId: string,
	hvTransactionId: string
): Promise<{ saved: boolean; expiryYmd: string | null }> {
	try {
		const expiryYmd = await resolveExpiryYmdFromLogs(kycLogs, hvTransactionId, userId)
		if (!expiryYmd) {
			return { saved: false, expiryYmd: null }
		}

		const validUntil = new Date(`${expiryYmd}T12:00:00.000Z`)
		const now = new Date()

		const [enp] = await db
			.select({ userId: enpProfiles.userId })
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, userId))
			.limit(1)

		if (enp) {
			await db
				.update(enpProfiles)
				.set({
					governmentIdValidUntil: validUntil,
					governmentIdExpiryNoticeDismissals: [],
					governmentIdExpiryNoticeSnoozeUntil: null,
					updatedAt: now,
				})
				.where(eq(enpProfiles.userId, userId))
		} else {
			const [client] = await db
				.select({ userId: clientProfiles.userId })
				.from(clientProfiles)
				.where(eq(clientProfiles.userId, userId))
				.limit(1)

			if (!client) {
				log.warn(`GOV_ID_EXPIRY_NO_PROFILE userId=${userId}`)
				return { saved: false, expiryYmd: null }
			}

			await db
				.update(clientProfiles)
				.set({
					governmentIdValidUntil: validUntil,
					governmentIdExpiryNoticeDismissals: [],
					governmentIdExpiryNoticeSnoozeUntil: null,
					updatedAt: now,
				})
				.where(eq(clientProfiles.userId, userId))
		}

		log.log(
			`GOV_ID_EXPIRY_SAVED_FROM_KYC userId=${userId} transactionId=${hvTransactionId} expiry=${expiryYmd}`
		)
		return { saved: true, expiryYmd }
	} catch (error) {
		log.warn(
			`GOV_ID_EXPIRY_SYNC_FAILED userId=${userId} transactionId=${hvTransactionId}: ${error instanceof Error ? error.message : String(error)}`
		)
		return { saved: false, expiryYmd: null }
	}
}
