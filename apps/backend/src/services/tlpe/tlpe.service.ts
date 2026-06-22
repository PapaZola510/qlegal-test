import { Injectable } from "@nestjs/common"

import { createEasyPaymentLink, type CreateEasyPaymentLinkInput } from "./tlpe-easy-payment-link"
import { parseTlpeNotifyBody, readTlpeNotifyHeader, type ParsedTlpeNotify } from "./tlpe-notify"
import { listTlpePaymentBrands } from "./tlpe-payment-brands"
import { syncTlpePayment, type TlpeSyncResult } from "./tlpe-sync"
import {
	tlpeAuthorizationHeader,
	tlpeConfigured,
	tlpeDevTestSimulateEnabled,
	tlpePaymentLinkConfigured,
	tlpeSecret,
	tlpeTestMode,
} from "./tlpe.client"

@Injectable()
export class TlpeService {
	isConfigured(): boolean {
		return tlpeConfigured()
	}

	isTestMode(): boolean {
		return tlpeTestMode()
	}

	isDevSimulateEnabled(): boolean {
		return tlpeDevTestSimulateEnabled()
	}

	/** Create a dynamic Easy Payment Link ([docs](https://developers.tlpe.io/easy-payment-link/)). */
	async createEasyPaymentLink(input: CreateEasyPaymentLinkInput) {
		if (!tlpePaymentLinkConfigured()) {
			throw new Error(
				"TLPE_PAYMENT_LINK_URL is not configured. AltPayNet Easy Payment Link is required for meeting and CTC payments."
			)
		}
		return createEasyPaymentLink(input)
	}

	async listPaymentBrands() {
		return listTlpePaymentBrands()
	}

	async syncPayment(transactionId: string): Promise<TlpeSyncResult> {
		return syncTlpePayment(transactionId)
	}

	parseNotifyBody(rawBody: string, headers?: Record<string, unknown>): ParsedTlpeNotify | null {
		const authorization =
			headers !== undefined
				? readTlpeNotifyHeader(headers, "authorization")
				: tlpeConfigured()
					? tlpeAuthorizationHeader()
					: undefined
		return parseTlpeNotifyBody(rawBody, tlpeSecret(), authorization)
	}
}
