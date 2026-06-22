const QLEARN_CORE_BASE_URL = "https://qlearn-core.quanbyit.com/api/v1"

function hostnameOf(url: string): string | null {
	try {
		return new URL(url.trim()).hostname.toLowerCase()
	} catch {
		return null
	}
}

/** oRPC / Nest internal error JSON — returned by QLegal API, not QLearn integration routes. */
export function looksLikeQlegalOrpcErrorBody(text: string): boolean {
	const t = text.trim()
	if (!t.startsWith("{")) return false
	return (
		t.includes('"defined"') && (t.includes("INTERNAL_SERVER_ERROR") || t.includes('"status":500'))
	)
}

export function misconfiguredLmsBaseUrlMessage(
	baseUrl: string,
	opts?: { publicAppOrigin?: string }
): string | null {
	const host = hostnameOf(baseUrl)
	if (!host) {
		return `LMS_INTEGRATION_BASE_URL is not a valid URL: ${baseUrl}`
	}

	const forbiddenHosts = ["backend", "localhost", "127.0.0.1", "0.0.0.0"]
	if (forbiddenHosts.includes(host)) {
		return `LMS_INTEGRATION_BASE_URL must point at QLearn core (${QLEARN_CORE_BASE_URL}), not ${host}.`
	}

	if (/qlegal/i.test(host)) {
		return `LMS_INTEGRATION_BASE_URL must not point at the QLegal app (${host}). Use ${QLEARN_CORE_BASE_URL}.`
	}

	const publicHost = opts?.publicAppOrigin ? hostnameOf(opts.publicAppOrigin) : null
	if (publicHost && publicHost === host) {
		return `LMS_INTEGRATION_BASE_URL must not be the same host as the QLegal web app (${publicHost}). Use ${QLEARN_CORE_BASE_URL}.`
	}

	if (!host.includes("qlearn") && /quanby/i.test(host)) {
		return `LMS_INTEGRATION_BASE_URL host "${host}" does not look like QLearn. Use ${QLEARN_CORE_BASE_URL}.`
	}

	return null
}

/** Fail fast when staging/prod points LMS calls at QLegal instead of QLearn. */
export function validateLmsIntegrationBaseUrl(
	baseUrl: string | undefined,
	opts?: { publicAppOrigin?: string }
): void {
	const trimmed = baseUrl?.trim()
	if (!trimmed) return

	const message = misconfiguredLmsBaseUrlMessage(trimmed, opts)
	if (message) {
		throw new Error(message)
	}
}

export function formatLmsMisconfigurationHint(baseUrl: string | null): string {
	return `Verify LMS_INTEGRATION_BASE_URL is ${QLEARN_CORE_BASE_URL} (not stg-qlegal.quanbyai.com or http://backend:3000/api/v1). Current: ${baseUrl ?? "(unset)"}`
}
