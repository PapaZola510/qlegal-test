import { Global, Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common"

import { SessionContextInterceptor } from "./session-context.interceptor"
import { SessionContextMiddleware } from "./session-context.middleware"
import { SessionContextService } from "./session-context.service"

@Global()
@Module({
	providers: [SessionContextService, SessionContextMiddleware, SessionContextInterceptor],
	exports: [SessionContextService, SessionContextInterceptor],
})
export class SessionModule implements NestModule {
	configure(consumer: MiddlewareConsumer): void {
		consumer.apply(SessionContextMiddleware).forRoutes("*")
	}
}
