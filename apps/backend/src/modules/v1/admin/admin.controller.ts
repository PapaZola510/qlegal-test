import { Controller, Req, UseGuards } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import { v1 } from "@/config/api-versions.config"
import { Roles } from "@/shared/decorators/roles.decorator"
import { QlegalSessionGuard } from "@/shared/guards/qlegal-session.guard"
import { RoleGuard } from "@/shared/guards/role.guard"

import { applyCommonScenario, getMockScenario } from "../mock-data/mock-scenario.util"
import { AdminService } from "./admin.service"

@Controller()
@UseGuards(QlegalSessionGuard, RoleGuard)
@Roles("admin", "super_admin")
export class AdminController {
	constructor(private readonly service: AdminService) {}

	@Implement(v1.admin.dashboard)
	async dashboard(@Req() req: Request) {
		return implement(v1.admin.dashboard).handler(async () => {
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Admin Dashboard")
			return this.service.getDashboardStats()
		})
	}

	@Implement(v1.admin.listUsers)
	async listUsers(@Req() req: Request) {
		return implement(v1.admin.listUsers).handler(async () => {
			const scenario = getMockScenario(req)
			if (scenario === "empty") return []
			applyCommonScenario(scenario, "Admin Users")
			return this.service.listUsers()
		})
	}

	@Implement(v1.admin.updateUserRole)
	async updateUserRole(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.admin.updateUserRole).handler(async ({ input }) => {
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "User Role")
			const actorId = session.user?.id
			if (!actorId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.updateUserRole(input.userId, input.role, actorId)
		})
	}

	@Implement(v1.admin.setComplianceAccess)
	async setComplianceAccess(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.admin.setComplianceAccess).handler(async ({ input }) => {
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Compliance Access")
			const actorId = session.user?.id
			if (!actorId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.setComplianceAccess(input.userId, input.granted, actorId)
		})
	}

	@Implement(v1.admin.identityAudits)
	async identityAudits(@Req() req: Request) {
		return implement(v1.admin.identityAudits).handler(async () => {
			const scenario = getMockScenario(req)
			if (scenario === "empty") return []
			applyCommonScenario(scenario, "Identity Audits")
			return this.service.listIdentityAudits()
		})
	}

	@Implement(v1.admin.reviewIdentity)
	async reviewIdentity(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.admin.reviewIdentity).handler(async ({ input }) => {
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Identity Review")
			const actorId = session.user?.id
			if (!actorId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.reviewIdentity(input.auditId, input.decision, input.notes, actorId)
		})
	}

	@Implement(v1.admin.scSyncStatus)
	async scSyncStatus(@Req() req: Request) {
		return implement(v1.admin.scSyncStatus).handler(async () => {
			const scenario = getMockScenario(req)
			if (scenario === "empty") return []
			applyCommonScenario(scenario, "SC Sync Status")
			return this.service.getScSyncStatuses()
		})
	}

	@Implement(v1.admin.grantExamRetake)
	async grantExamRetake(@Session() session: UserSession) {
		return implement(v1.admin.grantExamRetake).handler(async ({ input }) => {
			const adminId = session.user?.id
			if (!adminId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.grantExamRetake(input.userId, adminId)
		})
	}

	@Implement(v1.admin.softDeleteUser)
	async softDeleteUser(@Session() session: UserSession) {
		return implement(v1.admin.softDeleteUser).handler(async ({ input }) => {
			const actorId = session.user?.id
			if (!actorId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			if (input.userId === actorId) {
				throw new ORPCError("BAD_REQUEST", { message: "Cannot soft-delete your own account" })
			}
			return this.service.softDeleteUser(input.userId, actorId)
		})
	}

	@Implement(v1.admin.listUserAudits)
	async listUserAudits() {
		return implement(v1.admin.listUserAudits).handler(async ({ input }) => {
			return this.service.listUserAudits(input.userId)
		})
	}

	@Implement(v1.admin.revokeCertificate)
	async revokeCertificate(@Session() session: UserSession) {
		return implement(v1.admin.revokeCertificate).handler(async ({ input }) => {
			const actorId = session.user?.id
			if (!actorId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.revokeCertificate(input.userId, actorId)
		})
	}

	@Implement(v1.admin.reinstateCertificate)
	async reinstateCertificate(@Session() session: UserSession) {
		return implement(v1.admin.reinstateCertificate).handler(async ({ input }) => {
			const actorId = session.user?.id
			if (!actorId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.reinstateCertificate(input.userId, actorId)
		})
	}

	@Implement(v1.admin.setEnpScCommissionStatus)
	async setEnpScCommissionStatus(@Session() session: UserSession) {
		return implement(v1.admin.setEnpScCommissionStatus).handler(async ({ input }) => {
			const actorId = session.user?.id
			if (!actorId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.setEnpScCommissionStatus(input.userId, input.status, actorId)
		})
	}

	@Implement(v1.admin.syncEnpScCommissionFromSc)
	async syncEnpScCommissionFromSc(@Session() session: UserSession) {
		return implement(v1.admin.syncEnpScCommissionFromSc).handler(async ({ input }) => {
			const actorId = session.user?.id
			if (!actorId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.syncEnpScCommissionFromSc(input.userId, actorId)
		})
	}

	@Implement(v1.admin.listPayments)
	async listPayments() {
		return implement(v1.admin.listPayments).handler(async () => {
			return this.service.listPayments()
		})
	}

	@Implement(v1.admin.markPaymentPaid)
	async markPaymentPaid(@Session() session: UserSession) {
		return implement(v1.admin.markPaymentPaid).handler(async ({ input }) => {
			const actorId = session.user?.id
			if (!actorId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.markPaymentPaid(input.paymentIntentId, actorId)
		})
	}

	@Implement(v1.admin.listSubOrgs)
	async listSubOrgs(@Req() req: Request) {
		return implement(v1.admin.listSubOrgs).handler(async () => {
			const scenario = getMockScenario(req)
			if (scenario === "empty") return []
			applyCommonScenario(scenario, "Sub-Organizations")
			return this.service.listSubOrgs()
		})
	}

	@Implement(v1.admin.createSubOrg)
	async createSubOrg(@Session() session: UserSession) {
		return implement(v1.admin.createSubOrg).handler(async ({ input }) => {
			const actorId = session.user?.id
			if (!actorId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.createSubOrg(input, actorId)
		})
	}

	@Implement(v1.admin.updateSubOrg)
	async updateSubOrg(@Session() session: UserSession) {
		return implement(v1.admin.updateSubOrg).handler(async ({ input }) => {
			const actorId = session.user?.id
			if (!actorId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.updateSubOrg(input, actorId)
		})
	}

	@Implement(v1.admin.softDeleteSubOrg)
	async softDeleteSubOrg(@Session() session: UserSession) {
		return implement(v1.admin.softDeleteSubOrg).handler(async ({ input }) => {
			const actorId = session.user?.id
			if (!actorId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.softDeleteSubOrg(input.id, actorId)
		})
	}

	@Implement(v1.admin.registryOversight)
	async registryOversight(@Req() req: Request) {
		return implement(v1.admin.registryOversight).handler(async () => {
			const scenario = getMockScenario(req)
			if (scenario === "empty") return []
			applyCommonScenario(scenario, "Registry oversight")
			return this.service.registryOversight()
		})
	}
}
