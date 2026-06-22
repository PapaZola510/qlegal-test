import type { MeetingFeeBreakdown } from "@repo/contracts"

import { env } from "@/config/env.config"

function feeFromBps(amountPhp: number, bps: number): number {
	if (amountPhp <= 0 || bps <= 0) return 0
	return Math.round((amountPhp * bps) / 10_000)
}

/** Notarial document fees → convenience, HitPay processing, VAT, and client total (PHP integers). */
export function computeMeetingPaymentBreakdown(notarialFeePhp: number): MeetingFeeBreakdown {
	const notarial = Math.max(0, Math.floor(notarialFeePhp))
	const convenienceFeePhp = feeFromBps(notarial, env.MEETING_CONVENIENCE_FEE_BPS)
	const preProcessing = notarial + convenienceFeePhp
	const processingPercent = feeFromBps(preProcessing, env.MEETING_HITPAY_QRPH_FEE_BPS)
	const processingFeePhp = Math.max(processingPercent, env.MEETING_HITPAY_QRPH_FEE_MIN_PHP)
	const vatBase = preProcessing + processingFeePhp
	const vatPhp = feeFromBps(vatBase, env.MEETING_VAT_BPS)
	const totalPhp = vatBase + vatPhp

	return {
		notarialFeePhp: notarial,
		convenienceFeePhp,
		processingFeePhp,
		vatPhp,
		totalPhp,
	}
}
