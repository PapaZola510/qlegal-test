import {
	ForbiddenException,
	Injectable,
	type CanActivate,
	type ExecutionContext,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { Request } from "express"

import { TENANT_SUB_ORG_INPUT_PATH_KEY } from "../decorators/tenant-sub-org.decorator"

function valueAtPath(obj: unknown, dotPath: string): unknown {
	const parts = dotPath.split(".").filter(Boolean)
	let cur: unknown = obj
	for (const p of parts) {
		if (cur === null || cur === undefined || typeof cur !== "object") {
			return undefined
		}
		cur = (cur as Record<string, unknown>)[p]
	}
	return cur
}

function readSubOrgIdFromBody(body: unknown, dotPath: string): unknown {
	return valueAtPath(body, dotPath) ?? valueAtPath(body, `json.${dotPath}`)
}

function readSubOrgIdFromQuery(query: unknown, dotPath: string): unknown {
	if (query === null || query === undefined || typeof query !== "object") {
		return undefined
	}
	const raw = valueAtPath(query, dotPath)
	if (raw === null || raw === undefined) {
		return undefined
	}
	if (Array.isArray(raw)) {
		return raw[0]
	}
	return raw
}

@Injectable()
export class TenancyGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const path = this.reflector.getAllAndOverride<string | undefined>(
			TENANT_SUB_ORG_INPUT_PATH_KEY,
			[context.getHandler(), context.getClass()]
		)
		if (!path) {
			return true
		}

		const req = context.switchToHttp().getRequest<Request>()
		const q = req.qlegalSessionContext
		if (!q?.userId) {
			throw new ForbiddenException("Missing tenancy context")
		}

		const raw =
			readSubOrgIdFromBody(req.body, path) ??
			valueAtPath(req.params, path) ??
			readSubOrgIdFromQuery(req.query, path)
		if (raw === null || raw === undefined || raw === "") {
			throw new ForbiddenException("Missing sub_org_id for tenancy check")
		}
		const subOrgId = String(raw)
		if (!q.subOrgIds.includes(subOrgId)) {
			throw new ForbiddenException("Sub-organization access denied")
		}
		return true
	}
}
