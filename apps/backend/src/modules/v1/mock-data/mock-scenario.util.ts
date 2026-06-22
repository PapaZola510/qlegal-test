import {
	BadRequestException,
	InternalServerErrorException,
	NotFoundException,
} from "@nestjs/common"
import { ORPCError } from "@orpc/server"

/**
 * Extracts the mock scenario from X-Mock-Scenario header or ?scenario query param.
 * Controllers can call this and branch on the returned string.
 *
 * Documented scenarios (at least one per domain):
 *  - "not_found"       → throws NotFoundException
 *  - "server_error"    → throws InternalServerErrorException
 *  - "validation_error"→ throws BadRequestException
 *  - "empty"           → return empty datasets
 *  - "slow"            → adds artificial delay (caller must await)
 *  - "dc_popup_blocked"→ QuickSign / DOCONCHAIN plotter flow (popup blocked)
 *  - domain-specific   → e.g. "payment_failed", "exam_expired", "sc_sync_fail"
 */
export function getMockScenario(req: {
	headers: Record<string, unknown>
	query?: Record<string, unknown>
}): string | null {
	const header = req.headers["x-mock-scenario"]
	if (typeof header === "string" && header.length > 0) return header

	const query = req.query?.["scenario"]
	if (typeof query === "string" && query.length > 0) return query

	return null
}

export function applyCommonScenario(scenario: string | null, entityName: string): void {
	if (!scenario) return

	switch (scenario) {
		case "not_found":
			throw new NotFoundException(`${entityName} not found (mock scenario)`)
		case "server_error":
			throw new InternalServerErrorException(`Internal server error (mock scenario)`)
		case "validation_error":
			throw new BadRequestException(`Validation error on ${entityName} (mock scenario)`)
	}
}

export async function applyDelay(scenario: string | null, ms = 3000): Promise<void> {
	if (scenario === "slow") {
		await new Promise(resolve => setTimeout(resolve, ms))
	}
}

/** QuickSign / DOCONCHAIN — simulate plotter popup blocked (typed error for UI recovery). */
export function applyQuicksignPlotScenario(scenario: string | null): void {
	if (scenario === "dc_popup_blocked") {
		throw new ORPCError("BAD_REQUEST", {
			message:
				"DOCONCHAIN plotter popup was blocked (mock scenario dc_popup_blocked). Use Open again or confirm plotting when done.",
			data: { quicksign: { code: "DC_POPUP_BLOCKED" } },
		} as never)
	}
}
