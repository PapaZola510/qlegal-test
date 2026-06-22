import {
	Injectable,
	type CallHandler,
	type ExecutionContext,
	type NestInterceptor,
} from "@nestjs/common"
import type { Request } from "express"
import { from, switchMap } from "rxjs"

import { SessionContextService } from "./session-context.service"

/**
 * Ensures {@link SessionContextService.resolveForRequest} ran for this HTTP request
 * (middleware already does this for `/api/*`; this interceptor makes the contract explicit
 * for controllers that opt in, e.g. raw multipart routes).
 */
@Injectable()
export class SessionContextInterceptor implements NestInterceptor {
	constructor(private readonly sessionContext: SessionContextService) {}

	intercept(context: ExecutionContext, next: CallHandler) {
		const req = context.switchToHttp().getRequest<Request>()
		return from(this.sessionContext.resolveForRequest(req)).pipe(switchMap(() => next.handle()))
	}
}
