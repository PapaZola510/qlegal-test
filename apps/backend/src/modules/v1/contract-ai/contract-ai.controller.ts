import { Controller, Req } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import { v1 } from "@/config/api-versions.config"
import { AuditEvent } from "@/shared/decorators/audit-event.decorator"

import { applyCommonScenario, applyDelay, getMockScenario } from "../mock-data/mock-scenario.util"
import { ContractAiService } from "./contract-ai.service"

@Controller()
export class ContractAiController {
	constructor(private readonly service: ContractAiService) {}

	private requireUserAndOrgs(req: Request, session: UserSession) {
		const userId = session.user?.id
		if (!userId) {
			throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
		}
		const q = req.qlegalSessionContext
		if (!q?.subOrgIds?.length) {
			throw new ORPCError("FORBIDDEN", { message: "No organization context for this request" })
		}
		return { userId, subOrgIds: q.subOrgIds }
	}

	@AuditEvent({ eventType: "contract_ai.generate", targetTable: "contract_ai" })
	@Implement(v1.contractAi.generate)
	async generate(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.contractAi.generate).handler(async ({ input }) => {
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "AI Generation")
			await applyDelay(scenario, 2000)
			const ctx = this.requireUserAndOrgs(req, session)
			return this.service.generate(ctx.userId, input)
		})
	}

	@AuditEvent({ eventType: "contract_ai.analyze", targetTable: "file_objects" })
	@Implement(v1.contractAi.analyze)
	async analyze(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.contractAi.analyze).handler(async ({ input }) => {
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "AI Analysis")
			await applyDelay(scenario, 2000)
			const ctx = this.requireUserAndOrgs(req, session)
			return this.service.analyze(ctx.userId, ctx.subOrgIds, input)
		})
	}

	@AuditEvent({ eventType: "contract_ai.chat", targetTable: "contract_ai" })
	@Implement(v1.contractAi.chat)
	async chat(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.contractAi.chat).handler(async ({ input }) => {
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "AI Chat")
			await applyDelay(scenario, 1000)
			const ctx = this.requireUserAndOrgs(req, session)
			return this.service.chat(ctx.userId, ctx.subOrgIds, input)
		})
	}

	@AuditEvent({ eventType: "contract_ai.agentic_summarize", targetTable: "contract_ai" })
	@Implement(v1.contractAi.agenticSummarize)
	async agenticSummarize(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.contractAi.agenticSummarize).handler(async ({ input }) => {
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Agentic summarize")
			await applyDelay(scenario, 1500)
			const ctx = this.requireUserAndOrgs(req, session)
			return this.service.agenticSummarize(ctx.userId, input)
		})
	}
}
