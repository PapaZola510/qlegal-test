import { Controller } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"

import { v1 } from "@/config/api-versions.config"

import { LegalTemplatesService } from "./legal-templates.service"

@Controller()
export class LegalTemplatesController {
	constructor(private readonly service: LegalTemplatesService) {}

	@Implement(v1.legalTemplates.getDraft)
	async getDraft(@Session() session: UserSession) {
		return implement(v1.legalTemplates.getDraft).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.getDraft({ userId, templateId: input.templateId })
		})
	}

	@Implement(v1.legalTemplates.upsertDraft)
	async upsertDraft(@Session() session: UserSession) {
		return implement(v1.legalTemplates.upsertDraft).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.upsertDraft({
				userId,
				templateId: input.templateId,
				data: input.data,
			})
		})
	}
}
