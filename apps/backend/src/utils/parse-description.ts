/**
 * Parse a value from a pipe-delimited description string by prefix.
 * E.g. parseDescriptionValue("qlegal-dc:abc|qlegal-code:XYZ123", "qlegal-code:") → "XYZ123"
 */
export function parseDescriptionValue(
	description: string | null | undefined,
	prefix: string
): string | null {
	if (!description?.trim()) return null
	for (const segment of description.split("|")) {
		const trimmed = segment.trim()
		if (trimmed.startsWith(prefix)) {
			const val = trimmed.slice(prefix.length).trim()
			return val || null
		}
	}
	return null
}
