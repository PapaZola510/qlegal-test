import { Injectable } from "@nestjs/common"

import {
	getHitpayPaymentRequest,
	type HitpayPaymentRequestStatus,
} from "./hitpay-get-payment-request"
import {
	createHitpayQrphPaymentRequest,
	type CreateHitpayQrphPaymentParams,
	type HitpayPaymentRequestResult,
} from "./hitpay-payment-request"
import { assertHitpayWebhookSignature } from "./hitpay-webhook"
import { hitpayConfigured } from "./hitpay.client"

@Injectable()
export class HitpayService {
	isConfigured(): boolean {
		return hitpayConfigured()
	}

	createQrphPaymentRequest(
		params: CreateHitpayQrphPaymentParams
	): Promise<HitpayPaymentRequestResult> {
		return createHitpayQrphPaymentRequest(params)
	}

	getPaymentRequest(requestId: string): Promise<HitpayPaymentRequestStatus> {
		return getHitpayPaymentRequest(requestId)
	}

	assertWebhookSignature(headers: Record<string, unknown>, rawBody: Buffer): void {
		assertHitpayWebhookSignature(headers, rawBody)
	}
}
