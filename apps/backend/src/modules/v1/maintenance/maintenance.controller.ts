import { Controller, UseGuards } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { AllowAnonymous, Session, type UserSession } from "@thallesp/nestjs-better-auth"

import { v1 } from "@/config/api-versions.config"
import { Roles } from "@/shared/decorators/roles.decorator"
import { QlegalSessionGuard } from "@/shared/guards/qlegal-session.guard"
import { RoleGuard } from "@/shared/guards/role.guard"

import { MaintenanceService } from "./maintenance.service"

@Controller()
export class MaintenanceController {
	constructor(private readonly service: MaintenanceService) {}

	@Implement(v1.maintenance.listForAdmin)
	@UseGuards(QlegalSessionGuard, RoleGuard)
	@Roles("admin", "super_admin")
	async listForAdmin() {
		return implement(v1.maintenance.listForAdmin).handler(async ({ input }) => {
			return this.service.listForAdmin(input)
		})
	}

	@Implement(v1.maintenance.createForAdmin)
	@UseGuards(QlegalSessionGuard, RoleGuard)
	@Roles("admin", "super_admin")
	async createForAdmin(@Session() session: UserSession) {
		return implement(v1.maintenance.createForAdmin).handler(async ({ input }) => {
			const actorId = session.user?.id
			if (!actorId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.createForAdmin(input, actorId)
		})
	}

	@Implement(v1.maintenance.cancelForAdmin)
	@UseGuards(QlegalSessionGuard, RoleGuard)
	@Roles("admin", "super_admin")
	async cancelForAdmin() {
		return implement(v1.maintenance.cancelForAdmin).handler(async ({ input }) => {
			return this.service.dismissForAdmin(input.id)
		})
	}

	@Implement(v1.maintenance.completeForAdmin)
	@UseGuards(QlegalSessionGuard, RoleGuard)
	@Roles("admin", "super_admin")
	async completeForAdmin() {
		return implement(v1.maintenance.completeForAdmin).handler(async ({ input }) => {
			return this.service.dismissForAdmin(input.id)
		})
	}

	@Implement(v1.maintenance.listForUser)
	@UseGuards(QlegalSessionGuard)
	async listForUser(@Session() session: UserSession) {
		return implement(v1.maintenance.listForUser).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.listForUser(userId, input)
		})
	}

	@Implement(v1.maintenance.getStatus)
	@AllowAnonymous()
	async getStatus() {
		return implement(v1.maintenance.getStatus).handler(async () => {
			return this.service.getMode()
		})
	}

	@Implement(v1.maintenance.setMode)
	@UseGuards(QlegalSessionGuard, RoleGuard)
	@Roles("admin", "super_admin")
	async setMode(@Session() session: UserSession) {
		return implement(v1.maintenance.setMode).handler(async ({ input }) => {
			const actorId = session.user?.id
			if (!actorId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.setMode(input, actorId)
		})
	}
}
