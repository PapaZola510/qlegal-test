import { Controller } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"

import { v1 } from "@/config/api-versions.config"

import { CertExamService } from "./cert-exam.service"

@Controller()
export class CertExamController {
	constructor(private readonly service: CertExamService) {}

	@Implement(v1.certExam.listExams)
	async listExams() {
		return implement(v1.certExam.listExams).handler(async () => {
			return this.service.listExams()
		})
	}

	@Implement(v1.certExam.getAttempts)
	async getAttempts(@Session() session: UserSession) {
		return implement(v1.certExam.getAttempts).handler(async () => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.getAttempts(userId)
		})
	}

	@Implement(v1.certExam.startExam)
	async startExam(@Session() session: UserSession) {
		return implement(v1.certExam.startExam).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.startExam(userId, input.examId)
		})
	}

	@Implement(v1.certExam.submitSection)
	async submitSection(@Session() session: UserSession) {
		return implement(v1.certExam.submitSection).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.submitSection(userId, input.attemptId, input.sectionIndex, input.answers)
		})
	}

	@Implement(v1.certExam.resumeExam)
	async resumeExam(@Session() session: UserSession) {
		return implement(v1.certExam.resumeExam).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.resumeExam(userId, input.attemptId, input.resumeToken)
		})
	}

	@Implement(v1.certExam.submitExam)
	async submitExam(@Session() session: UserSession) {
		return implement(v1.certExam.submitExam).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.submitExamLegacy(userId, input.attemptId, input.answers)
		})
	}

	@Implement(v1.certExam.devPerfectExam)
	async devPerfectExam(@Session() session: UserSession) {
		return implement(v1.certExam.devPerfectExam).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.devPerfectExam(userId, input.examId)
		})
	}
}
