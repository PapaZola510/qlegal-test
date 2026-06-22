import { env } from "@/config/env.config"

import { brandMatchKey } from "./tlpe-brand-availability"
import { tlpeRequest } from "./tlpe.client"

export interface TlpePaymentOption {
	code: string
	value: string
	image?: string
}

const QRPH_HINTS = ["qr ph", "qrph", "instapay", "pesonet"]

function normalizeOptionLabel(value: string): string {
	return value.trim().toLowerCase()
}

/** GET /options — payment brands available for checkout ([docs](https://developers.tlpe.io/get-payment-options/)). */
export async function fetchTlpePaymentOptions(): Promise<TlpePaymentOption[]> {
	const raw = await tlpeRequest<unknown>("/options", { method: "GET" })
	if (!Array.isArray(raw)) return []

	return raw
		.map((row): TlpePaymentOption | null => {
			if (!row || typeof row !== "object") return null
			const r = row as Record<string, unknown>
			const code = typeof r.code === "string" ? r.code.trim() : ""
			const value = typeof r.value === "string" ? r.value.trim() : ""
			if (!code) return null

			const option: TlpePaymentOption = {
				code,
				value: value || code,
			}
			if (typeof r.image === "string") option.image = r.image
			return option
		})
		.filter((o): o is TlpePaymentOption => o !== null)
}

export function pickTlpePaymentOption(
	options: TlpePaymentOption[],
	preferredCode?: string
): TlpePaymentOption | null {
	if (!options.length) return null

	const explicit = preferredCode?.trim()
	if (explicit) {
		const explicitKey = brandMatchKey(explicit)
		const match = options.find(o => {
			if (o.code === explicit) return true
			return brandMatchKey(o.value) === explicitKey
		})
		if (match) return match
		// Do not fall back to QR Ph when the caller asked for a specific brand.
		return null
	}

	for (const hint of QRPH_HINTS) {
		const match = options.find(o => normalizeOptionLabel(o.value).includes(hint))
		if (match) return match
	}

	return options[0] ?? null
}

/** Fresh GET /options + pick by TLPE option JWT or brand label (labels survive JWT rotation). */
export async function resolveTlpePaymentOption(
	preferredCodeOrLabel?: string
): Promise<TlpePaymentOption | null> {
	const options = await fetchTlpePaymentOptions()
	return pickTlpePaymentOption(options, preferredCodeOrLabel ?? tlpePreferredPaymentOptionCode())
}

export function tlpePreferredPaymentOptionCode(): string | undefined {
	return env.TLPE_PAYMENT_OPTION_CODE?.trim() || undefined
}
