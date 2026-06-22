import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core"
import { ScheduleModule } from "@nestjs/schedule"
import { AuthModule } from "@thallesp/nestjs-better-auth"
import { ZodSerializerInterceptor, ZodValidationPipe } from "nestjs-zod"

import { getAuth } from "@repo/auth"

import { BootstrapModule } from "@/common/bootstrap/bootstrap.module"
import { EnbBackupModule } from "@/common/enb-backup/enb-backup.module"
import { HttpExceptionFilter } from "@/common/filters/http-exception.filter"
import { MulterExceptionFilter } from "@/common/filters/multer-exception.filter"
import { RateLimitModule } from "@/common/rate-limit/rate-limit.module"
import { V1Module } from "@/modules/v1/v1.module"

import { ORPCCommonModule } from "./common/orpc/orpc.module"
import { SessionModule } from "./common/session/session.module"
import { env } from "./config/env.config"
import { DoconchainModule } from "./services/doconchain/doconchain.module"
import { LmsModule } from "./services/lms/lms.module"
import { ScRegistryModule } from "./services/sc-registry/sc-registry.module"
import { EmailVerifiedGuard } from "./shared/guards/email-verified.guard"
import { MaintenanceGuard } from "./shared/guards/maintenance.guard"
import { RoleGuard } from "./shared/guards/role.guard"
import { TenancyGuard } from "./shared/guards/tenancy.guard"
import { AuditInterceptor } from "./shared/interceptors/audit.interceptor"

@Module({
	imports: [
		ScheduleModule.forRoot(),
		RateLimitModule,
		// Core configuration
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: ".env",
			load: [() => env],
		}),
		// Authentication (controllers disabled - we register versioned routes in setupBetterAuth)
		AuthModule.forRoot({ auth: getAuth(), disableControllers: true }),
		BootstrapModule,
		EnbBackupModule,
		SessionModule,
		DoconchainModule,
		LmsModule,
		ScRegistryModule,
		// oRPC setup
		ORPCCommonModule,
		// Versioned modules
		V1Module,
	],
	providers: [
		TenancyGuard,
		RoleGuard,
		// Global providers
		{
			provide: APP_GUARD,
			useClass: MaintenanceGuard,
		},
		{
			provide: APP_GUARD,
			useClass: EmailVerifiedGuard,
		},
		{
			provide: APP_PIPE,
			useClass: ZodValidationPipe,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: ZodSerializerInterceptor,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: AuditInterceptor,
		},
		{
			provide: APP_FILTER,
			useClass: HttpExceptionFilter,
		},
		{
			provide: APP_FILTER,
			useClass: MulterExceptionFilter,
		},
	],
})
export class AppModule {}
