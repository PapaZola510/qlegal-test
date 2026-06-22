import { Module } from "@nestjs/common"

import { SessionModule } from "@/common/session/session.module"

import { DevAdminBootstrapService } from "./dev-admin-bootstrap.service"
import { DevAdminController } from "./dev-admin.controller"

@Module({
	imports: [SessionModule],
	controllers: [DevAdminController],
	providers: [DevAdminBootstrapService],
})
export class BootstrapModule {}
