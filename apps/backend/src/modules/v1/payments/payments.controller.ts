import { Controller } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"

import { v1 } from "@/config/api-versions.config"
import { AuditEvent } from "@/shared/decorators/audit-event.decorator"

import { PaymentsService } from "./payments.service"

@Controller()
export class PaymentsController {
	constructor(private readonly service: PaymentsService) {}

	@Implement(v1.payment.list)
	async list(@Session() session: UserSession) {
		return implement(v1.payment.list).handler(async () => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.findAllForUser(userId)
		})
	}

	@Implement(v1.payment.get)
	async get(@Session() session: UserSession) {
		return implement(v1.payment.get).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.findOneForUser(userId, input.id)
		})
	}

	@Implement(v1.payment.create)
	@AuditEvent({ eventType: "payment.intent_created", targetTable: "payment_intents" })
	async create(@Session() session: UserSession) {
		return implement(v1.payment.create).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			return this.service.create(userId, input)
		})
	}
}
