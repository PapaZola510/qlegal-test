import {
	ForbiddenException,
	Injectable,
	NotFoundException,
	type CanActivate,
	type ExecutionContext,
} from "@nestjs/common"
import type { Request } from "express"

import { FilesService } from "@/modules/v1/files/files.service"

/**
 * Ensures the caller may access the `:id` file (sub-org, owner, or appointment party).
 */
@Injectable()
export class FileObjectTenancyGuard implements CanActivate {
	constructor(private readonly files: FilesService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req = context.switchToHttp().getRequest<Request>()
		const q = req.qlegalSessionContext
		if (!q?.userId) {
			throw new ForbiddenException("Missing tenancy context")
		}
		const id = req.params["id"]
		if (!id) {
			throw new NotFoundException()
		}

		const allowed = await this.files.userCanAccessFile(id, q)
		if (!allowed) {
			throw new ForbiddenException("Sub-organization access denied")
		}
		return true
	}
}
