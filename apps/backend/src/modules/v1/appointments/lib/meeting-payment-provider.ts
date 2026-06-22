import { hitpayConfigured, hitpayDevSandboxTestEnabled } from "@/services/hitpay/hitpay.client"
import type { HitpayService } from "@/services/hitpay/hitpay.service"
import { tlpeConfigured, tlpeDevTestSimulateEnabled } from "@/services/tlpe/tlpe.client"
import type { TlpeService } from "@/services/tlpe/tlpe.service"
import { env } from "@/config/env.config"

export type MeetingPaymentProviderName = "hitpay" | "tlpe"

export function getMeetingPaymentProvider(): MeetingPaymentProviderName {
	const raw = env.MEETING_PAYMENT_PROVIDER?.trim().toLowerCase()
	if (raw === "hitpay") return "hitpay"
	return "tlpe"
}

export function isMeetingPaymentProviderConfigured(
	provider: MeetingPaymentProviderName = getMeetingPaymentProvider()
): boolean {
	return provider === "hitpay" ? hitpayConfigured() : tlpeConfigured()
}

export function isMeetingPaymentDevSimulateAllowed(
	provider: MeetingPaymentProviderName = getMeetingPaymentProvider()
): boolean {
	return provider === "hitpay" ? hitpayDevSandboxTestEnabled() : tlpeDevTestSimulateEnabled()
}

export function meetingPaymentProviderLabel(provider: MeetingPaymentProviderName): string {
	return provider === "hitpay" ? "HitPay" : "AltPayNet TLPE"
}

export interface MeetingProviderServices {
	hitpay: HitpayService
	tlpe: TlpeService
}

export function assertActiveMeetingPaymentProviderConfigured(
	services: MeetingProviderServices
): MeetingPaymentProviderName {
	const provider = getMeetingPaymentProvider()
	if (!isMeetingPaymentProviderConfigured(provider)) {
		throw new Error(
			`${meetingPaymentProviderLabel(provider)} is not configured on this server (MEETING_PAYMENT_PROVIDER=${provider})`
		)
	}
	return provider
}
