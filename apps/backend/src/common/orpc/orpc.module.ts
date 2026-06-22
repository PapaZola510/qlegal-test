import { Module } from "@nestjs/common"
import { ORPCModule } from "@orpc/nest"
import type { Request, Response } from "express"

import type { QlegalSessionContext } from "../session/qlegal-session.types"
import { SessionContextService } from "../session/session-context.service"

declare module "@orpc/nest" {
	interface ORPCGlobalContext {
		request: Request
		response: Response
		qlegal: QlegalSessionContext | null
	}
}

@Module({
	imports: [
		ORPCModule.forRootAsync({
			inject: [SessionContextService],
			useFactory: (sessionContext: SessionContextService) => ({
				context: async (clientContext: object) => {
					const ctx = clientContext as Partial<{
						req: Request
						res: Response
						request: Request
						response: Response
					}>
					const request = ctx.request ?? ctx.req
					const response = ctx.response ?? ctx.res
					const qlegal = request ? await sessionContext.resolveForRequest(request) : null
					return {
						request: request as Request,
						response: response as Response,
						qlegal,
					}
				},
			}),
		}),
	],
})
export class ORPCCommonModule {}
