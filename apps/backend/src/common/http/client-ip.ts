import type { Request } from "express"

/** Client IP for rate limits, honoring a single hop of X-Forwarded-For when present. */
export function getClientIp(req: Request): string {
	const xff = req.headers["x-forwarded-for"]
	if (typeof xff === "string") {
		const first = xff.split(",")[0]?.trim()
		if (first) return first
	}
	const socketIp = req.socket?.remoteAddress
	if (socketIp) return socketIp
	return "unknown"
}
