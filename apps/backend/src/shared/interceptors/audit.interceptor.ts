import {
	Injectable,
	Logger,
	type CallHandler,
	type ExecutionContext,
	type NestInterceptor,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { randomUUID } from "node:crypto"
import type { Request } from "express"
import { tap, type Observable } from "rxjs"

import { auditEvents } from "@repo/db/schema"

import { db } from "../../common/database/database.client"
import { AUDIT_EVENT_KEY, type AuditEventConfig } from "../decorators/audit-event.decorator"

@Injectable()
export class AuditInterceptor implements NestInterceptor {
	private readonly logger = new Logger(AuditInterceptor.name)

	constructor(private readonly reflector: Reflector) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const meta = this.reflector.get<AuditEventConfig | undefined>(
			AUDIT_EVENT_KEY,
			context.getHandler()
		)
		if (!meta) {
			return next.handle()
		}
		const req = context.switchToHttp().getRequest<Request>()
		return next.handle().pipe(
			tap(() => {
				void this.persist(req, meta).catch(error => {
					this.logger.warn(`audit_events insert failed: ${String(error)}`)
				})
			})
		)
	}

	private async persist(req: Request, meta: AuditEventConfig): Promise<void> {
		const q = req.qlegalSessionContext
		await db.insert(auditEvents).values({
			id: randomUUID(),
			actorUserId: q?.userId ?? null,
			subOrgId: q?.subOrgIds[0] ?? null,
			eventType: meta.eventType,
			targetTable: meta.targetTable ?? null,
			targetId: null,
			payload: { path: req.originalUrl ?? req.url },
		})
	}
}
