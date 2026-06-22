import { Controller, Req } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { v1 } from "@/config/api-versions.config"

import { applyCommonScenario, getMockScenario } from "../mock-data/mock-scenario.util"
import { SubOrgsService } from "./sub-orgs.service"

@Controller()
export class SubOrgsController {
	constructor(private readonly service: SubOrgsService) {}

	@Implement(v1.subOrg.list)
	async list(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.subOrg.list).handler(async ({ context }) => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			const scenario = getMockScenario(req)
			if (scenario === "empty") return []
			applyCommonScenario(scenario, "Sub-Organizations")
			const qlegal = (context as { qlegal: QlegalSessionContext | null }).qlegal
			if (qlegal && qlegal.userId !== userId) {
				throw new ORPCError("FORBIDDEN", {
					message: "Session context does not match authenticated user",
				})
			}
			const allowed = qlegal?.subOrgIds ?? []
			return this.service.findAllForUser(allowed)
		})
	}

	@Implement(v1.subOrg.get)
	async get(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.subOrg.get).handler(async ({ input, context }) => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Sub-Organization")
			const qlegal = (context as { qlegal: QlegalSessionContext | null }).qlegal
			if (qlegal && qlegal.userId !== userId) {
				throw new ORPCError("FORBIDDEN", {
					message: "Session context does not match authenticated user",
				})
			}
			const allowed = qlegal?.subOrgIds ?? []
			return this.service.findOneForUser(input.id, allowed)
		})
	}

	@Implement(v1.subOrg.create)
	async create(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.subOrg.create).handler(async ({ input, context }) => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Sub-Organization")
			const qlegal = (context as { qlegal: QlegalSessionContext | null }).qlegal
			if (qlegal && qlegal.userId !== userId) {
				throw new ORPCError("FORBIDDEN", {
					message: "Session context does not match authenticated user",
				})
			}
			return this.service.create(userId, input)
		})
	}

	@Implement(v1.subOrg.members)
	async members(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.subOrg.members).handler(async ({ input, context }) => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			const scenario = getMockScenario(req)
			if (scenario === "empty") return []
			applyCommonScenario(scenario, "Sub-Org Members")
			const qlegal = (context as { qlegal: QlegalSessionContext | null }).qlegal
			if (qlegal && qlegal.userId !== userId) {
				throw new ORPCError("FORBIDDEN", {
					message: "Session context does not match authenticated user",
				})
			}
			const allowed = qlegal?.subOrgIds ?? []
			return this.service.getMembersForUser(input.id, allowed)
		})
	}
}
