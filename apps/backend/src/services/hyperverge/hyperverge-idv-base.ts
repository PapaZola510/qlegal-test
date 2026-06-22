import { env } from "@/config/env.config"

/** HyperVerge IDV API host for link-kyc, output, logs, and /v2/auth/token. */
export const HYPERVERGE_IDV_DEFAULT = "https://ind.idv.hyperverge.co"
export const HYPERVERGE_IDV_FALLBACK = "https://ind-state.idv.hyperverge.co"

/**
 * Resolves the IDV API base URL. `HYPERVERGE_API_URL` must be an idv host (e.g. https://ind.idv.hyperverge.co).
 * Auth-only hosts like https://auth.hyperverge.co are ignored — use `HYPERVERGE_AUTH_BASE_URL` for those.
 */
export function hypervergeIdvApiBase(): string {
	const configured = (env.HYPERVERGE_API_URL?.trim() || HYPERVERGE_IDV_DEFAULT).replace(/\/$/, "")
	if (configured === "https://staging.ind.idv.hyperverge.co") {
		return HYPERVERGE_IDV_DEFAULT
	}
	if (configured.includes("idv.hyperverge")) {
		return configured
	}
	return HYPERVERGE_IDV_DEFAULT
}
