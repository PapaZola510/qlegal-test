import { Controller, Req } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { v1 } from "@/config/api-versions.config"

import { applyCommonScenario, applyDelay, getMockScenario } from "../mock-data/mock-scenario.util"
import { AuthProfileService } from "./auth-profile.service"

@Controller()
export class AuthProfileController {
	constructor(private readonly service: AuthProfileService) {}

	@Implement(v1.authProfile.me)
	async getMe(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.authProfile.me).handler(async ({ context }) => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Profile")
			await applyDelay(scenario)
			const qlegal = (context as { qlegal: QlegalSessionContext | null }).qlegal
			return this.service.getProfile(userId, qlegal?.role ?? "none")
		})
	}

	@Implement(v1.authProfile.ensureClientProfile)
	async ensureClientProfile(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.authProfile.ensureClientProfile).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Profile")
			await applyDelay(scenario)
			return this.service.ensureClientProfile(userId)
		})
	}

	@Implement(v1.authProfile.bootstrapRole)
	async bootstrapRole(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.authProfile.bootstrapRole).handler(async ({ input, context }) => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Profile")
			await applyDelay(scenario)
			const qlegal = (context as { qlegal: QlegalSessionContext | null }).qlegal
			if (qlegal && qlegal.userId !== userId) {
				throw new ORPCError("FORBIDDEN", {
					message: "Session context does not match authenticated user",
				})
			}
			return this.service.bootstrapRole(userId, input)
		})
	}

	@Implement(v1.authProfile.cancelEnpOnboarding)
	async cancelEnpOnboarding(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.authProfile.cancelEnpOnboarding).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Profile")
			await applyDelay(scenario)
			return this.service.cancelEnpOnboarding(userId)
		})
	}

	@Implement(v1.authProfile.update)
	async updateProfile(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.authProfile.update).handler(async ({ input, context }) => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Profile")
			const qlegal = (context as { qlegal: QlegalSessionContext | null }).qlegal
			if (qlegal && qlegal.userId !== userId) {
				throw new ORPCError("FORBIDDEN", {
					message: "Session context does not match authenticated user",
				})
			}
			return this.service.updateProfile(userId, input)
		})
	}

	@Implement(v1.authProfile.identityHistory)
	async identityHistory(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.authProfile.identityHistory).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			const scenario = getMockScenario(req)
			if (scenario === "empty") return []
			applyCommonScenario(scenario, "Identity History")
			return this.service.getIdentityHistory(userId)
		})
	}

	@Implement(v1.authProfile.dismissIdentityExpiryNotice)
	async dismissIdentityExpiryNotice(@Session() session: UserSession) {
		return implement(v1.authProfile.dismissIdentityExpiryNotice).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.dismissIdentityExpiryNotice(userId)
		})
	}

	@Implement(v1.authProfile.dismissCommissionExpiryWarning)
	async dismissCommissionExpiryWarning(@Session() session: UserSession) {
		return implement(v1.authProfile.dismissCommissionExpiryWarning).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.dismissCommissionExpiryWarning(userId, input)
		})
	}

	@Implement(v1.authProfile.snoozeCommissionExpiryWarning)
	async snoozeCommissionExpiryWarning(@Session() session: UserSession) {
		return implement(v1.authProfile.snoozeCommissionExpiryWarning).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.snoozeCommissionExpiryWarning(userId, input)
		})
	}

	@Implement(v1.authProfile.dismissGovernmentIdExpiryWarning)
	async dismissGovernmentIdExpiryWarning(@Session() session: UserSession) {
		return implement(v1.authProfile.dismissGovernmentIdExpiryWarning).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.dismissGovernmentIdExpiryWarning(userId, input)
		})
	}

	@Implement(v1.authProfile.snoozeGovernmentIdExpiryWarning)
	async snoozeGovernmentIdExpiryWarning(@Session() session: UserSession) {
		return implement(v1.authProfile.snoozeGovernmentIdExpiryWarning).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.snoozeGovernmentIdExpiryWarning(userId, input)
		})
	}

	@Implement(v1.authProfile.acceptTerms)
	async acceptTerms(@Session() session: UserSession) {
		return implement(v1.authProfile.acceptTerms).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.acceptTerms(userId)
		})
	}
}
