import { Injectable } from "@nestjs/common"
import { ORPCError } from "@orpc/server"

import type {
	EnbAccessRequest,
	EnbEntryLookupResult,
	LookupEnbEntryForAccess,
	SubmitVirtualEnbAccessRequest,
} from "@repo/contracts"

import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { RegistryService } from "@/modules/v1/registry/registry.service"

@Injectable()
export class EnbAccessService {
	constructor(private readonly registry: RegistryService) {}

	private assertAuthenticated(ctx: QlegalSessionContext | null): string {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		return ctx.userId
	}

	async lookupEntry(
		ctx: QlegalSessionContext | null,
		input: LookupEnbEntryForAccess
	): Promise<EnbEntryLookupResult> {
		this.assertAuthenticated(ctx)
		return this.registry.lookupEnbEntryForVirtualAccess(input)
	}

	async submitVirtualRequest(
		ctx: QlegalSessionContext | null,
		input: SubmitVirtualEnbAccessRequest
	): Promise<EnbAccessRequest> {
		const requesterUserId = this.assertAuthenticated(ctx)
		return this.registry.createVirtualEnbAccessRequest(requesterUserId, input)
	}

	async listMyRequests(ctx: QlegalSessionContext | null): Promise<EnbAccessRequest[]> {
		const requesterUserId = this.assertAuthenticated(ctx)
		return this.registry.listEnbAccessRequestsForRequester(requesterUserId)
	}
}
