import { Controller, Req } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import { v1 } from "@/config/api-versions.config"

import { applyCommonScenario, getMockScenario } from "../mock-data/mock-scenario.util"
import { MessagesService } from "./messages.service"

@Controller()
export class MessagesController {
	constructor(private readonly service: MessagesService) {}

	@Implement(v1.message.listConversations)
	async listConversations(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.message.listConversations).handler(async () => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			const scenario = getMockScenario(req)
			if (scenario === "empty") return []
			applyCommonScenario(scenario, "Conversations")
			return this.service.listConversations(userId)
		})
	}

	@Implement(v1.message.getMessages)
	async getMessages(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.message.getMessages).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			const scenario = getMockScenario(req)
			if (scenario === "empty") return { items: [], hasMore: false, nextCursor: null }
			applyCommonScenario(scenario, "Messages")
			return this.service.getMessages(userId, input.id, {
				limit: input.limit,
				before: input.before,
			})
		})
	}

	@Implement(v1.message.send)
	async send(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.message.send).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Message")
			return this.service.sendMessage(userId, input)
		})
	}

	@Implement(v1.message.openConversation)
	async openConversation(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.message.openConversation).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Conversation")
			return this.service.openConversation(userId, input.peerUserId)
		})
	}

	@Implement(v1.message.resolvePeerByEmail)
	async resolvePeerByEmail(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.message.resolvePeerByEmail).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Conversation")
			return this.service.resolvePeerByEmail(userId, input.email)
		})
	}

	@Implement(v1.message.searchPeers)
	async searchPeers(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.message.searchPeers).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Conversation")
			return this.service.searchPeers(userId, input.query)
		})
	}

	@Implement(v1.message.getPeerProfile)
	async getPeerProfile(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.message.getPeerProfile).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Conversation")
			return this.service.getPeerProfile(userId, input.peerUserId)
		})
	}

	@Implement(v1.message.markRead)
	async markRead(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.message.markRead).handler(async ({ input }) => {
			const userId = session.user?.id
			if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
			const scenario = getMockScenario(req)
			applyCommonScenario(scenario, "Conversation")
			return this.service.markRead(userId, input.id)
		})
	}
}
