export type HypervergeWorkflowKind = "onboarding" | "liveness"

export function workflowKindFromTxnRaw(raw: unknown): HypervergeWorkflowKind {
	if (raw && typeof raw === "object" && !Array.isArray(raw)) {
		const kind = (raw as Record<string, unknown>).workflowKind
		if (kind === "liveness") return "liveness"
	}
	return "onboarding"
}

export function mergeTxnRawWithWebhook(
	priorRaw: unknown,
	webhookJson: Record<string, unknown>,
	workflowKind: HypervergeWorkflowKind
): Record<string, unknown> {
	const prior =
		priorRaw && typeof priorRaw === "object" && !Array.isArray(priorRaw)
			? (priorRaw as Record<string, unknown>)
			: {}
	return { ...prior, ...webhookJson, workflowKind }
}
