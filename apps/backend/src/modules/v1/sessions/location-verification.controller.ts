import { Controller, Req } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"
import type { Request } from "express"

import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { v1 } from "@/config/api-versions.config"

import { LocationVerificationService } from "./location-verification.service"

function readQlegal(context: unknown): QlegalSessionContext | null {
	return (context as { qlegal: QlegalSessionContext | null }).qlegal
}

function requireAuthSession(session: UserSession): string {
	const userId = session.user?.id
	if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
	return userId
}

function resolveQlegalContext(context: unknown, session: UserSession): QlegalSessionContext {
	const qlegal = readQlegal(context)
	if (!qlegal?.userId) {
		return {
			userId: session.user!.id,
			sessionId: "unknown",
			role: "none",
			subOrgIds: [],
			complianceAuditAccess: false,
		}
	}
	if (qlegal.userId !== session.user!.id) {
		throw new ORPCError("FORBIDDEN", {
			message: "Session context does not match authenticated user",
		})
	}
	return qlegal
}

@Controller()
export class LocationVerificationController {
	constructor(private readonly service: LocationVerificationService) {}

	@Implement(v1.session.locationVerification.verifyLocation)
	async verifyLocation(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.session.locationVerification.verifyLocation).handler(
			async ({ input, context }) => {
				requireAuthSession(session)
				const qlegal = resolveQlegalContext(context, session)
				return this.service.verifyLocation(qlegal, req, input)
			}
		)
	}

	@Implement(v1.session.locationVerification.checkVpn)
	async checkVpn(@Req() req: Request, @Session() session: UserSession) {
		return implement(v1.session.locationVerification.checkVpn).handler(async ({ input }) => {
			requireAuthSession(session)
			return this.service.checkVpn(req, input.browserPublicIp)
		})
	}

	@Implement(v1.session.locationVerification.getLobbyStatus)
	async getLobbyStatus(@Session() session: UserSession) {
		return implement(v1.session.locationVerification.getLobbyStatus).handler(
			async ({ input, context }) => {
				requireAuthSession(session)
				const qlegal = resolveQlegalContext(context, session)
				return this.service.getLobbyStatus(qlegal, input.appointmentId)
			}
		)
	}
}
