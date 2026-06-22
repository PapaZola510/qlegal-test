import type { QuicksignErrorCode } from "@repo/contracts"

import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"

export function getQuicksignErrorDetails(
	error: unknown,
	fallback = "Something went wrong. Please try again."
): { message: string; code: QuicksignErrorCode | null; projectId: string | null } {
	const message = getOrpcMutationErrorMessage(error, fallback)
	let code: QuicksignErrorCode | null = null
	let projectId: string | null = null

	if (error && typeof error === "object") {
		const o = error as Record<string, unknown>
		const data = o.data as Record<string, unknown> | undefined
		const qs = data?.quicksign as Record<string, unknown> | undefined
		if (typeof qs?.code === "string") {
			code = qs.code as QuicksignErrorCode
		}
		if (typeof qs?.projectId === "string" && qs.projectId.trim()) {
			projectId = qs.projectId.trim()
		}
	}

	return { message, code, projectId }
}

export function formatQuicksignProjectLabel(projectId: string): string {
	const tail = projectId.replace(/-/g, "").slice(-8).toUpperCase()
	return `QS-${tail}`
}
