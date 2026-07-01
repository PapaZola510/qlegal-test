const STORAGE_KEY = "qlegal-mock-scenario"

/** Persisted mock scenario sent as `X-Mock-Scenario` on oRPC fetches (browser only). */
export function getMockScenarioHeader(): string | undefined {
	if (typeof window === "undefined") return undefined
	const v = window.sessionStorage.getItem(STORAGE_KEY)
	return v && v.length > 0 ? v : undefined
}

export function setMockScenarioHeader(scenario: string | null): void {
	if (typeof window === "undefined") return
	if (scenario) window.sessionStorage.setItem(STORAGE_KEY, scenario)
	else window.sessionStorage.removeItem(STORAGE_KEY)
}

export const MOCK_SCENARIO_OPTIONS = [
	{ value: "", label: "None" },
	{ value: "empty", label: "empty — empty lists" },
	{ value: "not_found", label: "not_found" },
	{ value: "server_error", label: "server_error" },
	{ value: "validation_error", label: "validation_error" },
	{ value: "slow", label: "slow — delayed responses" },
	{ value: "dc_popup_blocked", label: "dc_popup_blocked — QuickSign" },
	{ value: "exam_expired", label: "exam_expired — cert exam" },
	{ value: "payment_failed", label: "payment_failed (domain-specific)" },
] as const
