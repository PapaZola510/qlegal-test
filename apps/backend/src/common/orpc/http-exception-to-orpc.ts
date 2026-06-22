import { HttpException } from "@nestjs/common"
import { ORPCError } from "@orpc/server"

export function httpExceptionToOrpc(error: HttpException): never {
	const status = error.getStatus()
	const response = error.getResponse()
	let message = error.message
	if (typeof response === "object" && response !== null && "message" in response) {
		const raw = (response as { message: unknown }).message
		if (typeof raw === "string") message = raw
		else if (Array.isArray(raw)) message = raw.join(", ")
	}

	const code =
		status === 400
			? "BAD_REQUEST"
			: status === 401
				? "UNAUTHORIZED"
				: status === 403
					? "FORBIDDEN"
					: status === 404
						? "NOT_FOUND"
						: status === 409
							? "CONFLICT"
							: "INTERNAL_SERVER_ERROR"

	throw new ORPCError(code, { message })
}

export async function runOrpcHandler<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn()
	} catch (error) {
		if (error instanceof HttpException) httpExceptionToOrpc(error)
		throw error
	}
}
