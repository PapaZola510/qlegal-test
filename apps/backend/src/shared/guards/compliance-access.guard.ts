import {
	ForbiddenException,
	Injectable,
	type CanActivate,
	type ExecutionContext,
} from "@nestjs/common"
import type { Request } from "express"

/** Allows platform admins OR users holding the complianceAuditAccess grant. */
@Injectable()
export class ComplianceAccessGuard implements CanActivate {
	canActivate(ctx: ExecutionContext): boolean {
		const req = ctx.switchToHttp().getRequest<Request>()
		const q = req.qlegalSessionContext
		if (!q?.userId) throw new ForbiddenException("Authentication required")
		if (q.role === "admin" || q.role === "super_admin") return true
		if (q.complianceAuditAccess) return true
		throw new ForbiddenException("Compliance audit access not granted")
	}
}
