import { Controller, Req } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import { v1 } from "@/config/api-versions.config"

import { OnboardingService } from "./onboarding.service"

@Controller()
export class OnboardingController {
	constructor(private readonly service: OnboardingService) {}

	@Implement(v1.onboarding.progress)
	async getProgress(@Session() session: UserSession) {
		return implement(v1.onboarding.progress).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.getProgress(userId)
		})
	}

	@Implement(v1.onboarding.submitStep)
	async submitStep(@Req() _req: Request, @Session() session: UserSession) {
		return implement(v1.onboarding.submitStep).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.submitStep(userId, input.step, input.data as Record<string, unknown>)
		})
	}

	@Implement(v1.onboarding.startHypervergeAttempt)
	async startHypervergeAttempt(@Session() session: UserSession) {
		return implement(v1.onboarding.startHypervergeAttempt).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.startHypervergeAttempt(userId, input.workflow)
		})
	}

	@Implement(v1.onboarding.syncHypervergeSdkCallback)
	async syncHypervergeSdkCallback(@Session() session: UserSession) {
		return implement(v1.onboarding.syncHypervergeSdkCallback).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.syncHypervergeSdkCallback(userId, input)
		})
	}

	@Implement(v1.onboarding.skipEnpKyc)
	async skipEnpKyc(@Session() session: UserSession) {
		return implement(v1.onboarding.skipEnpKyc).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.skipEnpKyc(userId)
		})
	}

	@Implement(v1.onboarding.completeCertificationCourse)
	async completeCertificationCourse(@Session() session: UserSession) {
		return implement(v1.onboarding.completeCertificationCourse).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.completeCertificationCourse(userId)
		})
	}

	@Implement(v1.onboarding.startQLearnCourse)
	async startQLearnCourse(@Session() session: UserSession) {
		return implement(v1.onboarding.startQLearnCourse).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.startQLearnCourse(userId)
		})
	}
}
