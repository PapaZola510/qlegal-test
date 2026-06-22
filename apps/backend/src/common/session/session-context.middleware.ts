import { Injectable, type NestMiddleware } from "@nestjs/common"
import type { NextFunction, Request, Response } from "express"

import { SessionContextService } from "./session-context.service"

/**
 * Runs early for API routes so guards and oRPC share one resolved session context per request.
 */
@Injectable()
export class SessionContextMiddleware implements NestMiddleware {
	constructor(private readonly sessionContext: SessionContextService) {}

	use(req: Request, _res: Response, next: NextFunction): void {
		const url = req.originalUrl ?? req.url ?? ""
		if (!url.startsWith("/api/") || url.includes("/auth/")) {
			next()
			return
		}

		void this.sessionContext
			.resolveForRequest(req)
			.then(() => next())
			.catch(next)
	}
}
