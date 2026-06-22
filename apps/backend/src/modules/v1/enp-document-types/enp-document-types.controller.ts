import { Controller } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { AllowAnonymous, Session, type UserSession } from "@thallesp/nestjs-better-auth"

import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { v1 } from "@/config/api-versions.config"

import { EnpDocumentTypesService } from "./enp-document-types.service"

function readQlegal(context: unknown): QlegalSessionContext | null {
	return (context as { qlegal: QlegalSessionContext | null }).qlegal
}

function requireAuthSession(session: UserSession): string {
	const userId = session.user?.id
	if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
	return userId
}

function resolveQlegalContext(context: unknown, session: UserSession): QlegalSessionContext {
	const qlegal = readQlegal(context)
	if (!qlegal?.userId) {
		return {
			userId: session.user!.id,
			sessionId: "unknown",
			role: "none",
			subOrgIds: [],
			complianceAuditAccess: false,
		}
	}
	if (qlegal.userId !== session.user!.id) {
		throw new ORPCError("FORBIDDEN", {
			message: "Session context does not match authenticated user",
		})
	}
	return qlegal
}

@Controller()
export class EnpDocumentTypesController {
	constructor(private readonly service: EnpDocumentTypesService) {}

	@AllowAnonymous()
	@Implement(v1.enpDocumentType.listForEnp)
	async listForEnp() {
		return implement(v1.enpDocumentType.listForEnp).handler(async ({ input }) => {
			return this.service.listForEnp(input.enpId)
		})
	}

	@Implement(v1.enpDocumentType.listMine)
	async listMine(@Session() session: UserSession) {
		return implement(v1.enpDocumentType.listMine).handler(async ({ context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.listMine(qlegal)
		})
	}

	@Implement(v1.enpDocumentType.create)
	async create(@Session() session: UserSession) {
		return implement(v1.enpDocumentType.create).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.create(qlegal, input)
		})
	}

	@Implement(v1.enpDocumentType.update)
	async update(@Session() session: UserSession) {
		return implement(v1.enpDocumentType.update).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.update(qlegal, input)
		})
	}

	@Implement(v1.enpDocumentType.delete)
	async delete(@Session() session: UserSession) {
		return implement(v1.enpDocumentType.delete).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.delete(qlegal, input.id)
		})
	}
}
