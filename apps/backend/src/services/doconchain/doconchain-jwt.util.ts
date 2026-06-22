/** Best-effort DocOnChain user id from a Bearer JWT (enterprise API tokens). */
export function parseDoconchainUserUuidFromToken(token: string): string | null {
	const parts = token.trim().split(".")
	if (parts.length < 2) return null
	try {
		const pad = parts[1]!.replace(/-/g, "+").replace(/_/g, "/")
		const json = Buffer.from(pad + "==".slice((pad.length + 3) % 4), "base64").toString("utf8")
		const payload = JSON.parse(json) as Record<string, unknown>
		for (const key of ["user_uuid", "userUuid", "uuid", "sub", "user_id", "userId", "id"]) {
			const v = payload[key]
			if (typeof v === "string" && v.trim().length >= 6) return v.trim()
		}
	} catch {
		return null
	}
	return null
}
