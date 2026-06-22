import { Controller } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"

import { v1 } from "@/config/api-versions.config"

import { IntegrationService } from "./integration.service"

@Controller()
export class IntegrationController {
	constructor(private readonly service: IntegrationService) {}

	@Implement(v1.integration.startTraining)
	async startTraining(@Session() session: UserSession) {
		return implement(v1.integration.startTraining).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.startTraining(userId)
		})
	}

	@Implement(v1.integration.syncAccount)
	async syncAccount(@Session() session: UserSession) {
		return implement(v1.integration.syncAccount).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.syncAccount(userId)
		})
	}

	@Implement(v1.integration.progress)
	async progress(@Session() session: UserSession) {
		return implement(v1.integration.progress).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.getProgress(userId)
		})
	}

	@Implement(v1.integration.certificate)
	async certificate(@Session() session: UserSession) {
		return implement(v1.integration.certificate).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.getCertificate(userId)
		})
	}

	@Implement(v1.integration.simulateCompletion)
	async simulateCompletion(@Session() session: UserSession) {
		return implement(v1.integration.simulateCompletion).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.simulateCompletion(userId)
		})
	}

	@Implement(v1.integration.syncCourseCompletion)
	async syncCourseCompletion(@Session() session: UserSession) {
		return implement(v1.integration.syncCourseCompletion).handler(async () => {
			const userId = session.user?.id
			if (!userId) {
				throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			}
			return this.service.syncCourseCompletionFromLms(userId)
		})
	}
}
