/** Extract signing/plot URL from initiateSigning API payloads. */
export function extractDoconchainLink(data: unknown): string | null {
	if (!data || typeof data !== "object") return null
	const root = data as Record<string, unknown>
	if (typeof root.link === "string" && root.link.startsWith("http")) return root.link
	if (typeof root.signLink === "string" && root.signLink.startsWith("http")) return root.signLink
	if (typeof root.plotLink === "string" && root.plotLink.startsWith("http")) return root.plotLink
	const nested = root.data
	if (nested && typeof nested === "object") {
		const d = nested as Record<string, unknown>
		if (typeof d.link === "string" && d.link.startsWith("http")) return d.link
		if (typeof d.url === "string" && d.url.startsWith("http")) return d.url
	}
	const message = root.message
	if (message && typeof message === "object") {
		const m = message as Record<string, unknown>
		if (typeof m.link === "string" && m.link.startsWith("http")) return m.link
	}
	return null
}
