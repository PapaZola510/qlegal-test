/**
 * Map HyperVerge workflow / webhook / SDK callback status strings to DB enum on `hyperverge_transactions`.
 * Kept in sync with {@link HypervergeWebhookService} semantics.
 */
export function mapHypervergeStatusToDbStatus(s: string): "success" | "fail" | "needs_review" {
	const x = s.toLowerCase().trim().replace(/\s+/g, "_")
	if (
		[
			"success",
			"auto_approved",
			"complete",
			"approved",
			"autoapproved",
			"succeeded",
			"verified",
		].includes(x)
	) {
		return "success"
	}
	if (["needs_review", "manual_review", "needsreview"].includes(x)) {
		return "needs_review"
	}
	return "fail"
}
