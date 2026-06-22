import {
	Injectable,
	UnauthorizedException,
	type CanActivate,
	type ExecutionContext,
} from "@nestjs/common"
import type { Request } from "express"

/**
 * Requires a resolved Better Auth session (see {@link SessionContextService}).
 */
@Injectable()
export class QlegalSessionGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const req = context.switchToHttp().getRequest<Request>()
		if (!req.qlegalSessionContext?.userId) {
			throw new UnauthorizedException("Authentication required")
		}
		return true
	}
}
