import {
	ForbiddenException,
	Injectable,
	type CanActivate,
	type ExecutionContext,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { Request } from "express"

import type { QlegalRole } from "../../common/session/qlegal-session.types"
import { ROLES_KEY } from "../decorators/roles.decorator"

@Injectable()
export class RoleGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const roles = this.reflector.getAllAndOverride<QlegalRole[] | undefined>(ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		])
		if (!roles?.length) {
			return true
		}

		const req = context.switchToHttp().getRequest<Request>()
		const q = req.qlegalSessionContext
		if (!q?.userId) {
			throw new ForbiddenException("Authentication required")
		}
		if (!roles.includes(q.role)) {
			throw new ForbiddenException("Insufficient role")
		}
		return true
	}
}
