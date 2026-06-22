/**
 * Best-effort message extraction from oRPC / OpenAPI fetch errors (shape varies by client).
 */
export function getOrpcMutationErrorMessage(
	error: unknown,
	fallback = "Something went wrong. Please try again."
): string {
	if (error instanceof Error) {
		const m = error.message.trim()
		if (m.length > 0) return m
	}
	if (error && typeof error === "object") {
		const o = error as Record<string, unknown>
		if (typeof o.message === "string" && o.message.trim()) return o.message.trim()
		const data = o.data as Record<string, unknown> | undefined
		if (data && typeof data.message === "string" && data.message.trim()) return data.message.trim()
		const body = o.body as Record<string, unknown> | undefined
		if (body && typeof body.message === "string" && body.message.trim()) return body.message.trim()
	}
	return fallback
}
