/** QLearn `POST /integration/sso/create-code` request body (official contract — no courseId). */
export type LmsSsoCreateCodeRequestBody = {
	id: string
	email: string
	redirectUri: string
	classCode: string
}

export function buildLmsSsoCreateCodeRequestBody(input: {
	id: string
	email: string
	redirectUri: string
	classCode: string
}): LmsSsoCreateCodeRequestBody {
	return {
		id: input.id,
		email: input.email,
		redirectUri: input.redirectUri,
		classCode: input.classCode,
	}
}

function asNumber(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) return value
	if (typeof value === "string" && value.trim()) {
		const n = Number(value)
		if (Number.isFinite(n)) return n
	}
	return undefined
}

/** QLearn create-code response: `expiresInSeconds` or derive from ISO `expiresAt`. */
export function resolveSsoCodeExpiresInSeconds(
	data: Record<string, unknown>,
	fallbackSeconds: number
): number {
	const direct =
		asNumber(data.expiresInSeconds) ?? asNumber(data.expiresIn) ?? asNumber(data.expires_in)
	if (direct !== undefined && direct > 0) return direct

	const expiresAt =
		typeof data.expiresAt === "string"
			? data.expiresAt
			: typeof data.expires_at === "string"
				? data.expires_at
				: undefined
	if (expiresAt) {
		const ms = new Date(expiresAt).getTime() - Date.now()
		if (Number.isFinite(ms) && ms > 0) return Math.max(1, Math.round(ms / 1000))
	}

	return fallbackSeconds
}
