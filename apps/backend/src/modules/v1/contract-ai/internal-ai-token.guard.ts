import {
	ForbiddenException,
	Injectable,
	type CanActivate,
	type ExecutionContext,
} from "@nestjs/common"
import type { Request } from "express"

import { env } from "@/config/env.config"

@Injectable()
export class InternalAiTokenGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const req = context.switchToHttp().getRequest<Request>()
		const raw = req.headers["x-internal-token"]
		const token = Array.isArray(raw) ? raw[0] : raw
		const expected = env.CONTRACT_AI_INTERNAL_TOKEN?.trim()
		if (!expected || token !== expected) {
			throw new ForbiddenException()
		}
		return true
	}
}
